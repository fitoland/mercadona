import base64
import io
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app import main

@pytest.fixture
def client(monkeypatch):
    main.cart.new_cart()
    main.cart.set_mode('vision')
    main.cart_epoch += 1
    main.detections_cache.clear()
    monkeypatch.setattr(main.vision.detector, 'predict', lambda *_: {
        'detections': [{'label': 'apple', 'name': 'Manzana', 'product_key': 'apple',
                        'confidence': .91, 'box': [.2,.2,.6,.6], 'class_id':47}],
        'width':32,'height':24,'inference_ms':10,'model':'test-injected'})
    with TestClient(main.app) as client:
        yield client
    main.cart.new_cart()
    main.detections_cache.clear()

def photo():
    out = io.BytesIO()
    Image.new('RGB',(32,24),'white').save(out,format='JPEG')
    return 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue()).decode()

def detect(client):
    result = client.post('/api/vision/detect',json={'image':photo()})
    assert result.status_code == 200, result.text
    return result.json()

def body(result,product='yolo-apple'):
    return {'detection_id':result['detection_id'],'product_id':product}

def test_real_catalog_preserved_and_categories_explicit(client):
    products = client.get('/api/catalog').json()
    water = next(p for p in products if p['id']=='agua-cabreiroa-05')
    assert water['barcode']=='8411902007059'
    assert main.vision.product_id('bottle')=='yolo-bottle'
    assert main.vision.product_id('person') is None
    assert next(p for p in products if p['id']=='yolo-apple')['unit']=='unit'

def test_detect_does_not_change_cart_add_publishes_and_cannot_repeat(client):
    with client.websocket_connect('/ws') as ws:
        assert ws.receive_json()['lines']==[]
        result=detect(client)
        assert client.get('/api/state').json()['lines']==[]
        added=client.post('/api/vision/add',json=body(result))
        assert added.status_code==200
        assert added.json()['lines'][0]['source']=='vision'
        assert ws.receive_json()['lines'][0]['product']['id']=='yolo-apple'
        assert client.post('/api/vision/add',json=body(result)).status_code==409
        assert client.get('/api/state').json()['lines'][0]['quantity']==1

def test_cannot_add_undetected_product(client):
    assert client.post('/api/vision/add',json=body(detect(client),'agua-cabreiroa-05')).status_code==400

def test_expired_token_rejected(client):
    result=detect(client)
    main.detections_cache[result['detection_id']]['created']-=31
    assert client.post('/api/vision/add',json=body(result)).status_code==409

def test_new_cart_invalidates_old_detection(client):
    result=detect(client)
    client.post('/api/new-cart')
    assert client.post('/api/vision/add',json=body(result)).status_code==409

def test_scanner_and_checkout_preserved(client):
    result=detect(client)
    state=client.post('/api/scan',json={'barcode':'8411902007059'}).json()
    assert state['lines'][0]['product']['id']=='agua-cabreiroa-05'
    assert client.post('/api/pay').json()['state']=='paying'
    assert client.post('/api/vision/add',json=body(result)).status_code==409
    assert client.post('/api/pay/confirm').json()['state']=='paid'

def test_invalid_image_and_model_failure(client,monkeypatch):
    assert client.post('/api/vision/detect',json={'image':'bad'}).status_code==400
    assert client.post('/api/vision/detect',json={'image':photo(),'confidence':2}).status_code==422
    def fail(*_): raise RuntimeError('model unavailable')
    monkeypatch.setattr(main.vision.detector,'predict',fail)
    assert client.post('/api/vision/detect',json={'image':photo()}).status_code==503
    assert client.get('/api/state').json()['lines']==[]

def test_reset_while_inference_running_discards_result(client,monkeypatch):
    entered,release=Event(),Event()
    original=main.vision.detector.predict
    def slow(*args):
        entered.set()
        assert release.wait(5)
        return original(*args)
    monkeypatch.setattr(main.vision.detector,'predict',slow)
    with ThreadPoolExecutor() as pool:
        future=pool.submit(client.post,'/api/vision/detect',json={'image':photo()})
        assert entered.wait(5)
        client.post('/api/new-cart')
        release.set()
        assert future.result().status_code==409
    assert main.detections_cache=={}

def test_legacy_photo_recognition(client):
    result=client.post('/api/vision/recognize',json={'image':photo()})
    assert result.status_code==200
    assert result.json()['lines'][0]['product']['id']=='yolo-apple'
