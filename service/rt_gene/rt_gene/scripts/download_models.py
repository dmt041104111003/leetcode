#!/usr/bin/env python

from __future__ import print_function, division, absolute_import
import sys
import os

# --- TỰ ĐỘNG FIX PATH ---
# Lấy đường dẫn của thư mục 'rt_gene/rt_gene' (nơi chứa setup.py và src)
script_dir = os.path.dirname(os.path.realpath(__file__))
# Đi ngược lên 1 cấp từ thư mục scripts để vào package gốc
package_root = os.path.abspath(os.path.join(script_dir, '..'))
# Thêm package_root và thư mục cha của nó vào sys.path
sys.path.append(package_root)
sys.path.append(os.path.abspath(os.path.join(package_root, '..')))

# Bây giờ import sẽ không bị lỗi ModuleNotFoundError
try:
    import rt_gene.src.rt_gene.download_tools as download_tools

    print(">>> Đã tìm thấy bộ công cụ tải model.")
except ImportError:
    # Trường hợp cấu trúc thư mục lồng nhau quá sâu
    import src.rt_gene.download_tools as download_tools

    print(">>> Đã tìm thấy bộ công cụ tải model (qua src).")

if __name__ == '__main__':
    print("--- Bắt đầu tải các Pre-trained Models cho RT-GENE ---")

    print("\n1. Đang tải Gaze Models (PyTorch & TensorFlow)...")
    download_tools.download_gaze_tensorflow_models()
    download_tools.download_gaze_pytorch_models()

    print("\n2. Đang tải Blink Models (Nhận diện nháy mắt)...")
    download_tools.download_blink_tensorflow_models()
    download_tools.download_blink_pytorch_models()

    print("\n3. Đang tải Landmark Models (Dlib & Face detection)...")
    # Đây là cái quan trọng nhất để fix lỗi FileNotFoundError của bạn
    download_tools.download_external_landmark_models()

    print("\n--- HOÀN TẤT! Tất cả model đã được lưu vào thư mục model_nets ---")
    print("Đường dẫn lưu: " + os.path.abspath(os.path.join(package_root, 'model_nets')))