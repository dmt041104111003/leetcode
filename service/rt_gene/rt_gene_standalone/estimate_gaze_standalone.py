#!/usr/bin/env python

from __future__ import print_function, division, absolute_import
import argparse
import os
import sys
import cv2
import numpy as np
from tqdm import tqdm

# --- CẤU HÌNH ĐƯỜNG DẪN TUYỆT ĐỐI ---
root_path = "/home/manh/Code/NCKH/rt_gene"
if root_path not in sys.path:
    sys.path.append(root_path)

try:
    from rt_gene.rt_gene.src.rt_gene.extract_landmarks_method_base import LandmarkMethodBase
    from rt_gene.rt_gene.src.rt_gene.gaze_tools import get_phi_theta_from_euler, limit_yaw
    from rt_gene.rt_gene.src.rt_gene.gaze_tools_standalone import euler_from_matrix
except ImportError as e:
    print(f"Lỗi Import: {e}. Vui lòng kiểm tra lại cấu trúc thư mục.")
    sys.exit(1)


def draw_gaze_vector(image, eye_center, gaze_angles, length=100):
    """
    Vẽ mũi tên hướng nhìn.
    Đã điều chỉnh dx để khớp với chế độ lật ngược camera (Mirror mode).
    """
    yaw, pitch = gaze_angles

    # Ở chế độ Mirror (cv2.flip), chúng ta đảo dấu dx để mũi tên đi theo hướng mắt
    # Công thức gốc: dx = -length * np.sin(yaw)
    # Công thức sửa: dx = length * np.sin(yaw)
    dx = length * np.sin(yaw)
    dy = -length * np.sin(pitch)

    start_point = (int(eye_center[0]), int(eye_center[1]))
    end_point = (int(eye_center[0] + dx), int(eye_center[1] + dy))

    # Vẽ mũi tên màu đỏ, độ dày 3 để nhìn rõ hơn
    cv2.arrowedLine(image, start_point, end_point, (0, 0, 255), 3, tipLength=0.2)


