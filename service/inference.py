import argparse
import cv2
import torch
import os
import time
from l2cs import Pipeline, render

def parse_args():
    parser = argparse.ArgumentParser(description="Gaze estimation on video file")
    parser.add_argument('--video-path', type=str, required=True, help='Đường dẫn tới video đầu vào')
    parser.add_argument('--snapshot', type=str, default='models/L2CSNet_gaze360.pkl', help='Đường dẫn tới file trọng số')
    parser.add_argument('--device', type=str, default='cpu', help='Sử dụng cpu hoặc gpu')
    parser.add_argument('--output-path', type=str, default='output.mp4', help='Tên file video đầu ra')
    # THÊM CÔNG TẮC ĐỂ ĐO LƯỜNG KHOA HỌC
    parser.add_argument('--disable-scaling', action='store_true', help='Tắt thuật toán co giãn để đo tốc độ gốc')
    return parser.parse_args()

def main():
    args = parse_args()
    
    if not os.path.exists(args.video_path):
        print(f"\n[LỖI] Không tìm thấy file video: '{args.video_path}'\n")
        return
        
    print("Đang khởi tạo bộ não AI (L2CS-Net)...")
    gaze_pipeline = Pipeline(
        weights=args.snapshot,
        arch='ResNet50',
        device=torch.device(args.device)
    )
    
    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"\n[LỖI] Không thể đọc được file '{args.video_path}'.\n")
        return
        
    orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if video_fps == 0 or video_fps != video_fps:  
        video_fps = 30.0 
    
    # ---------------------------------------------------------
    # LOGIC CỦA MODULE ADAPTIVE SCALING
    # ---------------------------------------------------------
    width = orig_width
    height = orig_height
    MAX_DIMENSION = 720 
    
    if not args.disable_scaling:
        # Nếu KHÔNG bị tắt -> Chạy thuật toán tối ưu
        if max(width, height) > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(width, height)
            width = int(width * scale)
            height = int(height * scale)
        print(f"\n[CHẾ ĐỘ TỐI ƯU] Kích thước: {orig_width}x{orig_height} -> Nén về: {width}x{height}")
    else:
        print(f"\n[CHẾ ĐỘ GỐC] Giữ nguyên độ phân giải khổng lồ: {width}x{height}. Cảnh báo: Sẽ rất chậm!")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v') 
    out = cv2.VideoWriter(args.output_path, fourcc, video_fps, (width, height))
    
    print(f"Bắt đầu phân tích AI trên {total_frames} frames...")
    
    # === BẮT ĐẦU BẤM GIỜ ===
    start_time = time.time()
    processed_frames = 0
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        # Áp dụng nội suy kích thước nếu module được bật
        if not args.disable_scaling:
            frame = cv2.resize(frame, (width, height))
        
        # AI phân tích (Nút thắt cổ chai phần cứng nằm ở đây)
        results = gaze_pipeline.step(frame)
        frame = render(frame, results)
        
        out.write(frame)
        processed_frames += 1
        
        if processed_frames % 20 == 0:
            print(f"-> Đang xử lý: {processed_frames}/{total_frames} frames...")
            
    # === KẾT THÚC BẤM GIỜ ===
    end_time = time.time()
    total_time = end_time - start_time
    
    # Tránh lỗi chia cho 0 nếu video bị hỏng
    if total_time > 0:
        actual_fps = processed_frames / total_time
    else:
        actual_fps = 0.0
        
    cap.release()
    out.release()
    
    # IN BÁO CÁO KHOA HỌC RA MÀN HÌNH
    print("\n" + "="*50)
    print(" BÁO CÁO HIỆU NĂNG TÍNH TOÁN (BENCHMARK)")
    print("="*50)
    print(f"Trạng thái Module : {'TẮT (Đo Tốc Độ Gốc)' if args.disable_scaling else 'BẬT (Đo Tốc Độ Tối Ưu)'}")
    print(f"Tổng số frame     : {processed_frames} frames")
    print(f"Thời gian chạy    : {total_time:.2f} giây")
    print(f"-> FPS TRUNG BÌNH : {actual_fps:.2f} FPS")
    print("="*50 + "\n")

if __name__ == '__main__':
    main()