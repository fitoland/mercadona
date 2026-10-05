"""Local COCO detection. No cloud API and no catalogue/SKU inference."""
import base64
import binascii
import io
import os
import threading
import time
from PIL import Image, ImageOps, UnidentifiedImageError

# Prices are deliberately fictional, per object (not per kg).
DEMO_PRODUCTS = {
    'bottle': ('Botella · contenido sin identificar', 100, '🍾'),
    'banana': ('Plátano', 45, '🍌'),
    'apple': ('Manzana', 55, '🍎'),
    'orange': ('Naranja', 50, '🍊'),
    'broccoli': ('Brócoli', 150, '🥦'),
    'carrot': ('Zanahoria', 30, '🥕'),
    'sandwich': ('Sándwich', 200, '🥪'),
    'hot dog': ('Perrito caliente', 250, '🌭'),
    'pizza': ('Pizza', 350, '🍕'),
    'donut': ('Dónut', 90, '🍩'),
    'cake': ('Pastel', 250, '🍰'),
    'cup': ('Taza', 150, '☕'),
    'bowl': ('Cuenco', 200, '🥣'),
}


def decode_image(data):
    try:
        header, encoded = data.split(',', 1)
        if header not in ('data:image/jpeg;base64', 'data:image/png;base64', 'data:image/webp;base64'):
            raise ValueError('Usa una imagen JPEG, PNG o WebP.')
        raw = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(raw)) as source:
            if source.width * source.height > 12_000_000:
                raise ValueError('Imagen demasiado grande: máximo 12 megapíxeles.')
            image = ImageOps.exif_transpose(source).convert('RGB')
            image.thumbnail((1280, 1280))
            return image
    except (binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('La imagen no es válida.') from exc


class Detector:
    def __init__(self):
        self.model = None
        self.model_path = os.getenv('YOLO_MODEL', 'yolov8n.pt')
        self.device = os.getenv('YOLO_DEVICE', 'cpu')
        self.lock = threading.Lock()
        self.status = 'not_loaded'
        self.error = None

    def load(self):
        if self.model is not None:
            return
        self.status = 'loading'
        try:
            from ultralytics import YOLO
            model = YOLO(self.model_path)
            self.model = model
            self.status = 'ready'
            self.error = None
        except Exception:
            self.status = 'error'
            self.error = 'No se pudo cargar YOLO. Instala requirements-vision.txt y descarga los pesos (ver README).'
            raise

    def predict(self, image, confidence):
        # One shared model, serialized inference; multiple phones get 503 instead of a queue.
        if not self.lock.acquire(blocking=False):
            raise BlockingIOError('YOLO está ocupado; vuelve a intentarlo.')
        try:
            self.load()
            started = time.perf_counter()
            result = self.model.predict(image, conf=confidence, imgsz=640,
                                        device=self.device, max_det=40, verbose=False)[0]
            detections = []
            for box in result.boxes:
                class_id = int(box.cls.item())
                label = result.names[class_id]
                product = DEMO_PRODUCTS.get(label)
                detections.append({
                    'class_id': class_id, 'label': label,
                    'name': product[0] if product else label,
                    'confidence': round(float(box.conf.item()), 4),
                    'box': [round(float(v), 5) for v in box.xyxyn[0].tolist()],
                    'product_key': label if product else None,
                })
            return {'detections': detections, 'inference_ms': round((time.perf_counter()-started)*1000),
                    'model': self.model_path, 'width': image.width, 'height': image.height}
        except BlockingIOError:
            raise
        except Exception:
            if self.status != 'error':
                self.error = 'La inferencia falló. Revisa el terminal del backend y YOLO_DEVICE.'
            raise
        finally:
            self.lock.release()


detector = Detector()


def product_id(label):
    return 'yolo-' + label.replace(' ', '-') if label in DEMO_PRODUCTS else None


def status():
    # Loading is lazy. Errors are retryable on the next explicit request.
    return detector.status


def recognize(image):
    """Compatibility endpoint: only a single visible commercial object is selected."""
    result = detector.predict(image, .45)
    eligible = [d for d in result['detections'] if d['product_key']]
    if len(eligible) != 1:
        return []
    d = eligible[0]
    return [(product_id(d['label']), d['confidence'])]
