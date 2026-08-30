from app.detection.scrfd import SCRFDDetector
import cv2

image = cv2.imread("tests/test.jpg")

detector = SCRFDDetector()

faces = detector.detect(image)

print(faces)