def estimate_gaze(color_img, landmark_estimator, gaze_estimator, dist_coefficients, camera_matrix):
    # 1. Phát hiện khuôn mặt
    faceboxes = landmark_estimator.get_face_bb(color_img)
    if len(faceboxes) == 0:
        return color_img

    # 2. Lấy Landmark và cắt ảnh mắt
    subjects = landmark_estimator.get_subjects_from_faceboxes(color_img, faceboxes)
    for subject in subjects:
        le_c, re_c, _, _ = subject.get_eye_image_from_landmarks(subject, landmark_estimator.eye_image_size)
        subject.left_eye_color = le_c
        subject.right_eye_color = re_c

    input_r_list, input_l_list, input_head_list, valid_subject_list = [], [], [], []

    for idx, subject in enumerate(subjects):
        if subject.left_eye_color is None or subject.right_eye_color is None:
            continue

        # 3. Tính toán Head Pose (Tư thế đầu)
        success, rvec, _ = cv2.solvePnP(landmark_estimator.model_points,
                                        subject.landmarks.reshape(len(subject.landmarks), 1, 2),
                                        camera_matrix, dist_coefficients, flags=cv2.SOLVEPNP_DLS)
        if not success: continue

        rot_mat, _ = cv2.Rodrigues(rvec)
        rot_mat = np.matmul(rot_mat, np.array([[0, 1, 0], [0, 0, -1], [-1, 0, 0]]))
        m = np.identity(4);
        m[:3, :3] = rot_mat
        c_to_r = [[0, 0, 1, 0], [-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 0, 1]]
        rpy = limit_yaw(list(euler_from_matrix(np.dot(c_to_r, m))))
        phi_h, theta_h = get_phi_theta_from_euler(rpy)

        input_r_list.append(gaze_estimator.input_from_image(subject.right_eye_color))
        input_l_list.append(gaze_estimator.input_from_image(subject.left_eye_color))
        input_head_list.append([theta_h, phi_h])
        valid_subject_list.append(idx)

    if not valid_subject_list: return color_img

    # 4. Dự đoán hướng nhìn (Gaze)
    gaze_results = gaze_estimator.estimate_gaze_twoeyes(input_l_list, input_r_list, input_head_list)

    # 5. Vẽ kết quả
    for subj_idx, gaze in zip(valid_subject_list, gaze_results.tolist()):
        subject = subjects[subj_idx]
        landmarks = subject.landmarks

        # --- TÂM MẮT (LÒNG ĐEN) ---
        # Mắt phải: landmarks 36-41 | Mắt trái: landmarks 42-47
        r_eye_center = np.mean(landmarks[36:42], axis=0)
        l_eye_center = np.mean(landmarks[42:48], axis=0)

        # Vẽ điểm lòng đen màu xanh cyan để nổi bật trên nền đỏ của vector
        cv2.circle(color_img, tuple(r_eye_center.astype(int)), 4, (255, 255, 0), -1)
        cv2.circle(color_img, tuple(l_eye_center.astype(int)), 4, (255, 255, 0), -1)

        # Vẽ Vector hướng nhìn từ 2 lòng đen
        draw_gaze_vector(color_img, r_eye_center, gaze, length=120)
        draw_gaze_vector(color_img, l_eye_center, gaze, length=120)

        # Vẽ khung khuôn mặt
        box = faceboxes[subj_idx]
        cv2.rectangle(color_img, (int(box[0]), int(box[1])), (int(box[2]), int(box[3])), (0, 255, 0), 2)
        cv2.putText(color_img, f"Gaze Detected", (int(box[0]), int(box[1]) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    return color_img


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video-id', type=int, default=0, help='ID của Webcam')
    args = parser.parse_args()

    print("Đang khởi tạo model... Vui lòng đợi.")

    # Khởi tạo bộ trích xuất Landmark
    landmark_estimator = LandmarkMethodBase(
        device_id_facedetection='cuda:0',
        checkpoint_path_face=os.path.join(root_path, "rt_gene/model_nets/SFD/s3fd_facedetector.pth"),
        checkpoint_path_landmark=os.path.join(root_path, "rt_gene/model_nets/phase1_wpdc_vdc.pth.tar"),
        model_points_file=os.path.join(root_path, "rt_gene/model_nets/face_model_68.txt")
    )

    # Khởi tạo bộ dự đoán Gaze (PyTorch)
    from rt_gene.rt_gene.src.rt_gene.estimate_gaze_pytorch import GazeEstimator

    model_path = [os.path.join(root_path, "rt_gene/model_nets/rt_gene_pytorch.pth")]
    gaze_estimator = GazeEstimator('cuda:0', model_path)

    cap = cv2.VideoCapture(args.video_id)

    # Tạo cửa sổ và cho phép kéo dãn thủ công bằng chuột
    cv2.namedWindow("NCKH - RT-GENE Mirror Gaze Tracker", cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret: break

        # 1. Lật ngược ảnh
        frame = cv2.flip(frame, 1)

        # 2. Xử lý Gaze
        h, w = frame.shape[:2]
        cam_mat = np.array([[h, 0, w / 2], [0, h, h / 2], [0, 0, 1]])
        processed_frame = estimate_gaze(frame, landmark_estimator, gaze_estimator, np.zeros((1, 5)), cam_mat)

        # --- BƯỚC PHÓNG TO ---
        # Thay đổi 200 thành 300 nếu muốn to hơn nữa
        # scale_percent = 3
        # width = int(processed_frame.shape[1] * scale_percent )
        # height = int(processed_frame.shape[0] * scale_percent )
        #
        # # Phóng to bằng INTER_CUBIC để ảnh nét, không bị vỡ hạt
        # enlarged_frame = cv2.resize(processed_frame, (width, height), interpolation=cv2.INTER_CUBIC)
        #
        # cv2.imshow("NCKH - RT-GENE Mirror Gaze Tracker", enlarged_frame)
        cv2.imshow("NCKH - RT-GENE Mirror Gaze Tracker", processed_frame)

        # Nhấn 'f' để bật/tắt Toàn màn hình, nhấn 'q' để thoát
        key = cv2.waitKey(1) & 0xFF
        if key == ord('f'):
            # Chế độ Full Screen
            cv2.setWindowProperty("NCKH - RT-GENE Mirror Gaze Tracker", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
        elif key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()