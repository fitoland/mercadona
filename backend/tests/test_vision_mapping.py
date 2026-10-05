import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main


def detections(*labels):
    return {
        "detections": [
            {"label": label, "name": label, "product_key": label, "confidence": 0.9, "box": [0.2, 0.2, 0.6, 0.6], "class_id": 0}
            for label in labels
        ],
        "width": 32, "height": 24, "inference_ms": 10, "model": "test-injected",
    }


@pytest.fixture
def client():
    main.cart.new_cart()
    main.cart.set_mode("vision")
    main.cart_epoch += 1
    main.detections_cache.clear()
    with TestClient(main.app) as client:
        yield client
    main.cart.new_cart()
    main.detections_cache.clear()


def photo():
    out = io.BytesIO()
    Image.new("RGB", (32, 24), "white").save(out, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


def test_detect_maps_a_bottle_to_the_real_water(client, monkeypatch):
    monkeypatch.setattr(main.vision.detector, "predict", lambda *_: detections("bottle"))

    detection = client.post("/api/vision/detect", json={"image": photo()}).json()["detections"][0]

    assert detection["product_id"] == "agua-cabreiroa-05"
    assert detection["name"] == "Agua mineral Cabreiroá 0,5 L"


def test_unmapped_labels_keep_the_generic_demo_category(client, monkeypatch):
    monkeypatch.setattr(main.vision.detector, "predict", lambda *_: detections("apple"))

    detection = client.post("/api/vision/detect", json={"image": photo()}).json()["detections"][0]

    assert detection["product_id"] == "yolo-apple"


def test_adding_a_detected_banana_bills_its_default_weight(client, monkeypatch):
    monkeypatch.setattr(main.vision.detector, "predict", lambda *_: detections("banana"))
    detection_id = client.post("/api/vision/detect", json={"image": photo()}).json()["detection_id"]

    line = client.post("/api/vision/add", json={"detection_id": detection_id, "product_id": "platano-canarias"}).json()["lines"][0]

    assert line["product"]["id"] == "platano-canarias"
    assert line["weight_g"] == 180
    assert line["quantity"] == 0.18
    assert line["total"] == round(2.35 * 0.18, 2)


def test_recognize_maps_the_single_detection(client, monkeypatch):
    monkeypatch.setattr(main.vision.detector, "predict", lambda *_: detections("bottle"))

    lines = client.post("/api/vision/recognize", json={"image": photo()}).json()["lines"]

    assert [l["product"]["id"] for l in lines] == ["agua-cabreiroa-05"]
