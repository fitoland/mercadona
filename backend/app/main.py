"""FastAPI app: REST endpoints for the cart screen and a WebSocket (/ws) that
pushes the cart state on every change. Contract: docs/API.md."""

import base64
import io

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

from . import vision
from .cart import Cart
from .catalog import Catalog

catalog = Catalog.load()
cart = Cart(catalog)
clients: set[WebSocket] = set()

app = FastAPI(title="Smart Cart")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# Until vision.py exposes recognize(image) -> [(product_id, score)], the AI
# recognizes nothing and every photo ends in "confirming".
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
    image: str  # data URL (image/jpeg)


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


@app.post("/api/vision/recognize")
async def vision_recognize(body: ImageIn):
    _, _, encoded = body.image.partition(",")
    try:
        image = Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image")
    status = vision_status()
    if status not in ("ready", "mock"):
        cart.notify(f"The AI is not available yet ({status})")
        return await publish()
    candidates = await run_in_threadpool(recognize, image)
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
    cart.set_mode(body.mode)
    return await publish()


@app.post("/api/pay")
async def pay():
    cart.pay()
    return await publish()


@app.post("/api/pay/confirm")
async def confirm_payment():
    cart.confirm_payment()
    return await publish()


@app.post("/api/new-cart")
async def new_cart():
    cart.new_cart()
    return await publish()


@app.post("/api/sim/vision")
async def sim_vision(body: ProductIn):
    """Demo plan B: answer for the AI if the model fails live."""
    if catalog.by_id(body.product_id) is None:
        raise LookupError(f"Unknown product {body.product_id}")
    cart.vision_result([(body.product_id, 1.0)])
    return await publish()
