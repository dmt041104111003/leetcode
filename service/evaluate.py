import cv2
import os
import torch
import glob
from l2cs import Pipeline

# 1. CẤU HÌNH ĐƯỜNG DẪN VÀ THAM SỐ
dataset_dir = "dataset" # Thư mục chứa ảnh bạn đã chụp
threshold = 0.35 # Ngưỡng gian lận (0.35 radian ~ 20 độ). Có thể tinh chỉnh!

# Khởi tạo mô hình
print("Đang khởi động bộ não AI (L2CS-Net)...")
gaze_pipeline = Pipeline(
    weights='models/L2CSNet_gaze360.pkl',
    arch='ResNet50',
    device=torch.device('cpu') # Đổi thành 'cuda' nếu bạn dùng GPU
)

# Đọc danh sách file ảnh
image_paths = glob.glob(os.path.join(dataset_dir, "*.png"))
if len(image_paths) == 0:
    print(f"[LỖI] Không tìm thấy ảnh nào trong thư mục '{dataset_dir}'")
    exit()

print(f"Bắt đầu đánh giá trên {len(image_paths)} bức ảnh...")

# 2. KHỞI TẠO CÁC BIẾN ĐẾM (CONFUSION MATRIX)
TP = 0 # True Positive: Gian lận -> AI đoán Gian lận
TN = 0 # True Negative: Bình thường -> AI đoán Bình thường
FP = 0 # False Positive: Bình thường -> AI đoán Gian lận (Cảnh báo giả)
FN = 0 # False Negative: Gian lận -> AI đoán Bình thường (Bỏ lọt tội phạm)

for img_path in image_paths:
    # Trích xuất nhãn thực tế từ tên file (Ground Truth)
    # Ví dụ: "034_1.png" -> Lấy ra số 1
    filename = os.path.basename(img_path)
    try:
        true_label = int(filename.split('_')[-1].split('.')[0])
    except ValueError:
        print(f"Bỏ qua file không đúng định dạng: {filename}")
        continue

    # Đọc ảnh
    frame = cv2.imread(img_path)
    if frame is None:
        continue
        
    # AI phân tích (Inference)
    results = gaze_pipeline.step(frame)
    
    # Logic phân loại của AI
    pred_label = 0
    if results.pitch is not None and len(results.pitch) > 0:
        pitch = results.pitch[0]
        yaw = results.yaw[0]
        
        if abs(pitch) > threshold or abs(yaw) > threshold:
            pred_label = 1 # AI đoán: Gian lận
        else:
            pred_label = 0 # AI đoán: Bình thường
            
    # 3. ĐỐI CHIẾU KẾT QUẢ
    if true_label == 1 and pred_label == 1:
        TP += 1
    elif true_label == 0 and pred_label == 0:
        TN += 1
    elif true_label == 0 and pred_label == 1:
        FP += 1
    elif true_label == 1 and pred_label == 0:
        FN += 1

# 4. TÍNH TOÁN CÁC CHỈ SỐ TOÁN HỌC (METRICS)
total = TP + TN + FP + FN
if total == 0:
    print("Không có dữ liệu hợp lệ để tính toán!")
else:
    accuracy = (TP + TN) / total
    precision = TP / (TP + FP) if (TP + FP) > 0 else 0
    recall = TP / (TP + FN) if (TP + FN) > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

    # 5. IN BÁO CÁO ĐỂ ĐIỀN VÀO BẢNG
    print("\n" + "="*50)
    print(" BÁO CÁO KẾT QUẢ ĐÁNH GIÁ (EVALUATION REPORT)")
    print("="*50)
    print(f"Tổng số ảnh hợp lệ   : {total}")
    print(f"True Positives (TP)  : {TP}")
    print(f"True Negatives (TN)  : {TN}")
    print(f"False Positives (FP) : {FP} (Bình thường nhưng AI báo gian lận)")
    print(f"False Negatives (FN) : {FN} (Gian lận nhưng AI bỏ lọt)")
    print("-" * 50)
    print(f"Độ chính xác (Accuracy)  : {accuracy * 100:.2f} %")
    print(f"Độ chuẩn xác (Precision) : {precision * 100:.2f} %")
    print(f"Độ bao phủ (Recall)      : {recall * 100:.2f} %")
    print(f"F1-Score                 : {f1_score * 100:.2f} %")
    print("="*50 + "\n")