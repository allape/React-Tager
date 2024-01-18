import cgi
import http.server
import json
import os
import socketserver
import time

import torch

from models.experimental import attempt_load
from utils.datasets import LoadImages
from utils.general import (check_img_size, non_max_suppression, scale_coords,
                           set_logging, xyxy2xywh)
from utils.torch_utils import TracedModel, select_device, time_synchronized

# !!! not tested !!!
# git clone https://github.com/WongKinYiu/yolov7
# wget https://github.com/WongKinYiu/yolov7/releases/download/v0.1/yolov7.pt

DEVICE_INDEX = ''
WEIGHTS_FILE = 'yolov7.pt'
IMAGE_SIZE = 640
AUGMENT = True

POST_URI = '/predicate'
SERVER_PORT = 8000


def detect():
    # Initialize
    set_logging()
    device = select_device(DEVICE_INDEX)
    half = device.type != 'cpu'  # half precision only supported on CUDA

    # Load model
    model = attempt_load(WEIGHTS_FILE, map_location=device)  # load FP32 model
    stride = int(model.stride.max())  # model stride
    imgsz = check_img_size(IMAGE_SIZE, s=stride)  # check img_size

    model = TracedModel(model, device, IMAGE_SIZE)
    print('model loaded')

    if half:
        model.half()  # to FP16

    def predicate(source: str):
        t0 = time.time()
        dataset = LoadImages(source, img_size=imgsz, stride=stride)
        _, img, im0s, _ = dataset[0]
        img = torch.from_numpy(img).to(device)
        img = img.half() if half else img.float()  # uint8 to fp16/32
        img /= 255.0  # 0 - 255 to 0.0 - 1.0
        if img.ndimension() == 3:
            img = img.unsqueeze(0)

        # Apply NMS
        pred = non_max_suppression(pred, None, None, classes=0, agnostic=None)
        t3 = time_synchronized()

        predications = []

        # Process detections
        for _, det in enumerate(pred):  # detections per image
            im0 = im0s
            if len(det):
                # Rescale boxes from img_size to im0 size
                det[:, :4] = scale_coords(
                    img.shape[2:], det[:, :4], im0.shape).round()
                # Write results
                for *xyxy, conf, cls in reversed(det):
                    predications.append((cls, conf, xyxy[0], xyxy[1], xyxy[2], xyxy[3]))
        return (t3 - t0, predications)

    class MyRequestHandler(http.server.SimpleHTTPRequestHandler):
        def do_POST(self):
            if self.path == POST_URI:
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST'}
                )
                file_item = form['file']
                if file_item.file:
                    file = open(file_item.filename, 'w')
                    file.write(file_item.file.read())
                    file.close()

                    cost_time, bounding_boxes = predicate(file_item.filename)

                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'time': cost_time,
                        'boxes': bounding_boxes,
                    }).encode())
                    os.remove(file_item.filename)
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'No file uploaded.')
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Not found.')

        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            super().end_headers()

    with socketserver.TCPServer(('', SERVER_PORT), MyRequestHandler) as httpd:
        print('Server started on port', SERVER_PORT)
        httpd.serve_forever()


if __name__ == '__main__':
    detect()
