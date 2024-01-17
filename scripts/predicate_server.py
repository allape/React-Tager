import time
import cv2
import tensorflow as tf
from absl import app
import numpy as np
from yolov3_tf2.models import YoloV3
from yolov3_tf2.dataset import transform_images
from yolov3_tf2.utils import draw_outputs
import http.server
import socketserver
import cgi
import json

# https://github.com/zzh8829/yolov3-tf2

# https://pjreddie.com/darknet/yolo/
# https://pjreddie.com/media/files/yolov3.weights

# git clone https://github.com/zzh8829/yolov3-tf2.git
# cd yolov3-tf2
# conda create --name yolov3 python=3.8
# conda activate yolov3
# #python -m pip install -r requirements-gpu.txt
# python -m pip install -r requirements.txt
# wget https://pjreddie.com/media/files/yolov3.weights
# python convert.py --weights yolov3.weights --output ./checkpoints/yolov3.tf

CLASS_NUM = 80
WEIGHT_FILE = './checkpoints/yolov3.tf'
NAMES_FILE = './data/coco.names'
OUTPUT_FILE = './output.jpg'

POST_URI = '/predicate'
SERVER_PORT = 8000


def main(_):
    physical_devices = tf.config.experimental.list_physical_devices('GPU')
    for physical_device in physical_devices:
        tf.config.experimental.set_memory_growth(physical_device, True)
    yolo = YoloV3(classes=CLASS_NUM)
    yolo.load_weights(WEIGHT_FILE).expect_partial()
    print('weights loaded')

    class_names = [c.strip() for c in open(NAMES_FILE).readlines()]
    print('classes loaded')

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
                    img_raw = tf.image.decode_image(
                        file_item.file.read(), channels=3)
                    img = tf.expand_dims(img_raw, 0)
                    img = transform_images(img, 416)
                    t1 = time.time()
                    boxes, scores, classes, nums = yolo(img)
                    t2 = time.time()

                    img = cv2.cvtColor(img_raw.numpy(), cv2.COLOR_RGB2BGR)
                    img = draw_outputs(
                        img, (boxes, scores, classes, nums), class_names)
                    cv2.imwrite(OUTPUT_FILE, img)

                    bounding_boxes = []
                    boxes, prob, classes, nums = boxes[0], scores[0], classes[0], nums[0]
                    wh = np.flip(img.shape[0:2])
                    for i in range(nums):
                        x1y1 = tuple(
                            (np.array(boxes[i][0:2]) * wh).astype(np.int32))
                        x2y2 = tuple(
                            (np.array(boxes[i][2:4]) * wh).astype(np.int32))
                        bounding_boxes.append((int(classes[i]), float(prob[i]), (int(
                            x1y1[0]), int(x1y1[1])), (int(x2y2[0]), int(x2y2[1]))))

                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'time': t2 - t1,
                        'boxes': bounding_boxes,
                    }).encode())
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
    try:
        app.run(main)
    except SystemExit:
        pass
