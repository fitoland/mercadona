> **Integración YOLO:** el flujo continuo y sus rutas se documentan en [YOLO_INTEGRATION.md](YOLO_INTEGRATION.md). Las categorías `yolo-*` se añaden al mismo CartState y se publican por `/ws`. El reconocimiento no identifica referencias comerciales por marca.

# Contrato de la API

Contrato entre el frontend (pantalla del carro) y el backend. Si algo cambia, se cambia aquí primero.

La demo se hace con 2-3 productos envasados y **sin báscula**: el peso (fruta, antifraude) se explica en la presentación, no se implementa.

## Principios

- **El backend es la única fuente de verdad.** Manda el estado completo del carro (`CartState`) por WebSocket cada vez que cambia. El front no calcula nada: pinta el estado y envía acciones.
- **Un solo carro por backend.** No hay `cart_id`.
- **Todos los `POST` devuelven el `CartState` actualizado.**
- **El front llama siempre a través del proxy de Vite** (`/api` y `/ws` van a `localhost:8000`). El backend tiene CORS abierto por si el front corre en otro portátil.

## Flujos

- **V1 (escáner):** el front lee el código de barras → `POST /api/scan` → el backend añade el producto al ticket.
- **V2 (cámara con IA):** el usuario abre la cámara y hace una foto → `POST /api/vision/recognize` → el backend la reconoce:
  - confianza alta (≥ 0.6) → añade el producto al ticket;
  - confianza baja → pasa a `confirming` con el top 3 en `candidates`, y el usuario elige con `POST /api/select` (o escanea el código, o cancela).
- **Pago:** `POST /api/pay` → pantalla de pago → `POST /api/pay/confirm` (Tap to Pay simulado) → `POST /api/new-cart`. Desde la pantalla de pago, `POST /api/cancel` vuelve a `idle` para seguir comprando.

## WebSocket

`WS /ws`: el servidor envía un `CartState` al conectar y en cada cambio. El cliente no envía nada. Si se cae la conexión, el front reintenta cada segundo.

## Endpoints

| Método | Ruta | Body | Para qué |
|---|---|---|---|
| GET | `/api/catalog` | — | Lista de `Product` |
| GET | `/api/state` | — | `CartState` actual |
| POST | `/api/scan` | `{ "barcode": "2000000000015" }` | Código leído por la cámara o por un lector USB |
| POST | `/api/vision/recognize` | `{ "image": "data:image/jpeg;base64,..." }` | Foto del producto para la IA |
| POST | `/api/select` | `{ "product_id": "leche-entera" }` | Candidato elegido en `confirming` |
| POST | `/api/cancel` | — | Salir de `confirming` sin añadir nada, o de `paying` para seguir comprando (el carro se mantiene) |
| POST | `/api/remove` | `{ "line_id": "f3a9c1d2" }` | Quitar **una unidad** de una línea (si llega a 0, la línea desaparece) |
| POST | `/api/mode` | `{ "mode": "scanner" }` o `{ "mode": "vision" }` | Cambiar entre V1 y V2 (qué enseña la pantalla) |
| POST | `/api/pay` | — | Pasar a la pantalla de pago. Solo en `idle` y con líneas |
| POST | `/api/pay/confirm` | — | Tap to Pay simulado |
| POST | `/api/new-cart` | — | Vaciar el carro y empezar de nuevo |
| GET | `/api/receipts/{receipt_id}` | — | Ticket digital de una compra pagada (`Receipt`). Sigue disponible tras «Carro nuevo» |
| POST | `/api/sim/vision` | `{ "product_id": "leche-entera" }` | **Plan B de la demo:** añade el producto como si lo hubiera reconocido la IA |

## Tipos

```
Product {
  id: string
  barcode: string            // EAN-13
  name: string
  price: number              // €
  unit: "unit" | "kg"        // "kg": se cobra por peso (en la demo, el plátano)
  weight_g: number           // si unit = "kg", peso por defecto de una pieza (lo que daría la báscula)
  vision_label: string       // descripción en inglés que usa la IA
  emoji: string              // "imagen" del producto en la UI
  yolo_label: string | null  // clase de YOLO que se mapea a este producto ("bottle", "banana")
}

Line {
  id: string
  product: Product
  units: number              // piezas; escanear o detectar el mismo producto otra vez suma 1
  quantity: number           // = units, o kg con 3 decimales si unit = "kg" (units × weight_g)
  weight_g: number | null    // peso total de la línea si unit = "kg"; null si no
  total: number              // € redondeado a 2 decimales
  source: "scanner" | "vision" | "selector"   // cómo se añadió la primera unidad
}

Receipt {
  id: string                 // el mismo que receipt_id
  paid_at: string            // ISO 8601 con zona horaria, p. ej. "2026-10-05T13:29:06+02:00"
  lines: Line[]
  total: number
}

CartState {
  state: "idle" | "confirming" | "paying" | "paid"
  mode: "scanner" | "vision"
  scanner_locked: boolean    // true en "paying" y "paid"
  lines: Line[]
  total: number
  candidates: { product: Product, score: number }[]   // en "confirming"; score de 0 a 1
  notice: { id: string, text: string } | null         // aviso puntual (toast)
  receipt_id: string | null  // en "paid"
  vision_status: "ready" | "loading" | "mock" | string  // "error: ..." si la IA no cargó
}
```

