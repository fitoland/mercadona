"""FastAPI app: REST endpoints for the cart screen and the debug panel, and a
WebSocket (/ws) that pushes the cart state to the screen."""

from fastapi import FastAPI

app = FastAPI(title="Smart Cart")


@app.get("/api/health")
def health():
    return {"status": "ok"}
