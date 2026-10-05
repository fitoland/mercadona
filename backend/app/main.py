"""FastAPI app: REST endpoints for the cart screen and a WebSocket (/ws) that
pushes the cart state on every change. Contract: docs/API.md."""

import time
import uuid
from collections import OrderedDict

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel, Field

from . import vision
from .cart import Cart
from .catalog import Catalog

catalog = Catalog.load()
cart = Cart(catalog)
clients: set[WebSocket] = set()

app = FastAPI(title="Smart Cart")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# Compatibility helpers for the original one-photo contract.
def recognize(image: Image.Image) -> list[tuple[str, float]]:
    return vision.recognize(image) if hasattr(vision, "recognize") else []


def vision_status() -> str:
    if hasattr(vision, "status"):
        return vision.status()
    return "ready" if hasattr(vision, "recognize") else "mock"


def snapshot() -> dict:
    return {**cart.snapshot(), "vision_status": vision_status()}


async def publish() -> dict:
    state = snapshot()
    for ws in list(clients):
        try:
            await ws.send_json(state)
        except Exception:
            clients.discard(ws)
    return state


@app.exception_handler(LookupError)
async def not_found(_: Request, exc: LookupError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


class ScanIn(BaseModel):
    barcode: str


class ImageIn(BaseModel):
    image: str = Field(max_length=4_000_000)  # data URL
    confidence: float = Field(default=0.45, ge=0.1, le=0.95)


class ProductIn(BaseModel):
    product_id: str


class LineIn(BaseModel):
    line_id: str


class ModeIn(BaseModel):
    mode: str


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        await ws.send_json(snapshot())
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/catalog")
def get_catalog():
    return [p.to_dict() for p in catalog.products]


@app.get("/api/state")
def get_state():
    return snapshot()


@app.post("/api/scan")
async def scan(body: ScanIn):
    cart.scan(body.barcode)
    return await publish()


# Tokens bind additions to an actual detection and this shopping session.
# They expire after 30 s and are consumed once; no client-provided scores are trusted.
detections_cache = OrderedDict()
cart_epoch = 0


class DetectionIn(BaseModel):
    detection_id: str
    product_id: str


def read_image(body):
    try:
        return vision.decode_image(body.image)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


async def infer(image, confidence):
    try:
        return await run_in_threadpool(vision.detector.predict, image, confidence)
    except BlockingIOError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, vision.detector.error or "YOLO no está disponible. Revisa el backend.") from exc


@app.get("/api/vision/status")
def detector_status():
    return {"status": vision.status(), "model": vision.detector.model_path,
            "device": vision.detector.device, "error": vision.detector.error}


@app.post("/api/vision/detect")
async def vision_detect(body: ImageIn):
    if cart.state != "idle" or cart.mode != "vision":
        raise HTTPException(409, "El carro no está disponible en modo visión.")
    epoch = cart_epoch
    result = await infer(read_image(body), body.confidence)
    if epoch != cart_epoch or cart.state != "idle" or cart.mode != "vision":
        raise HTTPException(409, "El carro cambió durante la detección. Vuelve a intentarlo.")
    for d in result["detections"]:
        d["product_id"] = vision.product_id(d["label"])
    now = time.monotonic()
    for key, entry in list(detections_cache.items()):
        if now - entry["created"] > 30:
            detections_cache.pop(key, None)
    token = uuid.uuid4().hex
    detections_cache[token] = {"created": now, "epoch": epoch,
        "products": {d["product_id"] for d in result["detections"] if d["product_id"]}}
    while len(detections_cache) > 128:
        detections_cache.popitem(last=False)
    return {**result, "detection_id": token}


@app.post("/api/vision/add")
async def vision_add(body: DetectionIn):
    entry = detections_cache.get(body.detection_id)
    if not entry or time.monotonic() - entry["created"] > 30 or entry["epoch"] != cart_epoch:
        raise HTTPException(409, "Detección caducada o ya utilizada. Analiza otra imagen.")
    if cart.state != "idle" or cart.mode != "vision":
        raise HTTPException(409, "El carro no está disponible en modo visión.")
    if body.product_id not in entry["products"]:
        raise HTTPException(400, "Ese producto no aparece en la detección.")
    detections_cache.pop(body.detection_id)
    # Explicit manual confirmation or three-frame automatic gate in the UI.
    cart.vision_result([(body.product_id, 1.0)])
    return await publish()


@app.post("/api/vision/recognize")
async def vision_recognize(body: ImageIn):
    # Backward-compatible one-photo flow; continuous mode uses detect + add.
    if cart.state != "idle" or cart.mode != "vision":
        raise HTTPException(409, "Activa visión con el carro disponible.")
    epoch = cart_epoch
    result = await infer(read_image(body), body.confidence)
    if epoch != cart_epoch or cart.state != "idle" or cart.mode != "vision":
        raise HTTPException(409, "El carro cambió durante el reconocimiento.")
    eligible = [d for d in result["detections"] if d["product_key"]]
    candidates = [(vision.product_id(eligible[0]["label"]), eligible[0]["confidence"])] if len(eligible) == 1 else []
    cart.vision_result(candidates)
    return await publish()


@app.post("/api/select")
async def select(body: ProductIn):
    cart.select(body.product_id)
    return await publish()


@app.post("/api/cancel")
async def cancel():
    cart.cancel()
    return await publish()


@app.post("/api/remove")
async def remove(body: LineIn):
    cart.remove(body.line_id)
    return await publish()


@app.post("/api/mode")
async def set_mode(body: ModeIn):
    global cart_epoch
    cart.set_mode(body.mode)
    cart_epoch += 1
    detections_cache.clear()
    return await publish()


@app.post("/api/pay")
async def pay():
    global cart_epoch
    cart.pay()
    if cart.state == "paying":
        cart_epoch += 1
        detections_cache.clear()
    return await publish()


@app.post("/api/pay/confirm")
async def confirm_payment():
    cart.confirm_payment()
    return await publish()


@app.get("/api/receipts/{receipt_id}")
def get_receipt(receipt_id: str):
    return cart.receipt(receipt_id)


@app.post("/api/new-cart")
async def new_cart():
    global cart_epoch
    cart_epoch += 1
    detections_cache.clear()
    cart.new_cart()
    return await publish()


@app.post("/api/sim/vision")
async def sim_vision(body: ProductIn):
    """Demo plan B: answer for the AI if the model fails live."""
    if catalog.by_id(body.product_id) is None:
        raise LookupError(f"Unknown product {body.product_id}")
    cart.vision_result([(body.product_id, 1.0)])
    return await publish()
