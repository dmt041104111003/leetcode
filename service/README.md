


 <p align="center">
  <img src="https://github.com/Ahmednull/Storage/blob/main/gaze.gif" alt="animated" />
</p>


___

# L2CS-Net

The official PyTorch implementation of L2CS-Net for gaze estimation and tracking.

## Installation
<img src="https://img.shields.io/badge/python%20-%2314354C.svg?&style=for-the-badge&logo=python&logoColor=white"/> <img src="https://img.shields.io/badge/PyTorch%20-%23EE4C2C.svg?&style=for-the-badge&logo=PyTorch&logoColor=white" />

Install package with the following:

```
pip install git+https://github.com/edavalosanaya/L2CS-Net.git@main
```

Or, you can git clone the repo and install with the following:

```
pip install [-e] .
```

Now you should be able to import the package with the following command:

```
$ python
>>> import l2cs
```

## Usage

Detect face and predict gaze from webcam

```python
from l2cs import Pipeline, render
import cv2

gaze_pipeline = Pipeline(
    weights=CWD / 'models' / 'L2CSNet_gaze360.pkl',
    arch='ResNet50',
    device=torch.device('cpu') # or 'gpu'
)
 
cap = cv2.VideoCapture(cam)
_, frame = cap.read()    

# Process frame and visualize
results = gaze_pipeline.step(frame)
frame = render(frame, results)
```

## Demo
* Download the pre-trained models from [here](https://drive.google.com/drive/folders/17p6ORr-JQJcw-eYtG2WGNiuS_qVKwdWd?usp=sharing) and Store it to *models/*.
*  Run:
```
 python demo.py \
 --snapshot models/L2CSNet_gaze360.pkl \
 --gpu 0 \
 --cam 0 \
```
This means the demo will run using *L2CSNet_gaze360.pkl* pretrained model

## Community Contributions

- [Gaze Detection and Eye Tracking: A How-To Guide](https://blog.roboflow.com/gaze-direction-position/): Use L2CS-Net through a HTTP interface with the open source Roboflow Inference project.

## MPIIGaze
We provide the code for train and test MPIIGaze dataset with leave-one-person-out evaluation.

### Prepare datasets
* Download **MPIIFaceGaze dataset** from [here](https://www.mpi-inf.mpg.de/departments/computer-vision-and-machine-learning/research/gaze-based-human-computer-interaction/its-written-all-over-your-face-full-face-appearance-based-gaze-estimation).
* Apply data preprocessing from [here](http://phi-ai.buaa.edu.cn/Gazehub/3D-dataset/).
* Store the dataset to *datasets/MPIIFaceGaze*.

### Train
```
 python train.py \
 --dataset mpiigaze \
 --snapshot output/snapshots \
 --gpu 0 \
 --num_epochs 50 \
 --batch_size 16 \
 --lr 0.00001 \
 --alpha 1 \

```
This means the code will perform leave-one-person-out training automatically and store the models to *output/snapshots*.

### Test
```
 python test.py \
 --dataset mpiigaze \
 --snapshot output/snapshots/snapshot_folder \
 --evalpath evaluation/L2CS-mpiigaze  \
 --gpu 0 \
```
This means the code will perform leave-one-person-out testing automatically and store the results to *evaluation/L2CS-mpiigaze*.

To get the average leave-one-person-out accuracy use:
```
 python leave_one_out_eval.py \
 --evalpath evaluation/L2CS-mpiigaze  \
 --respath evaluation/L2CS-mpiigaze  \
```
This means the code will take the evaluation path and outputs the leave-one-out gaze accuracy to the *evaluation/L2CS-mpiigaze*.

## Gaze360
We provide the code for train and test Gaze360 dataset with train-val-test evaluation.

### Prepare datasets
* Download **Gaze360 dataset** from [here](http://gaze360.csail.mit.edu/download.php).

* Apply data preprocessing from [here](http://phi-ai.buaa.edu.cn/Gazehub/3D-dataset/).

* Store the dataset to *datasets/Gaze360*.


### Train
```
 python train.py \
 --dataset gaze360 \
 --snapshot output/snapshots \
 --gpu 0 \
 --num_epochs 50 \
 --batch_size 16 \
 --lr 0.00001 \
 --alpha 1 \

```
This means the code will perform training and store the models to *output/snapshots*.

### Test
```
 python test.py \
 --dataset gaze360 \
 --snapshot output/snapshots/snapshot_folder \
 --evalpath evaluation/L2CS-gaze360  \
 --gpu 0 \
```
This means the code will perform testing on snapshot_folder and store the results to *evaluation/L2CS-gaze360*.

Markdown
## 🚀 What's New in This Fork (Online Proctoring Adaptation)

This repository is a modified fork of the original [L2CS-Net](https://github.com/Ahmednull/L2CS-Net). While the core 3D gaze estimation architecture (ResNet-50) remains intact, we have introduced approximately 20% new codebase specifically optimized for **Real-time Online Exam Proctoring Systems** and edge-device deployment.

### ✨ Key Features Added

1. **Adaptive Video Scaling (OOM Prevention):**
   Processing raw 4K vertical videos (9:16) from smartphones often causes Out-Of-Memory errors and extreme FPS drops. We introduced an adaptive scaling module that dynamically resizes high-resolution frames to a safe dimension (e.g., 720p) while preserving the original aspect ratio, boosting inference speed from ~2 FPS to ~18 FPS on standard CPUs.

2. **3D-to-2D Gaze Projection & JSON API Integration:**
   Instead of just rendering visual vectors, the modified pipeline projects the 3D gaze angles (Pitch, Yaw) into 2D virtual screen coordinates (`dx`, `dy`). These metrics are packaged into lightweight JSON payloads, making it feasible to stream continuous tracking data to a Microservices Backend for anomaly detection (cheating behavior) without video bandwidth bottlenecks.

3. **Built-in FPS Benchmarking Tool:**
   Integrated a performance evaluation tool directly into the inference script. It calculates the actual average inference speed (FPS) and total execution time. 

4. **Custom Dataset Collection & Evaluation Scripts:**
   Added standalone tools for researchers to quickly build and evaluate their own ground-truth datasets:
   * `collect_data.py`: Manual data annotation tool via webcam (Press `0` for Normal, `1` for Cheating).
   * `evaluate.py`: Automatically generates Confusion Matrix metrics (Accuracy, Precision, Recall, F1-Score) on your custom dataset.

---
===============================

### 💻 Usage Instructions Custom (Modified Features)

**1. Run Optimized Inference (with Adaptive Scaling)**
By default, the script now runs with the adaptive scaling module enabled for smooth performance:
```
   python inference.py --video-path video.mp4
```
**2. Benchmark Original Hardware Speed (Disable Scaling)
To test the raw processing power of your machine without our optimization (Warning: Can be very slow on 4K videos):** 
```
python inference.py --video-path video.mp4 --disable-scaling
```
**3. Collect Custom Dataset (Manual Annotation)
Run this tool to capture webcam frames and manually label them for your own private dataset:**
```
python export_frame.py

**Look at the screen and press '0' (Normal)
Look away and press '1' (Cheating)
Press 'q' to quit. Images are saved in the /dataset folder.**
```
**4. Evaluate Model on Private Dataset
Once you have your _0.png and _1.png dataset, evaluate the classification threshold:**
``
python evaluate.py
``
Note: You can adjust the threshold variable inside evaluate.py to calibrate the sensitivity of the cheating detection.
