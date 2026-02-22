#!/usr/bin/env python

from __future__ import print_function, division, absolute_import

import argparse
import base64
import os
import sys

script_path = os.path.dirname(os.path.realpath(__file__))
if script_path not in sys.path:
    sys.path.insert(0, script_path)

import rt_gene.rt_gene.src.rt_gene as _rt_gene_pkg
sys.modules["main_rt_gene"] = _rt_gene_pkg

import cv2
import numpy as np
from tqdm import tqdm

from rt_gene.rt_gene.src.rt_gene.extract_landmarks_method_base import LandmarkMethodBase
from rt_gene.rt_gene.src.rt_gene.gaze_tools import get_phi_theta_from_euler, limit_yaw, get_endpoint
from rt_gene.rt_gene.src.rt_gene.gaze_tools_standalone import euler_from_matrix


def load_camera_calibration(calibration_file):
    import yaml
    with open(calibration_file, 'r') as f:
        cal = yaml.safe_load(f)

    dist_coefficients = np.array(cal['distortion_coefficients']['data'], dtype='float32').reshape(1, 5)
    camera_matrix = np.array(cal['camera_matrix']['data'], dtype='float32').reshape(3, 3)

    return dist_coefficients, camera_matrix


def _camera_matrix_from_image_size(h, w):
    d = np.zeros((1, 5))
    m = np.array([[max(w, h), 0.0, w / 2.0], [0.0, max(w, h), h / 2.0], [0.0, 0.0, 1.0]])
    return d, m


def extract_eye_image_patches(subjects, lm_estimator):
    for subject in subjects:
        le_c, re_c, _, _ = subject.get_eye_image_from_landmarks(subject, lm_estimator.eye_image_size)
        subject.left_eye_color = le_c
        subject.right_eye_color = re_c


def _eye_centers_68(subject):
    lm = subject.landmarks
    left_center = (lm[36] + lm[39]) / 2
    right_center = (lm[42] + lm[45]) / 2
    return left_center.astype(int), right_center.astype(int)


def estimate_gaze_result(color_img, dist_coefficients, camera_matrix, lm_estimator, gaze_est):
    faceboxes = lm_estimator.get_face_bb(color_img)
    if len(faceboxes) == 0:
        return [], color_img

    subjects = lm_estimator.get_subjects_from_faceboxes(color_img, faceboxes)
    extract_eye_image_patches(subjects, lm_estimator)

    input_r_list = []
    input_l_list = []
    input_head_list = []
    valid_subject_list = []

    for idx, subject in enumerate(subjects):
        if subject.left_eye_color is None or subject.right_eye_color is None:
            continue
        success, rotation_vector, _ = cv2.solvePnP(lm_estimator.model_points,
                                                   subject.landmarks.reshape(len(subject.landmarks), 1, 2),
                                                   cameraMatrix=camera_matrix,
                                                   distCoeffs=dist_coefficients, flags=cv2.SOLVEPNP_DLS)
        if not success:
            continue
        _rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        _rotation_matrix = np.matmul(_rotation_matrix, np.array([[0, 1, 0], [0, 0, -1], [-1, 0, 0]]))
        _m = np.zeros((4, 4))
        _m[:3, :3] = _rotation_matrix
        _m[3, 3] = 1
        _camera_to_ros = [[0.0, 0.0, 1.0, 0.0],
                          [-1.0, 0.0, 0.0, 0.0],
                          [0.0, -1.0, 0.0, 0.0],
                          [0.0, 0.0, 0.0, 1.0]]
        roll_pitch_yaw = list(euler_from_matrix(np.dot(_camera_to_ros, _m)))
        roll_pitch_yaw = limit_yaw(roll_pitch_yaw)
        phi_head, theta_head = get_phi_theta_from_euler(roll_pitch_yaw)
        input_r_list.append(gaze_est.input_from_image(subject.right_eye_color))
        input_l_list.append(gaze_est.input_from_image(subject.left_eye_color))
        input_head_list.append([theta_head, phi_head])
        valid_subject_list.append(idx)

    if len(valid_subject_list) == 0:
        return [], color_img

    gaze_est_values = gaze_est.estimate_gaze_twoeyes(
        inference_input_left_list=input_l_list,
        inference_input_right_list=input_r_list,
        inference_headpose_list=input_head_list)

    results = []
    for gaze in gaze_est_values.tolist():
        results.append({"theta": float(gaze[0]), "phi": float(gaze[1])})

    frame = color_img.copy()
    length = 100
    for subject_id, gaze in zip(valid_subject_list, gaze_est_values.tolist()):
        subject = subjects[subject_id]
        theta_g, phi_g = gaze[0], gaze[1]
        left_c, right_c = _eye_centers_68(subject)
        for cx, cy in (left_c, right_c):
            pt0 = (int(cx), int(cy))
            ex, ey = get_endpoint(theta_g, phi_g, float(cx), float(cy), length)
            pt1 = (int(ex), int(ey))
            cv2.arrowedLine(frame, pt0, pt1, (0, 0, 255), 2, tipLength=0.2)
            cv2.circle(frame, pt0, 3, (0, 255, 0), -1)

    return results, frame


def estimate_gaze_draw_frame(color_img, dist_coefficients, camera_matrix, lm_estimator, gaze_est):
    _, frame = estimate_gaze_result(color_img, dist_coefficients, camera_matrix, lm_estimator, gaze_est)
    return frame