## Estados

| Estado | Qué pasa | Qué muestra el front |
|---|---|---|
| `idle` | Comprando | Ticket, cámara/escáner, botón de pagar |
| `confirming` | La IA no está segura | Top 3 de `candidates` + «o escanéalo» + cancelar |
| `paying` | Pantalla de pago | Total + «Acerca la tarjeta o el móvil» |
| `paid` | Pagado | Confirmación + QR del ticket digital + «Carro nuevo» |

## Reglas para el front

1. **Ignorar códigos repetidos.** La cámara lee el mismo código varias veces por segundo. El front ignora el mismo `barcode` durante ~2 s; si no, el producto se suma varias veces.
2. **Fotos pequeñas.** El front reduce la foto a unos 640 px de ancho en JPEG (calidad ~0.8) antes de mandarla. La respuesta tarda 1-2 s: hay que mostrar un «Reconociendo…» mientras tanto.
3. **`notice` solo cuando cambia su `id`.** El backend reenvía el último `notice` en cada mensaje.
4. **Las acciones no permitidas no dan error.** Escanear mientras se paga, o reconocer con la IA aún cargando, responde 200 con el estado y un `notice` que lo explica. El front solo muestra el toast.
5. **Errores reales:** los body mal formados o los ids que no existen devuelven 400 / 404 / 422 con `{ "detail": "..." }`.
6. **Ticket digital por QR.** En `paid`, el front muestra un QR con la URL `{location.origin}/#/ticket/{receipt_id}`. Esa pantalla, pensada para móvil, pide `GET /api/receipts/{receipt_id}` y muestra el ticket. El móvil que escanea el QR tiene que estar en la misma red que el portátil. Los tickets se guardan en memoria: se pierden al reiniciar el backend.

## Ejemplos

Sirven como datos falsos para montar las pantallas antes de que el backend esté listo.

### `idle` con dos líneas (completo)

```json
{
  "state": "idle",
  "mode": "scanner",
  "scanner_locked": false,
  "lines": [
    {
      "id": "f3a9c1d2",
      "product": { "id": "leche-entera", "barcode": "2000000000015", "name": "Leche entera Hacendado 1 L", "price": 0.95, "unit": "unit", "weight_g": 1050, "vision_label": "a carton of milk", "emoji": "🥛" },
      "quantity": 2,
      "total": 1.9,
      "source": "scanner"
    },
    {
      "id": "7b2e90aa",
      "product": { "id": "agua", "barcode": "2000000000053", "name": "Agua mineral 1,5 L", "price": 0.3, "unit": "unit", "weight_g": 1530, "vision_label": "a plastic bottle of water", "emoji": "💧" },
      "quantity": 1,
      "total": 0.3,
      "source": "vision"
    }
  ],
  "total": 2.2,
  "candidates": [],
  "notice": { "id": "c41d8e07", "text": "Added Agua mineral 1,5 L" },
  "receipt_id": null,
  "vision_status": "ready"
}
```

Los siguientes ejemplos muestran solo los campos que cambian respecto al anterior (en un mock: `{ ...idle, ...ejemplo }`).

### `confirming`

```json
{
  "state": "confirming",
  "mode": "vision",
  "candidates": [
    { "product": { "id": "leche-entera", "barcode": "2000000000015", "name": "Leche entera Hacendado 1 L", "price": 0.95, "unit": "unit", "weight_g": 1050, "vision_label": "a carton of milk", "emoji": "🥛" }, "score": 0.42 },
    { "product": { "id": "yogur-natural", "barcode": "2000000000077", "name": "Yogur natural pack 6", "price": 1.1, "unit": "unit", "weight_g": 750, "vision_label": "a pack of yogurts", "emoji": "🥣" }, "score": 0.31 },
    { "product": { "id": "agua", "barcode": "2000000000053", "name": "Agua mineral 1,5 L", "price": 0.3, "unit": "unit", "weight_g": 1530, "vision_label": "a plastic bottle of water", "emoji": "💧" }, "score": 0.12 }
  ]
}
```

### `paying`

```json
{
  "state": "paying",
  "scanner_locked": true
}
```

### `paid`

```json
{
  "state": "paid",
  "scanner_locked": true,
  "receipt_id": "9F2C61B0"
}
```
