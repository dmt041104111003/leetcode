import base64
import math
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from l2cs import Pipeline

# Load environment variables from repo .env if present.
try:
    from dotenv import load_dotenv  # type: ignore

    _SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
    _REPO_ROOT = os.path.dirname(_SERVICE_DIR)
    load_dotenv(os.path.join(_REPO_ROOT, ".env"), override=False)
    load_dotenv(os.path.join(_SERVICE_DIR, ".env"), override=False)
except Exception:
    # python-dotenv is optional; env can be provided by the shell/process manager.
    pass


class GazeEstimateRequest(BaseModel):
    image_base64: str | None = Field(None, description="Base64 JPEG/PNG without data URL prefix")
    student_id: str | None = Field(
        None,
        max_length=64,
        description="Mã sinh viên (MSSV) từ app — hiển thị trên bbox/message, không dùng ID track",
    )

class EnrollRequest(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=64)
    image_base64: str = Field(..., description="Base64 JPEG/PNG without data URL prefix")


class EnrollResponse(BaseModel):
    enrolled: bool
    student_id: str | None = None
    detail: str = "OK"
    pitch_rad: float | None = None
    yaw_rad: float | None = None
    pose_coverage: dict[str, bool] = Field(default_factory=dict)
    pose_complete: bool = False
    pose_missing: list[str] = Field(default_factory=list)
    # Tuần tự: center → left → right (chỉ bước tiếp khi đạt bước hiện tại).
    enroll_step_index: int = 0  # 0..2 = bước đang làm, 3 = xong
    enroll_step_total: int = 3
    enroll_target_key: str | None = None
    enroll_hint_vn: str = ""


class ResetRequest(BaseModel):
    student_id: str | None = Field(None, max_length=64)


class GazeEstimateResponse(BaseModel):
    faces: list[dict[str, Any]] = Field(default_factory=list)
    annotated_image_base64: str | None = None
    faces_count: int = 0
    violation: bool = False
    violation_type: str = "ok"
    message: str = "OK"
    enrolled_student_id: str | None = None


def _face_hist(gray_face_112: np.ndarray) -> np.ndarray:
    hist = cv2.calcHist([gray_face_112], [0], None, [32], [0, 256])
    hist = cv2.normalize(hist, hist).reshape(-1)
    return hist


def _hist_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """So khớp mặt ổn định hơn: lấy max correl ∩ intersect (histogram đã normalize)."""
    a32 = a.astype(np.float32)
    b32 = b.astype(np.float32)
    correl = float(cv2.compareHist(a32, b32, cv2.HISTCMP_CORREL))
    inter = float(cv2.compareHist(a32, b32, cv2.HISTCMP_INTERSECT))
    return max(correl, inter)


def _mssv_key(s: str | None) -> str:
    """Strip + casefold để so khớp MSSV từ JWT với giá trị lúc enroll (tránh lệch hoa/thường)."""
    if not isinstance(s, str):
        return ""
    t = s.strip()
    return t.casefold() if t else ""


def _hist_owner_matches_request(enrolled_sid: str, request_sid: str) -> bool:
    """Có dùng histogram định danh đã lưu hay không: cùng thí sinh; request không gửi MSSV thì vẫn dùng (máy chủ đơn)."""
    ek = _mssv_key(enrolled_sid)
    rk = _mssv_key(request_sid)
    if not ek:
        return False
    if not rk:
        return True
    return ek == rk


def _crop_face_gray_112(frame_bgr: np.ndarray, bbox: list[float]) -> np.ndarray | None:
    h, w = frame_bgr.shape[:2]
    x1, y1, x2, y2 = [int(round(float(v))) for v in bbox[:4]]
    x1 = max(0, min(w - 1, x1))
    y1 = max(0, min(h - 1, y1))
    x2 = max(0, min(w, x2))
    y2 = max(0, min(h, y2))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame_bgr[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (112, 112))
    return gray


def _direction_label(theta_rad: float, phi_rad: float, threshold_deg: float) -> str:
    # theta: pitch (vertical), phi: yaw (horizontal)
    rad_to_deg = 180.0 / np.pi
    horizontal_deg = float(phi_rad) * rad_to_deg
    vertical_deg = float(theta_rad) * rad_to_deg

    t = float(threshold_deg)
    left = horizontal_deg < -t
    right = horizontal_deg > t
    up = vertical_deg > t
    down = vertical_deg < -t
    if not left and not right and not up and not down:
        return "Chính diện"
    if left and up:
        return "Nhìn trái lên"
    if left and down:
        return "Nhìn trái xuống"
    if left:
        return "Nhìn trái"
    if right and up:
        return "Nhìn phải lên"
    if right and down:
        return "Nhìn phải xuống"
    if right:
        return "Nhìn phải"
    if up:
        return "Nhìn lên"
    if down:
        return "Nhìn xuống"
    return "Chính diện"

def _direction_from_dxdy(dx_px: float, dy_px: float, bbox_width: float, threshold_frac: float) -> str:
    """
    Direction label derived from the actual drawn arrow vector.
    - dx_px, dy_px: arrow delta in pixels before multiplier (same basis as bbox_width scaling)
    - bbox_width: face box width in pixels
    - threshold_frac: deadzone threshold as fraction of bbox_width
    Note: image coordinates: +x right, +y down. So dy_px < 0 means "up".
    """
    t = abs(float(bbox_width)) * float(threshold_frac)
    if t <= 0:
        t = 1.0

    left = dx_px < -t
    right = dx_px > t
    up = dy_px < -t
    down = dy_px > t

    if not left and not right and not up and not down:
        return "Chính diện"
    if left and up:
        return "Nhìn trái lên"
    if left and down:
        return "Nhìn trái xuống"
    if left:
        return "Nhìn trái"
    if right and up:
        return "Nhìn phải lên"
    if right and down:
        return "Nhìn phải xuống"
    if right:
        return "Nhìn phải"
    if up:
        return "Nhìn lên"
    if down:
        return "Nhìn xuống"
    return "Chính diện"


def _env_int(name: str, fallback: int) -> int:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return fallback
    try:
        return int(raw)
    except Exception:
        return fallback


def _env_float(name: str, fallback: float) -> float:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return fallback
    try:
        return float(raw)
    except Exception:
        return fallback

def _pitchyaw_to_dxdy(pitch: float, yaw: float) -> tuple[float, float]:
    # Match service/l2cs/vis.py draw_gaze direction (without pixel scaling).
    dx = -float(np.sin(pitch) * np.cos(yaw))
    dy = -float(np.sin(yaw))
    return dx, dy


