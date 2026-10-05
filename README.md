# Smart Cart — el supermercado del futuro

Hackathon Mercadona IT. Un carro que registra la compra mientras la haces y te deja pagar sin pasar por caja.

## Dos versiones

- **V1 (segura):** el carro lleva un escáner de códigos de barras. Escaneas cada producto, el ticket se va generando en la pantalla del carro y pagas con Tap to Pay.
- **V2 (innovadora):** haces una foto al producto con la cámara del carro y una IA (CLIP, modelo preentrenado) lo reconoce. Si no está segura, te propone las tres opciones más probables. El escáner queda como respaldo.

La demo se hace con 4 productos envasados reales. La báscula del carro (fruta al peso, antifraude) y el pago real se explican en la presentación, no se implementan.

## Arquitectura

```
Pantalla del carro (frontend, React + Vite)
        ▲ WebSocket (estado)   │ HTTP (escaneos, fotos, pago)
        │                      ▼
Backend (Python, FastAPI): máquina de estados del carro, catálogo, reconocimiento
```

En la demo, el portátil hace de servidor de tienda. El contrato entre front y back está en [`docs/API.md`](docs/API.md).

## Estructura

```
backend/
  app/
    main.py        API REST + WebSocket
    cart.py        máquina de estados del carro
    catalog.py     catálogo de productos
    vision.py      reconocimiento con IA
    data/catalog.json
  tests/           tests de la máquina de estados
frontend/
  src/
    App.jsx        pantalla del carro
    components/
docs/
  API.md           contrato de la API
```

## Arrancar

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt          # V1
.venv/bin/pip install -r requirements-vision.txt   # V2 (torch + transformers)
.venv/bin/uvicorn app.main:app --reload
```

Con el backend arrancado, http://localhost:8000/docs permite probar todos los endpoints desde el navegador.

Tests:

```bash
cd backend
.venv/bin/pytest
```

Frontend:

```bash
cd frontend
npm install
npm run dev            # HTTPS=1 npm run dev para usar la cámara desde una tablet
```

## IA (V2)

`main.py` usa dos funciones de `vision.py`:

```python
def recognize(image: PIL.Image.Image) -> list[tuple[str, float]]:  # [(product_id, score)], mejor primero
def status() -> str:  # opcional: "ready" | "loading" | "error: ..."
```

Mientras no existan, la API funciona en modo `mock`: todas las fotos acaban en la pantalla de confirmación. Si la IA falla en directo, `POST /api/sim/vision` añade un producto como si lo hubiera reconocido.

El modelo pesa unos 600 MB: conviene descargarlo antes del evento.

## Catálogo

`backend/app/data/catalog.json` tiene los productos reales de la demo, con su EAN-13 y su precio. Para añadir uno basta con una entrada nueva; `vision_label` es la descripción en inglés con la que la IA compara la foto.

## Ramas

- `main`: versión estable.
- `develop`: desarrollo. Se trabaja aquí.
