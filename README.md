# Smart Cart — el supermercado del futuro

Hackathon Mercadona IT. Un carro que registra la compra mientras la haces y te deja pagar sin pasar por caja.

## Dos versiones

- **V1 (segura):** escáner de códigos de barras + báscula en el carro + selector de fruta en pantalla + pago con Tap to Pay. La fruta se elige en la pantalla y el peso la cobra.
- **V2 (innovadora):** una cámara con IA (CLIP, modelo preentrenado) reconoce lo que entra en el carro. El peso dice cuándo y cuánto; la cámara, qué. El escáner queda como respaldo.

## Arquitectura

```
Pantalla del carro (frontend, React + Vite)
        ▲ WebSocket (estado)   │ HTTP (escaneos, selección, pago)
        │                      ▼
Backend (Python, FastAPI) — máquina de estados, catálogo, reconocimiento
        ▲
        │ lecturas de peso
Báscula simulada (en la demo no hay hardware)
```

En la demo, el portátil hace de servidor de tienda. La báscula y el pago están simulados.

## Estructura

```
backend/
  app/
    main.py        API REST + WebSocket
    cart.py        máquina de estados del carro
    catalog.py     catálogo de productos
    scale.py       báscula simulada
    vision.py      reconocimiento con CLIP
    data/catalog.json
  tests/
frontend/
  src/
    App.jsx        pantalla del carro y panel de debug (#/debug)
    components/
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

Frontend:

```bash
cd frontend
npm install
npm run dev            # HTTPS=1 npm run dev para usar la cámara desde una tablet
```

## Catálogo de demo

`backend/app/data/catalog.json`: 18 productos con precios aproximados. Los códigos de barras usan el prefijo GS1 20, reservado para uso interno de tienda; sustituidlos por los reales de los productos que llevéis a la demo.