def _iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a[:4]
    bx1, by1, bx2, by2 = b[:4]
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    iw = max(0.0, inter_x2 - inter_x1)
    ih = max(0.0, inter_y2 - inter_y1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return float(inter / union) if union > 0 else 0.0


def _assign_face_ids(
    prev_bboxes: list[list[float]],
    prev_ids: list[int],
    new_bboxes: list[list[float]],
    next_id: int,
    iou_threshold: float,
) -> tuple[list[int], int]:
    """
    Greedy IoU matching from new -> prev to keep stable IDs.
    Returns (new_ids, next_id).
    """
    new_ids: list[int] = [-1] * len(new_bboxes)
    used_prev: set[int] = set()

    for i, nb in enumerate(new_bboxes):
        best_j = -1
        best_iou = 0.0
        for j, pb in enumerate(prev_bboxes):
            if j in used_prev:
                continue
            v = _iou(nb, pb)
            if v > best_iou:
                best_iou = v
                best_j = j
        if best_j != -1 and best_iou >= iou_threshold:
            new_ids[i] = int(prev_ids[best_j])
            used_prev.add(best_j)
        else:
            new_ids[i] = int(next_id)
            next_id += 1

    return new_ids, next_id


def _tracks_from_state(app: FastAPI) -> list[dict[str, Any]]:
    tracks = getattr(app.state, "_tracks", None)
    return tracks if isinstance(tracks, list) else []


def _save_tracks_to_state(app: FastAPI, tracks: list[dict[str, Any]]) -> None:
    app.state._tracks = tracks


def _update_tracks_with_detections(
    tracks: list[dict[str, Any]],
    new_bboxes: list[list[float]],
    next_id: int,
    iou_threshold: float,
    max_misses: int,
) -> tuple[list[dict[str, Any]], list[int], int]:
    """
    Maintain stable IDs across temporary missed detections.
    - tracks: list[{id:int, bbox:list[float], misses:int}]
    - returns: (updated_tracks, new_ids aligned with new_bboxes, next_id)
    """
    if len(tracks) == 0:
        updated = []
        new_ids: list[int] = []
        for bb in new_bboxes:
            updated.append({"id": int(next_id), "bbox": bb, "misses": 0})
            new_ids.append(int(next_id))
            next_id += 1
        return updated, new_ids, next_id

    # Greedy match new -> existing tracks by IoU (do NOT mutate track list length during matching)
    new_ids: list[int] = [-1] * len(new_bboxes)
    matched_track_idx: set[int] = set()

    for i, nb in enumerate(new_bboxes):
        best_j = -1
        best_iou = 0.0
        for j, tr in enumerate(tracks):
            if j in matched_track_idx:
                continue
            v = _iou(nb, tr["bbox"])
            if v > best_iou:
                best_iou = v
                best_j = j

        if best_j != -1 and best_iou >= iou_threshold:
            matched_track_idx.add(best_j)
            tracks[best_j]["bbox"] = nb
            tracks[best_j]["misses"] = 0
            new_ids[i] = int(tracks[best_j]["id"])

    # Create tracks for unmatched detections
    for i, nb in enumerate(new_bboxes):
        if new_ids[i] != -1:
            continue
        new_ids[i] = int(next_id)
        tracks.append({"id": int(next_id), "bbox": nb, "misses": 0})
        next_id += 1

    # Age unmatched tracks (those not matched this update)
    for j in range(len(tracks)):
        if j in matched_track_idx:
            continue
        tracks[j]["misses"] = int(tracks[j].get("misses", 0)) + 1

    # Drop old tracks
    tracks = [tr for tr in tracks if int(tr.get("misses", 0)) <= max_misses]

    return tracks, new_ids, next_id


def _annotate_frame(frame_bgr: np.ndarray, faces: list[dict[str, Any]], arrow_multiplier: float) -> np.ndarray:
    """
    Draw bbox + gaze arrow + target dot, similar to service/l2cs/vis.py.
    Expects bbox in original frame coordinates.
    """
    out = frame_bgr.copy()
    for f in faces:
        bbox = f.get("bbox")
        if not (isinstance(bbox, list) and len(bbox) >= 4):
            continue
        x1, y1, x2, y2 = [int(round(float(v))) for v in bbox[:4]]
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = max(0, x2)
        y2 = max(0, y2)
        if x2 <= x1 or y2 <= y1:
            continue

        # bbox
        cv2.rectangle(out, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Label chỉ với MSSV (chuỗi); không vẽ ID track kiểu ID:1
        face_id = f.get("id")
        label: str | None = None
        if isinstance(face_id, str) and face_id.strip():
            label = face_id.strip()
        if label:
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            thickness = 2
            (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            pad = 4
            box_x1 = x1
            box_y1 = max(0, y1 - th - baseline - pad * 2)
            box_x2 = x1 + tw + pad * 2
            box_y2 = box_y1 + th + baseline + pad * 2
            cv2.rectangle(out, (box_x1, box_y1), (box_x2, box_y2), (0, 255, 0), -1)
            cv2.putText(out, label, (box_x1 + pad, box_y2 - baseline - pad), font, font_scale, (0, 0, 0), thickness, cv2.LINE_AA)

        # Mũi tên / điểm gaze chỉ cho mặt đã khớp định danh (histogram); người chưa định danh chỉ bbox.
        if not f.get("draw_gaze_arrow"):
            continue
        dx_raw = f.get("dx_px")
        dy_raw = f.get("dy_px")
        if not isinstance(dx_raw, (int, float)) or not isinstance(dy_raw, (int, float)):
            continue
        if not (math.isfinite(float(dx_raw)) and math.isfinite(float(dy_raw))):
            continue
        cx = int(x1 + (x2 - x1) / 2)
        cy = int(y1 + (y2 - y1) / 2)
        dx_px = float(dx_raw)
        dy_px = float(dy_raw)
        m = float(arrow_multiplier)
        tx = int(round(cx + dx_px * m))
        ty = int(round(cy + dy_px * m))

        cv2.arrowedLine(out, (cx, cy), (tx, ty), (0, 0, 255), 3, cv2.LINE_AA, tipLength=0.18)
        cv2.circle(out, (tx, ty), radius=12, color=(0, 0, 255), thickness=-1)

    return out


def _encode_bgr_to_jpeg_base64(frame_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _predict_from_bboxes(gaze_pipeline: Pipeline, frame_bgr: np.ndarray, bboxes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    face_imgs: list[np.ndarray] = []
    kept_idx: list[int] = []
    h, w = frame_bgr.shape[:2]
    for i, box in enumerate(bboxes):
        x_min = max(0, int(box[0]))
        y_min = max(0, int(box[1]))
        x_max = min(w, int(box[2]))
        y_max = min(h, int(box[3]))
        if x_max <= x_min or y_max <= y_min:
            continue
        img = frame_bgr[y_min:y_max, x_min:x_max]
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (224, 224))
        face_imgs.append(img)
        kept_idx.append(i)

    if len(face_imgs) == 0:
        return np.empty((0, 1)), np.empty((0, 1))

    pitch_arr, yaw_arr = gaze_pipeline.predict_gaze(np.stack(face_imgs))
    # Expand back to original bbox count so indices stay aligned
    pitch_full = np.full((bboxes.shape[0], 1), np.nan, dtype=np.float32)
    yaw_full = np.full((bboxes.shape[0], 1), np.nan, dtype=np.float32)
    for j, i in enumerate(kept_idx):
        pitch_full[i] = pitch_arr[j]
        yaw_full[i] = yaw_arr[j]
    return pitch_full, yaw_full


_ENROLL_POSE_KEYS: tuple[str, ...] = ("center", "left", "right")
_ENROLL_STEPS_N: int = len(_ENROLL_POSE_KEYS)

_ENROLL_LABELS_VN: dict[str, str] = {
    "center": "chính diện",
    "left": "trái",
    "right": "phải",
}

_ENROLL_HINTS_VN: dict[str, str] = {
    "center": "Bước 1/3: Nhìn thẳng (chính diện) — giữ hướng nhìn ổn định theo mũi tên cho đến khi đủ thời gian và số khung.",
    "left": "Bước 2/3: Hướng nhìn sang TRÁI (cơ thể bạn); giữ liên tục đủ vài giây và đủ khung.",
    "right": "Bước 3/3: Hướng nhìn sang PHẢI; giữ ổn định như bước trước.",
}


def _enroll_adjust_gaze_for_mirror(pitch: float, yaw: float, flip_yaw: bool, flip_pitch: bool) -> tuple[float, float]:
    """Tuỳ chọn: chỉnh góc khi ảnh webcam đã mirror so với video demo.

    `service/inference.py` + `l2cs/vis.render` dùng thẳng output `predict_gaze` — đó là chuẩn tham chiếu.
    Công thức `draw_gaze`: dx từ tham số thứ nhất, dy từ thứ hai. Mirror ngang (scaleX -1) tương đương
    đảo dấu thành phần ngang → đảo tham số thứ nhất nếu bật *flip_yaw*. *flip_pitch* chỉ khi thật sự cần đảo dọc.
    *flip_yaw*: đảo tham số thứ nhất của L2CS (thành phần ngang trong dx). Chỉ bật khi trái/phải trên UI
    vẫn ngược so với nhìn từ camera; mặc định tắt vì nhiều setup đã khớp khi gửi frame mirror.
    """
    p = float(pitch)
    y = float(yaw)
    if flip_yaw:
        p = -p
    if flip_pitch:
        y = -y
    return p, y


def _proctoring_pitchyaw_from_raw(
    app: Any,
    pitch_raw: float,
    yaw_raw: float,
) -> tuple[float, float]:
    """Góc đưa vào _pitchyaw_to_dxdy: mặc định chỉnh mirror ngang cho webcam; ENROLL_POSE_FLIP_* để tinh chỉnh."""
    fy = bool(getattr(app.state, "enroll_pose_flip_yaw", True))
    fp = bool(getattr(app.state, "enroll_pose_flip_pitch", False))
    if not fy and not fp:
        return float(pitch_raw), float(yaw_raw)
    return _enroll_adjust_gaze_for_mirror(pitch_raw, yaw_raw, fy, fp)


def _coverage_from_step_index(step_idx: int) -> dict[str, bool]:
    """step_idx: bước đang làm (0..n-1); các bước 0..step_idx-1 đã xong. step_idx==n → đã xong cả n bước."""
    s = max(0, min(_ENROLL_STEPS_N, int(step_idx)))
    return {k: (i < s) for i, k in enumerate(_ENROLL_POSE_KEYS)}


def _enroll_remaining_labels_vn(step_idx: int) -> list[str]:
    s = max(0, min(_ENROLL_STEPS_N, int(step_idx)))
    return [_ENROLL_LABELS_VN[k] for k in _ENROLL_POSE_KEYS[s:]]


def _enroll_target_satisfied(
    target: str,
    pitch: float,
    yaw: float,
    center_max: float,
    yaw_min: float,
    pitch_min: float,
) -> bool:
    """Fallback khi không có bbox hợp lệ: pitch/yaw thô (ưu tiên dùng _enroll_gaze_direction_matches khi thi)."""
    p = float(pitch)
    y = float(yaw)
    if target == "center":
        return abs(y) <= float(center_max) and abs(p) <= float(center_max)
    if target == "left":
        if abs(p) > float(pitch_min) * 2.8:
            return False
        return y <= -float(yaw_min)
    if target == "right":
        if abs(p) > float(pitch_min) * 2.8:
            return False
        return y >= float(yaw_min)
    return False


# Nhãn từ _direction_from_dxdy — cùng hệ thống với mũi tên / popup lúc thi.
_ENROLL_GAZE_ACCEPT_LABELS: dict[str, frozenset[str]] = {
    "center": frozenset({"Chính diện"}),
    "left": frozenset({"Nhìn trái", "Nhìn trái lên", "Nhìn trái xuống"}),
    "right": frozenset({"Nhìn phải", "Nhìn phải lên", "Nhìn phải xuống"}),
}


def _enroll_gaze_direction_matches(
    target: str,
    pitch: float,
    yaw: float,
    bbox: list[float],
    direction_threshold_frac: float,
) -> bool:
    """Định danh theo **hướng nhìn** (vector gaze → dx/dy → cùng ngưỡng lúc thi)."""
    bb_w = float(bbox[2]) - float(bbox[0])
    if bb_w <= 1.0:
        return False
    dx, dy = _pitchyaw_to_dxdy(float(pitch), float(yaw))
    dx_px = dx * bb_w
    dy_px = dy * bb_w
    label = _direction_from_dxdy(dx_px, dy_px, bb_w, float(direction_threshold_frac))
    acc = _ENROLL_GAZE_ACCEPT_LABELS.get(target)
    return acc is not None and label in acc


def _decode_base64_image_to_bgr(image_base64: str) -> np.ndarray:
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from e

    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    return img


def _parse_device(device_str: str) -> torch.device:
    s = (device_str or "cpu").strip().lower()
    if s == "cpu":
        return torch.device("cpu")
    if s in {"cuda", "gpu"}:
        return torch.device("cuda:0")
    if s.startswith("cuda:"):
        return torch.device(s)
    return torch.device(device_str)

def _resolve_weights_path(weights: str) -> str:
    """
    Resolve weights path robustly regardless of current working directory.
    - If env gives absolute path: use it.
    - If relative: try CWD, then service/, then repo-root/.
    """
    if not weights:
        return weights
    if os.path.isabs(weights):
        return weights

    # try as-is (relative to current working directory)
    if os.path.exists(weights):
        return weights

    service_dir = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.join(service_dir, weights)
    if os.path.exists(candidate):
        return candidate

    repo_root = os.path.dirname(service_dir)
    candidate = os.path.join(repo_root, weights)
    if os.path.exists(candidate):
        return candidate

    return weights


@asynccontextmanager
async def lifespan(app: FastAPI):
    weights = _resolve_weights_path(os.getenv("PROCTORING_WEIGHTS", "models/L2CSNet_gaze360.pkl"))
    arch = os.getenv("PROCTORING_ARCH", "ResNet50")
    device = _parse_device(os.getenv("PROCTORING_DEVICE", "cpu"))
    confidence_threshold = float(os.getenv("PROCTORING_FACE_CONFIDENCE", "0.5"))
    app.state.detect_every_n = max(1, _env_int("PROCTORING_DETECT_EVERY_N", 10))
    app.state.arrow_multiplier = _env_float("PROCTORING_ARROW_MULTIPLIER", 4.0)
    app.state.cheat_threshold_rad = _env_float("PROCTORING_CHEAT_THRESHOLD_RAD", 0.35)
    # Góc tối thiểu (rad) mới coi là "lệch quá mức".
    # Giảm mặc định để popup ổn định hơn khi gaze jitter / crop kém.
    app.state.looking_away_rad = _env_float("PROCTORING_LOOKING_AWAY_RAD", 0.52)
    # Giữ trạng thái lệch "đủ lâu" mới báo vi phạm looking_away.
    # Giảm mặc định để khớp thực tế: thí sinh nhìn lệch lâu vẫn phải thấy popup.
    app.state.looking_away_min_sec = max(0.0, _env_float("PROCTORING_LOOKING_AWAY_MIN_SEC", 8.0))
    # Nếu gaze thỉnh thoảng bị đọc ngược (geo False) trong lúc đang lệch,
    # cho phép sai lệch trong thời gian ngắn rồi mới reset streak.
    app.state.looking_away_false_grace_sec = max(
        0.0, _env_float("PROCTORING_LOOKING_AWAY_FALSE_GRACE_SEC", 2.0)
    )
    app.state._looking_away_since = {}  # key: MSSV hoặc "anon" -> monotonic() lúc bắt đầu lệch
    # Đã gửi violation looking_away cho lượt lệch hiện tại — reset khi nhìn lại / mất mặt; mỗi lượt 1 popup + 1 ảnh (tại boundary PROCTORING_LOOKING_AWAY_MIN_SEC).
    app.state._looking_away_violation_emitted = {}
    # Khi đang lệch mà bị đọc ngược (geo False) do jitter/crop, cho phép sai lệch trong thời gian ngắn.
    # false_since: key (MSSV/anon) -> thời điểm bắt đầu "false streak".
    app.state._looking_away_false_since = {}
    app.state._no_face_since = {}
    app.state._no_face_emitted = {}
    app.state._multi_face_since = {}
    app.state._multi_face_emitted = {}
    # Used only as fallback when bbox not available
    app.state.direction_threshold_deg = _env_float("PROCTORING_DIRECTION_THRESHOLD_DEG", 6.0)
    # Deadzone nhãn hướng (so với bbox width): tăng nhẹ so với 0.15 để bớt nhảy trái lên / trái xuống do nhiễu.
    app.state.direction_threshold_frac = _env_float("PROCTORING_DIRECTION_THRESHOLD_FRAC", 0.2)
    app.state.max_faces = max(1, _env_int("PROCTORING_MAX_FACES", 1))
    app.state.track_iou_threshold = _env_float("PROCTORING_TRACK_IOU_THRESHOLD", 0.30)
    app.state.track_max_misses = max(0, _env_int("PROCTORING_TRACK_MAX_MISSES", 15))
    _enroll_thr_hard = _env_float("PROCTORING_ENROLL_MATCH_THRESHOLD", 0.42)
    _enroll_thr_soft_in = _env_float("PROCTORING_ENROLL_MATCH_THRESHOLD_SOFT", 0.32)
    app.state.enroll_match_threshold = _enroll_thr_hard
    # “Mềm” luôn < hard (một mặt trong khung); giảm false negative MSSV khi sáng/crop lệch.
    app.state.enroll_match_threshold_soft = max(0.22, min(_enroll_thr_soft_in, _enroll_thr_hard - 0.01))
    # Ngưỡng pose (rad) cho enroll đa góc — L2CS pitch/yaw.
    # Mặc định thoáng hơn để định danh nhanh; siết bằng env khi cần.
    app.state.enroll_pose_center_max_rad = _env_float("ENROLL_POSE_CENTER_MAX_RAD", 0.14)
    app.state.enroll_pose_yaw_min_rad = _env_float("ENROLL_POSE_YAW_MIN_RAD", 0.12)
    app.state.enroll_pose_pitch_min_rad = _env_float("ENROLL_POSE_PITCH_MIN_RAD", 0.09)
    # Nhiều webcam + pipeline L2CS: đảo ngang (p) làm trái/phải lệch. Mặc định 0; nếu nhìn trái mà hệ thống báo phải (hoặc ngược lại), thử 1.
    _fy = os.getenv("ENROLL_POSE_FLIP_YAW", "0") or "0"
    app.state.enroll_pose_flip_yaw = str(_fy).strip().lower() in ("1", "true", "yes")
    _fp = os.getenv("ENROLL_POSE_FLIP_PITCH", "0") or "0"
    app.state.enroll_pose_flip_pitch = str(_fp).strip().lower() in ("1", "true", "yes")
    # Enroll: cùng hướng nhìn với thi; đủ thời gian giữ + đủ khung (liên tục).
    app.state.enroll_gaze_dwell_sec = max(0.25, _env_float("ENROLL_GAZE_DWELL_SEC", 1.15))
    app.state.enroll_pose_min_good_frames = max(1, _env_int("ENROLL_POSE_MIN_GOOD_FRAMES", 6))
    app.state.enrolled_student_id = None
    app.state.enrolled_hist = None
    app.state.enrolled_hist_samples = 0
    app.state._enroll_seq_by_student = {}
    app.state._last_enrolled_bbox_idx = None
    app.state._frame_counter = 0
    app.state._last_bboxes = None
    app.state._last_ids = None  # list[int] aligned with _last_bboxes
    app.state._next_face_id = 1
    app.state._tracks = []  # stable IDs across misses
    app.state._lock = threading.Lock()
    # Làm mượt gaze (0 = tắt; 0.35–0.6 thường hợp lý) — giảm nhảy nhãn/mũi tên giữa các frame HTTP.
    app.state.proctoring_gaze_smooth_alpha = max(
        0.0, min(1.0, _env_float("PROCTORING_GAZE_SMOOTH_ALPHA", 0.5))
    )
    app.state._gaze_smooth_state = {}  # key "{sid}:{track_id}" -> (pitch, yaw)

    if not os.path.exists(weights):
        # Don't fail server startup; return 503 on inference until weights exist.
        app.state.gaze_pipeline = None
        app.state.gaze_weights_path = weights
        app.state.gaze_load_error = (
            f"Missing weights file: '{weights}'. "
            "Set PROCTORING_WEIGHTS to an absolute path, or put weights at "
            "'service/models/L2CSNet_gaze360.pkl' (run from service/) or 'models/L2CSNet_gaze360.pkl' (run from repo root)."
        )
        yield
        return

    try:
        app.state.gaze_pipeline = Pipeline(
            weights=weights,
            arch=arch,
            device=device,
            include_detector=True,
            confidence_threshold=confidence_threshold,
        )
        app.state.gaze_weights_path = weights
        app.state.gaze_load_error = None
    except Exception as e:  # noqa: BLE001
        app.state.gaze_pipeline = None
        app.state.gaze_weights_path = weights
        app.state.gaze_load_error = f"Failed to load model: {e}"
    yield


app = FastAPI(title="Proctoring Gaze Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    ok = getattr(app.state, "gaze_pipeline", None) is not None
    weights = getattr(app.state, "gaze_weights_path", "")
    err = getattr(app.state, "gaze_load_error", None)
    return {
        "status": "ok",
        "model_loaded": "true" if ok else "false",
        "weights_path": str(weights),
        "error": "" if not err else str(err),
        "enrolled_student_id": str(getattr(app.state, "enrolled_student_id", "") or ""),
    }


@app.post("/proctoring/enroll", response_model=EnrollResponse)
def enroll(payload: EnrollRequest) -> EnrollResponse:
    gaze_pipeline: Optional[Pipeline] = getattr(app.state, "gaze_pipeline", None)
    if gaze_pipeline is None:
        err = getattr(app.state, "gaze_load_error", None)
        raise HTTPException(status_code=503, detail=str(err or "Model not initialized"))

    sid = payload.student_id.strip()
    frame_bgr = _decode_base64_image_to_bgr(payload.image_base64)
    faces_det = gaze_pipeline.detector(frame_bgr) if getattr(gaze_pipeline, "include_detector", True) else None

    def _seq_snapshot() -> tuple[dict[str, bool], int, bool, list[str], str | None, str]:
        lock_s: threading.Lock = getattr(app.state, "_lock")
        with lock_s:
            seq_map_s = getattr(app.state, "_enroll_seq_by_student", None)
            if not isinstance(seq_map_s, dict):
                seq_map_s = {}
            st_s = seq_map_s.get(sid)
            if isinstance(st_s, dict):
                step_i = max(0, min(_ENROLL_STEPS_N, int(st_s.get("step", 0))))
            else:
                step_i = 0
        cov_s = _coverage_from_step_index(step_i)
        comp_s = step_i >= _ENROLL_STEPS_N
        miss_s = _enroll_remaining_labels_vn(step_i)
        tk_s = None if step_i >= _ENROLL_STEPS_N else _ENROLL_POSE_KEYS[step_i]
        hint_s = _ENROLL_HINTS_VN[tk_s] if tk_s else "Đã đủ các góc."
        return cov_s, step_i, comp_s, miss_s, tk_s, hint_s

    if faces_det is None or len(faces_det) == 0:
        cov, step_idx, complete, missing, tk, hint_vn = _seq_snapshot()
        return EnrollResponse(
            enrolled=False,
            student_id=sid,
            detail="No face found to enroll",
            pitch_rad=None,
            yaw_rad=None,
            pose_coverage=cov,
            pose_complete=complete,
            pose_missing=missing,
            enroll_step_index=step_idx,
            enroll_step_total=len(_ENROLL_POSE_KEYS),
            enroll_target_key=tk,
            enroll_hint_vn=hint_vn,
        )

    # pick best score
    best = max(faces_det, key=lambda x: float(x[2]))
    bbox = [float(v) for v in best[0]]
    gray112 = _crop_face_gray_112(frame_bgr, bbox)
    if gray112 is None:
        cov, step_idx, complete, missing, tk, hint_vn = _seq_snapshot()
        return EnrollResponse(
            enrolled=False,
            student_id=sid,
            detail="Invalid face crop",
            pitch_rad=None,
            yaw_rad=None,
            pose_coverage=cov,
            pose_complete=complete,
            pose_missing=missing,
            enroll_step_index=step_idx,
            enroll_step_total=len(_ENROLL_POSE_KEYS),
            enroll_target_key=tk,
            enroll_hint_vn=hint_vn,
        )

    pitch_raw: float | None = None
    yaw_raw: float | None = None
    try:
        p_arr, y_arr = _predict_from_bboxes(gaze_pipeline, frame_bgr, np.array([bbox], dtype=np.float32))
        if p_arr.size > 0 and np.isfinite(p_arr[0, 0]) and np.isfinite(y_arr[0, 0]):
            pitch_raw = float(p_arr[0, 0])
            yaw_raw = float(y_arr[0, 0])
    except Exception:
        pass

    adj_pitch: float | None = None
    adj_yaw: float | None = None
    if pitch_raw is not None and yaw_raw is not None:
        adj_pitch, adj_yaw = _proctoring_pitchyaw_from_raw(app, pitch_raw, yaw_raw)

    hist = _face_hist(gray112)
    lock: threading.Lock = getattr(app.state, "_lock")
    with lock:
        seq_map = getattr(app.state, "_enroll_seq_by_student", None)
        if not isinstance(seq_map, dict):
            seq_map = {}

        # Cộng dồn/average histogram từ nhiều ảnh để định danh bền hơn.
        # Khi student_id đổi, reset bộ tích lũy.
        prev_student_id = getattr(app.state, "enrolled_student_id", None)
        prev_samples = int(getattr(app.state, "enrolled_hist_samples", 0) or 0)

        if prev_student_id != sid:
            prev_samples = 0

        if prev_samples <= 0 or getattr(app.state, "enrolled_hist", None) is None:
            seq_map[sid] = {"step": 0, "step_good": 0, "gaze_ok_since": None}
            app.state.enrolled_hist = hist
            prev_samples = 1
        else:
            prev_hist = getattr(app.state, "enrolled_hist")
            # Weighted average: (prev_hist * n + hist) / (n + 1)
            app.state.enrolled_hist = (prev_hist.astype(np.float32) * prev_samples + hist.astype(np.float32)) / (prev_samples + 1)
            prev_samples = prev_samples + 1
            if sid not in seq_map or not isinstance(seq_map.get(sid), dict):
                seq_map[sid] = {"step": 0, "step_good": 0, "gaze_ok_since": None}

        st = seq_map.get(sid)
        if not isinstance(st, dict):
            st = {"step": 0, "step_good": 0, "gaze_ok_since": None}
        step_idx = max(0, min(_ENROLL_STEPS_N, int(st.get("step", 0))))
        step_good = max(0, int(st.get("step_good", 0)))
        gaze_ok_since_raw = st.get("gaze_ok_since")
        gaze_ok_since: float | None
        if gaze_ok_since_raw is None:
            gaze_ok_since = None
        else:
            try:
                gaze_ok_since = float(gaze_ok_since_raw)
            except (TypeError, ValueError):
                gaze_ok_since = None

        direction_frac = float(getattr(app.state, "direction_threshold_frac", 0.15))
        center_max = float(getattr(app.state, "enroll_pose_center_max_rad", 0.14))
        yaw_min = float(getattr(app.state, "enroll_pose_yaw_min_rad", 0.12))
        pitch_min = float(getattr(app.state, "enroll_pose_pitch_min_rad", 0.09))

        if adj_pitch is not None and adj_yaw is not None and step_idx < _ENROLL_STEPS_N:
            target = _ENROLL_POSE_KEYS[step_idx]
            dwell_need = float(getattr(app.state, "enroll_gaze_dwell_sec", 1.15))
            min_good = max(1, int(getattr(app.state, "enroll_pose_min_good_frames", 6)))
            bb_w = float(bbox[2]) - float(bbox[0])
            if bb_w > 1.0:
                matches = _enroll_gaze_direction_matches(target, adj_pitch, adj_yaw, bbox, direction_frac)
            else:
                matches = _enroll_target_satisfied(
                    target, adj_pitch, adj_yaw, center_max, yaw_min, pitch_min
                )

            if matches:
                step_good += 1
                now = time.monotonic()
                if gaze_ok_since is None:
                    gaze_ok_since = now
                dwell = now - gaze_ok_since
                can_advance = step_good >= min_good and dwell >= dwell_need
                if can_advance:
                    step_idx += 1
                    step_good = 0
                    gaze_ok_since = None
            else:
                step_good = 0
                gaze_ok_since = None

        seq_map[sid] = {
            "step": step_idx,
            "step_good": step_good,
            "gaze_ok_since": gaze_ok_since,
        }
        app.state._enroll_seq_by_student = seq_map
        app.state.enrolled_student_id = sid
        app.state.enrolled_hist_samples = prev_samples
        app.state._last_enrolled_bbox_idx = None

        cov_final = _coverage_from_step_index(step_idx)
        pose_complete = step_idx >= _ENROLL_STEPS_N
        pose_missing = _enroll_remaining_labels_vn(step_idx)
        target_key = None if step_idx >= _ENROLL_STEPS_N else _ENROLL_POSE_KEYS[step_idx]
        hint_vn = _ENROLL_HINTS_VN[target_key] if target_key else "Đã đủ các góc. Hoàn tất định danh."

    return EnrollResponse(
        enrolled=True,
        student_id=sid,
        detail="Enrolled",
        pitch_rad=adj_pitch,
        yaw_rad=adj_yaw,
        pose_coverage=cov_final,
        pose_complete=pose_complete,
        pose_missing=pose_missing,
        enroll_step_index=step_idx,
        enroll_step_total=len(_ENROLL_POSE_KEYS),
        enroll_target_key=target_key,
        enroll_hint_vn=hint_vn,
    )


@app.post("/proctoring/reset")
def reset_proctoring(payload: ResetRequest | None = None) -> dict[str, Any]:
    req_sid = ""
    if payload and isinstance(payload.student_id, str):
        req_sid = payload.student_id.strip()

    lock: threading.Lock = getattr(app.state, "_lock")
    with lock:
        # Reset enrolled identity state for this student (or all when no sid provided).
        cur_sid = getattr(app.state, "enrolled_student_id", None)
        if not req_sid or (isinstance(cur_sid, str) and cur_sid.strip() == req_sid):
            app.state.enrolled_student_id = None
            app.state.enrolled_hist = None
            app.state.enrolled_hist_samples = 0
            app.state._last_enrolled_bbox_idx = None

        seq_map_reset = getattr(app.state, "_enroll_seq_by_student", None)
        if isinstance(seq_map_reset, dict):
            if req_sid:
                seq_map_reset.pop(req_sid, None)
            else:
                seq_map_reset.clear()
            app.state._enroll_seq_by_student = seq_map_reset

        # Clear per-student dwell/emit states so logout starts a fresh lượt.
        for key_name in (
            "_looking_away_since",
            "_looking_away_false_since",
            "_looking_away_violation_emitted",
            "_no_face_since",
            "_no_face_emitted",
            "_multi_face_since",
            "_multi_face_emitted",
        ):
            raw = getattr(app.state, key_name, None)
            if isinstance(raw, dict):
                d = dict(raw)
                if req_sid:
                    d.pop(req_sid, None)
                else:
                    d.clear()
                setattr(app.state, key_name, d)

    return {"status": "ok", "student_id": req_sid or None}


@app.post("/gaze/estimate", response_model=GazeEstimateResponse)
def gaze_estimate(payload: GazeEstimateRequest) -> GazeEstimateResponse:
    request_student_id = (payload.student_id or "").strip() if isinstance(payload.student_id, str) else ""
    image_b64 = payload.image_base64.strip() if isinstance(payload.image_base64, str) else ""
    if not image_b64:
        # Behavior: no frame
        return GazeEstimateResponse(
            faces=[],
            faces_count=0,
            annotated_image_base64=None,
            violation=True,
            violation_type="no_frame",
            message="Không có ảnh từ camera.",
        )

    frame_bgr = _decode_base64_image_to_bgr(image_b64)

    gaze_pipeline: Optional[Pipeline] = getattr(app.state, "gaze_pipeline", None)
    if gaze_pipeline is None:
        err = getattr(app.state, "gaze_load_error", None)
        raise HTTPException(status_code=503, detail=str(err or "Model not initialized"))

    lock: threading.Lock = getattr(app.state, "_lock")
    with lock:
        app.state._frame_counter = int(getattr(app.state, "_frame_counter", 0)) + 1
        frame_idx = int(app.state._frame_counter)
        last_bboxes = getattr(app.state, "_last_bboxes", None)

    detect_every_n: int = int(getattr(app.state, "detect_every_n", 10))
    arrow_multiplier: float = float(getattr(app.state, "arrow_multiplier", 4.0))
    looking_away_rad: float = float(getattr(app.state, "looking_away_rad", 0.45))
    looking_away_min_sec: float = float(getattr(app.state, "looking_away_min_sec", 8.0))
    looking_away_false_grace_sec: float = float(
        getattr(app.state, "looking_away_false_grace_sec", 2.0)
    )
    direction_threshold_deg: float = float(getattr(app.state, "direction_threshold_deg", 6.0))
    direction_threshold_frac: float = float(getattr(app.state, "direction_threshold_frac", 0.15))
    max_faces: int = int(getattr(app.state, "max_faces", 1))
    track_iou_threshold: float = float(getattr(app.state, "track_iou_threshold", 0.30))
    track_max_misses: int = int(getattr(app.state, "track_max_misses", 15))
    do_detect = (frame_idx % detect_every_n == 1) or last_bboxes is None

    faces: list[dict[str, Any]] = []
    if do_detect:
        # Detection only (RetinaFace). We'll run gaze only for the enrolled face.
        faces_det = gaze_pipeline.detector(frame_bgr)
        if faces_det is None:
            faces_det = []

        # apply confidence threshold and collect boxes
        det_boxes: list[list[float]] = []
        det_scores: list[float] = []
        for box, _landmark, score in faces_det:
            if float(score) < float(getattr(gaze_pipeline, "confidence_threshold", 0.5)):
                continue
            det_boxes.append([float(v) for v in box])
            det_scores.append(float(score))

        bboxes_arr = np.array(det_boxes, dtype=np.float32) if len(det_boxes) > 0 else np.empty((0, 4), dtype=np.float32)
        new_bboxes: list[list[float]] = det_boxes

        with lock:
            tracks = _tracks_from_state(app)
            next_id = int(getattr(app.state, "_next_face_id", 1))
            tracks, new_ids, next_id = _update_tracks_with_detections(
                tracks=tracks,
                new_bboxes=new_bboxes,
                next_id=next_id,
                iou_threshold=track_iou_threshold,
                max_misses=track_max_misses,
            )
            app.state._next_face_id = next_id
            _save_tracks_to_state(app, tracks)
            app.state._last_bboxes = bboxes_arr
            app.state._last_ids = new_ids
            app.state._last_enrolled_bbox_idx = None

        # Build face list (bbox + track id). No gaze yet.
        for i, bb in enumerate(new_bboxes):
            f: dict[str, Any] = {"bbox": bb}
            if i < len(getattr(app.state, "_last_ids", []) or []):
                f["id"] = int(app.state._last_ids[i])
            if i < len(det_scores):
                f["score"] = float(det_scores[i])
            faces.append(f)
    else:
        bboxes = last_bboxes
        ids = getattr(app.state, "_last_ids", None)
        if isinstance(bboxes, np.ndarray) and bboxes.size > 0:
            # Reuse bboxes; no gaze for non-enrolled faces
            for i in range(int(bboxes.shape[0])):
                bb = [float(x) for x in bboxes[i].tolist()]
                f: dict[str, Any] = {"bbox": bb}
                if isinstance(ids, list) and i < len(ids):
                    f["id"] = int(ids[i])
                faces.append(f)

    # ---- Enrolled face selection + gaze only for that face ----
    enrolled_student_id = getattr(app.state, "enrolled_student_id", None)
    enrolled_hist = getattr(app.state, "enrolled_hist", None)
    enroll_match_threshold: float = float(getattr(app.state, "enroll_match_threshold", 0.42))
    enroll_match_threshold_soft: float = float(getattr(app.state, "enroll_match_threshold_soft", 0.32))

    _enr_stored = (enrolled_student_id.strip() if isinstance(enrolled_student_id, str) else "")
    _req_sid = request_student_id.strip() if request_student_id else ""
    _hist_owner_ok = _hist_owner_matches_request(_enr_stored, request_student_id or "")

    selected_idx: int | None = None
    enrolled_face_matched: bool = False  # True chỉ khi có mặt khớp histogram định danh (>= ngưỡng)
    if _enr_stored != "" and isinstance(enrolled_hist, np.ndarray) and _hist_owner_ok:
        best_sim = -1.0
        best_i = -1
        for i, f in enumerate(faces):
            bb = f.get("bbox")
            if not (isinstance(bb, list) and len(bb) >= 4):
                continue
            gray112 = _crop_face_gray_112(frame_bgr, bb)
            if gray112 is None:
                continue
            sim = _hist_similarity(_face_hist(gray112), enrolled_hist)
            if sim > best_sim:
                best_sim = sim
                best_i = i

        if best_i != -1:
            selected_idx = best_i
            single_face_ok = len(faces) == 1 and max_faces <= 1
            if best_sim >= enroll_match_threshold:
                enrolled_face_matched = True
            elif single_face_ok and best_sim >= enroll_match_threshold_soft:
                enrolled_face_matched = True
            if enrolled_face_matched:
                with lock:
                    app.state._last_enrolled_bbox_idx = int(best_i)
        else:
            selected_idx = None
    else:
        # Not enrolled: fall back to first face for gaze
        selected_idx = 0 if len(faces) > 0 else None

    geo_looking_away: bool | None = None
    if selected_idx is not None and 0 <= selected_idx < len(faces):
        bb = faces[selected_idx].get("bbox")
        if isinstance(bb, list) and len(bb) >= 4:
            # Run gaze for this bbox only
            pitch_arr, yaw_arr = _predict_from_bboxes(gaze_pipeline, frame_bgr, np.array([bb], dtype=np.float32))
            if np.isfinite(pitch_arr[0]).all() and np.isfinite(yaw_arr[0]).all():
                pitch_raw = float(pitch_arr[0])
                yaw_raw = float(yaw_arr[0])
                # Góc predict_gaze + EMA; ENROLL_POSE_FLIP_YAW=1 nếu trái/phải vẫn ngược so với camera.
                tid_raw = faces[selected_idx].get("id")
                track_id = int(tid_raw) if isinstance(tid_raw, int) else 0
                sk_sm = (_req_sid or _enr_stored or "anon").strip() or "anon"
                smooth_key = f"{sk_sm}:{track_id}"
                alpha = float(getattr(app.state, "proctoring_gaze_smooth_alpha", 0.0))
                lock_sm = getattr(app.state, "_lock")
                with lock_sm:
                    smap = getattr(app.state, "_gaze_smooth_state", None)
                    if not isinstance(smap, dict):
                        smap = {}
                    prev = smap.get(smooth_key)
                    if alpha <= 0.0 or prev is None:
                        p_s, y_s = pitch_raw, yaw_raw
                    else:
                        p_s = alpha * pitch_raw + (1.0 - alpha) * float(prev[0])
                        y_s = alpha * yaw_raw + (1.0 - alpha) * float(prev[1])
                    smap[smooth_key] = (p_s, y_s)
                    app.state._gaze_smooth_state = smap
                pitch, yaw = _proctoring_pitchyaw_from_raw(app, p_s, y_s)
                dx, dy = _pitchyaw_to_dxdy(pitch, yaw)
                bbox_width = float(bb[2] - bb[0])
                dx_px = dx * bbox_width
                dy_px = dy * bbox_width
                dir_label = _direction_from_dxdy(
                    dx_px, dy_px, bbox_width, direction_threshold_frac
                )
                # Lệch theo góc lớn — nhưng «Chính diện» (deadzone mũi tên) không tính vi phạm nhìn lệch.
                geo_looking_away = bool(
                    (abs(pitch) > looking_away_rad or abs(yaw) > looking_away_rad)
                    and dir_label != "Chính diện"
                )
                faces[selected_idx].update(
                    {
                        "theta": pitch,
                        "phi": yaw,
                        "dx": dx,
                        "dy": dy,
                        "dx_px": dx_px,
                        "dy_px": dy_px,
                        "direction": dir_label,
                        "looking_away": False,
                    }
                )

    # Chỉ gán MSSV lên mặt đã chọn khi đã khớp định danh (histogram); khi gaze NaN vẫn gán để popup/ảnh có MSSV đúng.
    mssv_for_face = (_req_sid or _enr_stored).strip()
    if enrolled_face_matched and selected_idx is not None and 0 <= selected_idx < len(faces) and mssv_for_face:
        faces[selected_idx]["id"] = mssv_for_face

    faces_count = len(faces)

    # Thời gian lệch liên tục (HTTP mỗi frame; lưu monotonic trên server theo MSSV)
    sid_key = _req_sid or _enr_stored
    state_key = sid_key if sid_key else "anon"
    # Bộ đếm looking_away_min_sec (mặc định 8s): chỉ reset khi mất mặt hoặc gaze chắc chắn KHÔNG lệch (geo False).
    # Frame gaze NaN/None trước đây làm pop timer → không bao giờ đủ thời gian + không set looking_away → mất popup/ảnh.
    looking_away_sustained = False
    emit_looking_away_violation = False
    emit_no_face = False
    emit_multi_face = False
    with lock:
        store_raw = getattr(app.state, "_looking_away_since", None)
        store: dict[str, float] = dict(store_raw) if isinstance(store_raw, dict) else {}
        false_raw = getattr(app.state, "_looking_away_false_since", None)
        false_since: dict[str, float] = dict(false_raw) if isinstance(false_raw, dict) else {}
        emitted_raw = getattr(app.state, "_looking_away_violation_emitted", None)
        emitted: dict[str, bool] = dict(emitted_raw) if isinstance(emitted_raw, dict) else {}
        now = time.monotonic()
        if faces_count == 0:
            store.pop(state_key, None)
            false_since.pop(state_key, None)
            emitted.pop(state_key, None)
        elif geo_looking_away is True:
            false_since.pop(state_key, None)
            t0 = store.get(state_key)
            if t0 is None:
                store[state_key] = now
                looking_away_sustained = False
            else:
                looking_away_sustained = (now - t0) >= looking_away_min_sec
        elif geo_looking_away is False:
            # Khi đang lệch mà bị đọc ngược 1 vài frame (geo False) do crop/gaze jitter,
            # không reset ngay; chỉ reset nếu False kéo dài quá ngưỡng.
            if state_key in store:
                if state_key not in false_since:
                    false_since[state_key] = now
                if (now - false_since[state_key]) >= looking_away_false_grace_sec:
                    store.pop(state_key, None)
                    false_since.pop(state_key, None)
                    emitted.pop(state_key, None)
            t0 = store.get(state_key)
            looking_away_sustained = t0 is not None and (now - t0) >= looking_away_min_sec
        else:
            # geo_looking_away is None — giữ mốc thời gian, thời thực vẫn trôi
            # (đồng thời xóa cờ "false streak" nếu từng bị đọc ngược trước đó).
            false_since.pop(state_key, None)
            t0 = store.get(state_key)
            looking_away_sustained = t0 is not None and (now - t0) >= looking_away_min_sec
        app.state._looking_away_since = store
        app.state._looking_away_false_since = false_since

        # Một lần vi phạm / một ảnh mỗi lượt: frame tại boundary đủ looking_away_min_sec.
        if (
            looking_away_sustained
            and not emitted.get(state_key, False)
            and faces_count > 0
            and faces_count <= max_faces
        ):
            emit_looking_away_violation = True
            emitted[state_key] = True
        app.state._looking_away_violation_emitted = emitted

        # no_face / multi_face: cùng thời gian chờ như looking_away; 1 violation + 1 ảnh mỗi lượt tình huống.
        viol_dwell = float(looking_away_min_sec)
        nf_sr = getattr(app.state, "_no_face_since", None)
        nf_since: dict[str, float] = dict(nf_sr) if isinstance(nf_sr, dict) else {}
        nf_er = getattr(app.state, "_no_face_emitted", None)
        nf_emitted: dict[str, bool] = dict(nf_er) if isinstance(nf_er, dict) else {}
        mf_sr = getattr(app.state, "_multi_face_since", None)
        mf_since: dict[str, float] = dict(mf_sr) if isinstance(mf_sr, dict) else {}
        mf_er = getattr(app.state, "_multi_face_emitted", None)
        mf_emitted: dict[str, bool] = dict(mf_er) if isinstance(mf_er, dict) else {}

        if faces_count == 0:
            if state_key not in nf_since:
                nf_since[state_key] = now
            if (now - nf_since[state_key]) >= viol_dwell and not nf_emitted.get(state_key, False):
                emit_no_face = True
                nf_emitted[state_key] = True
            mf_since.pop(state_key, None)
            mf_emitted.pop(state_key, None)
        elif faces_count > max_faces:
            nf_since.pop(state_key, None)
            nf_emitted.pop(state_key, None)
            if state_key not in mf_since:
                mf_since[state_key] = now
            if (now - mf_since[state_key]) >= viol_dwell and not mf_emitted.get(state_key, False):
                emit_multi_face = True
                mf_emitted[state_key] = True
        else:
            nf_since.pop(state_key, None)
            nf_emitted.pop(state_key, None)
            mf_since.pop(state_key, None)
            mf_emitted.pop(state_key, None)

        app.state._no_face_since = nf_since
        app.state._no_face_emitted = nf_emitted
        app.state._multi_face_since = mf_since
        app.state._multi_face_emitted = mf_emitted

    if selected_idx is not None and 0 <= selected_idx < len(faces):
        # Dùng theo streak đã tính (looking_away_sustained) để popup/message nhất quán,
        # kể cả khi geo_looking_away thỉnh thoảng bị đọc ngược ngắn.
        faces[selected_idx]["looking_away"] = bool(looking_away_sustained)

    # Violation logic — thí sinh định danh (MSSV + hướng/lệch); nhiều người: báo số người + vẫn mô tả thí sinh
    def line_enrolled_only(f: dict[str, Any]) -> str | None:
        fid = f.get("id")
        if not (isinstance(fid, str) and fid.strip()):
            return None
        direction = str(f.get("direction") or "—")
        away = " (lệch)" if bool(f.get("looking_away")) else ""
        return f"{fid.strip()}: {direction}{away}"

    enrolled_lines = [x for x in (line_enrolled_only(f) for f in faces) if x]
    directions_all = [str(f.get("direction") or "") for f in faces]
    directions_all = [d for d in directions_all if d.strip() != ""]
    directions_msg = ", ".join(directions_all)

    violation_type = "ok"
    violation = False
    message = "OK"

    if faces_count == 0:
        if emit_no_face:
            violation = True
            violation_type = "no_face"
            message = "Không phát hiện khuôn mặt trong khung hình."
        else:
            violation = False
            violation_type = "ok"
            message = "OK"
    elif faces_count > max_faces:
        multi_prefix = f"Phát hiện {faces_count} người trong khung hình."
        if emit_multi_face:
            violation = True
            violation_type = "multi_face"
            if enrolled_lines:
                message = multi_prefix + "\n" + "\n".join(enrolled_lines)
            elif selected_idx is not None and 0 <= selected_idx < len(faces):
                fe = faces[selected_idx]
                d = str(fe.get("direction") or "").strip() or "—"
                away = " (lệch)" if bool(fe.get("looking_away")) else ""
                fid = fe.get("id")
                who = f"{fid.strip()}: " if isinstance(fid, str) and fid.strip() else "Thí sinh định danh: "
                message = multi_prefix + "\n" + who + d + away
            else:
                message = multi_prefix
        else:
            violation = False
            violation_type = "ok"
            message = "OK"
    else:
        if emit_looking_away_violation:
            violation = True
            violation_type = "looking_away"
            if enrolled_lines:
                message = "Phát hiện nhìn lệch.\n" + "\n".join(enrolled_lines)
            else:
                msg_dir = str(faces[0].get("direction") or "—") if faces else "—"
                message = f"Phát hiện nhìn lệch.\n{msg_dir}"
        elif any(bool(f.get("looking_away")) for f in faces):
            # Vẫn lệch sau khi đã báo 1 lần trong lượt này — không lặp violation/ảnh cho tới khi nhìn lại.
            violation = False
            violation_type = "ok"
            if enrolled_lines:
                message = "\n".join(enrolled_lines)
            elif directions_msg:
                message = directions_msg
            else:
                message = "OK"
        else:
            if enrolled_lines:
                message = "\n".join(enrolled_lines)
            elif directions_msg:
                message = directions_msg
            else:
                message = "OK"

    # JSON faces: chỉ mặt thí sinh đã chọn (định danh), kể cả khi multi_face — có gaze/looking_away
    response_faces: list[dict[str, Any]] = []
    if selected_idx is not None and 0 <= selected_idx < len(faces):
        response_faces = [dict(faces[selected_idx])]
    elif len(faces) == 1:
        response_faces = [dict(faces[0])]
    else:
        response_faces = []

    # Annotate: bbox cho mọi mặt; mũi tên gaze chỉ khi đã khớp định danh đúng mặt đó.
    annotate_faces: list[dict[str, Any]] = []
    for i, f in enumerate(faces):
        af = dict(f)
        af["draw_gaze_arrow"] = bool(
            enrolled_face_matched and selected_idx is not None and i == selected_idx
        )
        annotate_faces.append(af)

    if len(annotate_faces) > 0:
        annotated = _annotate_frame(frame_bgr, annotate_faces, arrow_multiplier=arrow_multiplier)
        annotated_b64 = _encode_bgr_to_jpeg_base64(annotated)
    else:
        annotated_b64 = _encode_bgr_to_jpeg_base64(frame_bgr)

    # enrolled_student_id trong JSON chỉ khi frame này có mặt khớp định danh — không gán MSSV app khi chưa khớp.
    response_student_id: str | None = None
    if enrolled_face_matched and mssv_for_face:
        response_student_id = mssv_for_face

    return GazeEstimateResponse(
        faces=response_faces,
        faces_count=faces_count,
        annotated_image_base64=annotated_b64,
        violation=violation,
        violation_type=violation_type,
        message=message,
        enrolled_student_id=response_student_id,
    )

