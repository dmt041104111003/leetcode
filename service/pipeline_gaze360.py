import os
import cv2
import torch
import numpy as np
import scipy.io as sio
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

# ==========================================
# PHẦN 1: ĐỊNH NGHĨA ĐƯỜNG ỐNG (DATASET CLASS)
# ==========================================
class Gaze360Dataset(Dataset):
    def __init__(self, data_dir: str, split: str = 'train', transform=None):
        self.data_dir = data_dir
        self.transform = transform
        
        mat_path = os.path.join(data_dir, 'metadata.mat')
        if not os.path.exists(mat_path):
            raise FileNotFoundError(f"Không tìm thấy file: {mat_path}")
            
        mat = sio.loadmat(mat_path)
        
        split_map = {'train': 0, 'val': 1, 'test': 2}
        split_id = split_map[split]
        
        all_splits = mat['split'][0]
        valid_idx = np.where(all_splits == split_id)[0]
        
        self.recordings = [r[0] for r in mat['recordings'][0]]
        self.recording_idx = mat['recording'][0][valid_idx]
        self.frame = mat['frame'][0][valid_idx]
        self.person_identity = mat['person_identity'][0][valid_idx]
        self.gaze_dir = mat['gaze_dir'][valid_idx] 

    def __len__(self):
        return len(self.recording_idx)

    def __getitem__(self, idx):
        rec_name = self.recordings[self.recording_idx[idx]]
        p_id = self.person_identity[idx]
        frame_num = self.frame[idx]
        
        img_path = os.path.join(
            self.data_dir, 'imgs', rec_name, 'head', 
            f"{p_id:06d}", f"{frame_num:06d}.jpg"
        )
        
        img = cv2.imread(img_path)
        if img is None:
            img = np.zeros((224, 224, 3), dtype=np.uint8)
        else:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        if self.transform is not None:
            img = self.transform(img)

        gaze_3d = self.gaze_dir[idx]
        x, y, z = gaze_3d[0], gaze_3d[1], gaze_3d[2]
        
        yaw = np.arctan2(-x, -z)
        pitch = np.arcsin(y)
        
        yaw_deg = yaw * 180.0 / np.pi
        pitch_deg = pitch * 180.0 / np.pi

        pitch_bin = np.clip(int((pitch_deg + 180) / 4), 0, 89)
        yaw_bin = np.clip(int((yaw_deg + 180) / 4), 0, 89)

        label_cont = torch.FloatTensor([pitch_deg, yaw_deg])
        label_bin = torch.LongTensor([pitch_bin, yaw_bin])

        return img, label_cont, label_bin

# ==========================================
# PHẦN 2: CHẠY THỬ ĐƯỜNG ỐNG (TEST PIPELINE)
# ==========================================
if __name__ == '__main__':
    # ĐIỀN ĐƯỜNG DẪN THỰC TẾ CỦA BẠN VÀO ĐÂY
    DATA_DIR = 'E:/NCKH/Gaze360' 

    print("1. Đang khởi tạo các phép biến đổi ảnh...")
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        # Tạm thời comment dòng Normalize lại để nếu bạn muốn show/save ảnh ra xem cho dễ
        # transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    print(f"2. Đang kết nối tới dataset tại: {DATA_DIR} ...")
    try:
        train_dataset = Gaze360Dataset(data_dir=DATA_DIR, split='train', transform=transform)
        print(f"-> Đã tìm thấy {len(train_dataset)} ảnh trong tập Train.")
    except Exception as e:
        print(f"LỖI: {e}")
        exit()

    print("3. Đang mớm dữ liệu vào DataLoader...")
    train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True, num_workers=0)

    print("4. Rút thử 1 Batch (4 ảnh) ra xem kết quả:\n")
    for images, labels_cont, labels_bin in train_loader:
        print(f" - Kích thước tensor Ảnh:      {images.shape} ---> (Batch_size, Channel, Height, Width)")
        print(f" - Tensor Góc thực tế (Độ):    {labels_cont.shape}")
        print(f" - Tensor Phân loại (Bin):     {labels_bin.shape}")
        print("\nGiá trị góc thực tế của ảnh đầu tiên trong batch:")
        print(f"Pitch (Cúi/Ngẩng): {labels_cont[0][0]:.2f} độ")
        print(f"Yaw (Xoay Trái/Phải): {labels_cont[0][1]:.2f} độ")
        print("--------------------------------------------------")
        print("PIPELINE HOẠT ĐỘNG HOÀN HẢO!")
        break # Rút 1 batch để test rồi ngắt luôn