def run_camera_loop(camera_id, dist_coefficients, camera_matrix, lm_estimator, gaze_est):
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print('Không mở được camera (id={}). Kiểm tra kết nối.'.format(camera_id))
        sys.exit(1)
    if camera_matrix is None:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        dist_coefficients, camera_matrix = _camera_matrix_from_image_size(h, w)
    print('Đang dùng camera. Nhấn "q" để thoát.')
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = estimate_gaze_draw_frame(frame, dist_coefficients, camera_matrix, lm_estimator, gaze_est)
        cv2.imshow('Gaze (q = thoát)', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()


def create_app(lm_est, gaze_est, dist_coeffs, camera_mat):
    from fastapi import FastAPI, File, UploadFile, HTTPException, Request
    from pydantic import BaseModel
    from typing import Optional

    app = FastAPI(title="Gaze Estimation API", version="1.0.0")

    class GazeFace(BaseModel):
        theta: float
        phi: float

    class GazeResponse(BaseModel):
        faces: list[GazeFace]
        annotated_image_base64: Optional[str] = None

    async def _decode_image(raw: bytes) -> np.ndarray:
        arr = np.frombuffer(raw, dtype=np.uint8)
        color_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if color_img is None:
            raise HTTPException(status_code=400, detail="Không đọc được ảnh. Gửi JPEG/PNG hợp lệ hoặc base64 đúng định dạng.")
        return color_img

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/gaze/estimate", response_model=GazeResponse)
    async def gaze_estimate(
        request: Request,
        image: Optional[UploadFile] = File(None),
        draw: bool = False,
    ):
        raw = None
        if image and image.filename:
            if not image.content_type or not image.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="File phải là ảnh (image/jpeg, image/png, ...)")
            raw = await image.read()
        else:
            body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else None
            if body and isinstance(body.get("image_base64"), str):
                raw = base64.b64decode(body["image_base64"])
        if raw is None:
            raise HTTPException(status_code=400, detail="Gửi ảnh dạng multipart (image) hoặc JSON (image_base64).")

        try:
            color_img = await _decode_image(raw)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        h, w = color_img.shape[:2]
        dc = dist_coeffs if dist_coeffs is not None else _camera_matrix_from_image_size(h, w)[0]
        cm = camera_mat if camera_mat is not None else _camera_matrix_from_image_size(h, w)[1]

        results, annotated = estimate_gaze_result(color_img, dc, cm, lm_est, gaze_est)

        out = {
            "faces": [{"theta": r["theta"], "phi": r["phi"]} for r in results],
            "annotated_image_base64": None,
        }
        if draw:
            _, buf = cv2.imencode(".png", annotated)
            out["annotated_image_base64"] = base64.b64encode(buf.tobytes()).decode("utf-8")

        return out

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Gaze estimation từ webcam hoặc API')
    parser.add_argument('--calib-file', type=str, dest='calib_file', default=None, help='File calibration camera (YAML)')
    parser.add_argument('--gaze_backend', choices=['tensorflow', 'pytorch'], default='pytorch')
    _models_dir = os.path.abspath(os.path.join(script_path, "rt_gene", "rt_gene", "model_nets"))
    _pytorch_models = [os.path.join(_models_dir, "gaze_model_pytorch_vgg16_prl_mpii_allsubjects{}.model".format(i)) for i in (1, 2, 3, 4)]
    parser.add_argument('--models', nargs='+', type=str, default=_pytorch_models,
                        help='Đường dẫn model gaze (PyTorch: .model; TensorFlow: .h5)')
    parser.add_argument('--device-id-pytorch', dest="device_id_pytorch", type=str, default='cpu', help='"cpu" hoặc "cuda:0"')
    parser.add_argument('--device-id-tensorflow', dest="device_id_tensorflow", type=str, default='/cpu:0', help='Tensorflow: "/cpu:0" hoặc "/gpu:0"')
    parser.add_argument('--camera-id', dest='camera_id', type=int, default=0, help='ID webcam (0 = mặc định)')
    parser.add_argument('--serve', action='store_true', help='Chạy API server thay vì webcam')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host khi chạy API (mặc định 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8000, help='Cổng API (mặc định 8000)')

    args = parser.parse_args()

    import torch
    if args.device_id_pytorch.startswith('cuda') and not torch.cuda.is_available():
        args.device_id_pytorch = 'cpu'
        tqdm.write('CUDA không khả dụng, dùng CPU.')

    tqdm.write('Loading networks')
    _models_dir = os.path.abspath(os.path.join(script_path, "rt_gene", "rt_gene", "model_nets"))
    landmark_estimator = LandmarkMethodBase(device_id_facedetection=args.device_id_pytorch,
                                            checkpoint_path_face=os.path.join(_models_dir, "SFD", "s3fd_facedetector.pth"),
                                            checkpoint_path_landmark=os.path.join(_models_dir, "phase1_wpdc_vdc.pth.tar"),
                                            model_points_file=os.path.join(_models_dir, "face_model_68.txt"))

    if args.gaze_backend == "tensorflow":
        from rt_gene.rt_gene.src.rt_gene.estimate_gaze_tensorflow import GazeEstimator
        gaze_estimator = GazeEstimator(args.device_id_tensorflow, args.models)
    elif args.gaze_backend == "pytorch":
        from rt_gene.rt_gene.src.rt_gene.estimate_gaze_pytorch import GazeEstimator
        gaze_estimator = GazeEstimator(args.device_id_pytorch, args.models)
    else:
        raise ValueError("Incorrect gaze_base backend, choices are: tensorflow or pytorch")

    if args.calib_file:
        _dc, _cm = load_camera_calibration(args.calib_file)
    else:
        _dc = np.zeros((1, 5))
        _cm = None

    if args.serve:
        import uvicorn
        app = create_app(landmark_estimator, gaze_estimator, _dc, _cm)
        tqdm.write('API: http://{}:{}/docs'.format(args.host, args.port))
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        run_camera_loop(args.camera_id, _dc, _cm, landmark_estimator, gaze_estimator)
