import cv2
import os

save_dir = "dataset"
if not os.path.exists(save_dir):
    os.makedirs(save_dir)

# 1. Mở webcam
cap = cv2.VideoCapture(0)

# ==========================================
# FIX LỖI 1: TĂNG ĐỘ PHÂN GIẢI LÊN CAMERA HD
# ==========================================
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

# ==========================================
# FIX LỖI 2: CHO PHÉP PHÓNG TO CỬA SỔ
# ==========================================
cv2.namedWindow("Data Collection Tool", cv2.WINDOW_NORMAL)

print("=== TOOL CHỤP ẢNH GÁN NHÃN AI (BẢN NÂNG CẤP) ===")
print("- Bấm phím '0' để chụp ảnh Negative (0)")
print("- Bấm phím '1' để chụp ảnh Positive (1)")
print("- Bấm phím 'q' để thoát")

stt = 1 

while True:
    ret, frame = cap.read()
    if not ret:
        break
        
    # ==========================================
    # FIX LỖI 3: LẬT ẢNH NHƯ SOI GƯƠNG (MIRROR)
    # số 1 nghĩa là lật theo trục dọc (trái sang phải)
    # ==========================================
    frame = cv2.flip(frame, 1)
        
    cv2.imshow("Data Collection Tool", frame)
    key = cv2.waitKey(1) & 0xFF
    
    if key == ord('0'):
        filename = f"{stt:03d}_0.png"
        filepath = os.path.join(save_dir, filename)
        cv2.imwrite(filepath, frame)
        print(f"Đã lưu: {filename}")
        stt += 1
        
    elif key == ord('1'):
        filename = f"{stt:03d}_1.png"
        filepath = os.path.join(save_dir, filename)
        cv2.imwrite(filepath, frame)
        print(f"Đã lưu: {filename}")
        stt += 1
        
    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Đã chụp xong!")