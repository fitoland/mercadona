# Contrato de la API

Contrato entre el frontend (pantalla del carro y panel de debug) y el backend. Si algo cambia, se cambia aquí primero.

## Principios

- **El backend es la única fuente de verdad.** Manda el estado completo del carro (`CartState`) por WebSocket cada vez que cambia. El front no calcula nada: pinta el estado y envía acciones.
- **Un solo carro por backend.** No hay `cart_id`. La pantalla del carro y el panel de debug ven el mismo carro.
- **Todos los `POST` devuelven el `CartState` actualizado.**
- **El front llama siempre a través del proxy de Vite** (`/api` y `/ws` van a `localhost:8000`). El backend tiene CORS abierto por si el front corre en otro portátil.

## WebSocket

`WS /ws`: el servidor envía un `CartState` en cada cambio, unas 10 veces por segundo, porque el peso de la báscula varía constantemente. El cliente no envía nada. Si se cae la conexión, el front reintenta cada segundo.

## Endpoints

### Carro

| Método | Ruta | Body | Para qué |
|---|---|---|---|
| GET | `/api/catalog` | — | Lista de `Product` (selector de fruta, panel de debug) |
| GET | `/api/state` | — | `CartState` actual |
| POST | `/api/scan` | `{ "barcode": "2000000000015" }` | Código leído por la cámara o por un lector USB |
| POST | `/api/select` | `{ "product_id": "platano" }` | Fruta elegida en el selector, o candidato elegido en `confirming` |
| POST | `/api/cancel` | — | Cancelar el producto pendiente (`waiting_item`) |
| POST | `/api/mode` | `{ "mode": "scanner" }` o `{ "mode": "vision" }` | Cambiar entre V1 y V2. Solo en `idle` |
| POST | `/api/vision/frame` | `{ "request_id": "a1b2c3d4", "image": "data:image/jpeg;base64,..." }` | Foto para la IA, cuando el backend la pide |
| POST | `/api/pay` | — | Pasar a la pantalla de pago. Solo en `idle` y con líneas |
| POST | `/api/pay/confirm` | — | Tap to Pay simulado |
| POST | `/api/new-cart` | — | Empezar un carro nuevo tras pagar |

### Panel de debug (simulación)

| Método | Ruta | Body | Para qué |
|---|---|---|---|
| POST | `/api/sim/weight` | `{ "grams": 1500 }` | Fijar el peso objetivo de la báscula |
| POST | `/api/sim/put-product` | `{ "product_id": "leche-entera" }` | Simular que se mete un producto (su peso con algo de variación) |
| POST | `/api/sim/take-line` | `{ "line_id": "f3a9c1d2" }` | Simular que se saca del carro el producto de una línea |
| POST | `/api/sim/vision` | `{ "product_id": "manzana" }` | Responder por la IA. Plan B si el modelo falla en la demo |
| POST | `/api/sim/reset` | — | Báscula a 0 y carro nuevo |

## Tipos

```
Product {
  id: string
  barcode: string            // EAN-13
  name: string
  price: number              // €; si unit = "kg", €/kg
  unit: "unit" | "kg"
  weight_g: number           // peso esperado del envase; en fruta, peso típico de una bolsa (solo lo usa el simulador)
  vision_label: string       // descripción en inglés que usa CLIP
  emoji: string              // "imagen" del producto en la UI
}

Line {
  id: string
  product: Product
  weight_g: number           // peso medido al meterlo
  quantity: number           // kg con 3 decimales si unit = "kg"; 1 si no
  total: number              // € redondeado a 2 decimales
  source: "scanner" | "selector" | "vision"
  warning: string | null     // p. ej. "Camera saw Manzana Golden" si la cámara no coincide con la fruta elegida
}

CartState {
  state: "idle" | "waiting_item" | "measuring" | "recognizing" | "confirming" | "alert" | "paying" | "paid"
  mode: "scanner" | "vision"
  weight_g: number           // lectura actual de la báscula (con ruido)
  scale_target_g: number     // peso objetivo de la báscula simulada (slider del debug)
  stable: boolean            // la lectura lleva ~1 s estable
  scanner_locked: boolean
  pending: Product | null    // producto escaneado o elegido que espera su peso
  measured_g: number         // peso del último producto detectado (en recognizing / confirming)
  lines: Line[]
  total: number
  candidates: { product: Product, score: number }[]   // en "confirming"; score de 0 a 1
  capture_request_id: string | null                   // solo en "recognizing"
  alert: string | null       // mensaje que se muestra en "alert"
  notice: { id: string, text: string } | null         // aviso puntual (toast)
  receipt_id: string | null  // en "paid"
  vision_status: "ready" | "loading" | "mock" | string  // "error: ..." si CLIP no cargó
}
```

## Estados

| Estado | Qué pasa | Qué muestra el front |
|---|---|---|
| `idle` | Esperando. Escáner activo | Ticket, botón de fruta, botón de pagar |
| `waiting_item` | Hay un producto escaneado o elegido (`pending`). Caduca a los 15 s | «Mete {producto} en el carro» + cancelar |
| `measuring` | El peso está cambiando. Escáner bloqueado | «Midiendo…» + peso en vivo |
| `recognizing` | V2: el backend necesita una foto (`capture_request_id`) | «Reconociendo…» + cámara |
| `confirming` | La IA no está segura | Top 3 de `candidates` + «Otro producto» (selector con todo el catálogo) + «o escanéalo» |
| `alert` | Algo no cuadra (producto sin escanear, peso que no coincide…) | `alert` en rojo. Se resuelve solo cuando el peso vuelve a cuadrar |
| `paying` | Pantalla de pago | Total + «Acerca la tarjeta o el móvil» |
| `paid` | Pagado | Confirmación + `receipt_id` + «Carro nuevo» |

## Reglas para el front

1. **Una foto por petición.** En `recognizing`, el front manda **una sola** foto por cada `capture_request_id`, reducida a unos 640 px de ancho en JPEG (calidad ~0.8). Si no hay cámara, no manda nada: a los 10 s el backend pasa a `confirming` con `candidates` vacío.
2. **Ignorar códigos repetidos.** La cámara lee el mismo código varias veces por segundo. El front ignora el mismo `barcode` durante ~2 s; si no, el segundo escaneo choca con el escáner bloqueado y salta un aviso.
3. **`notice` solo cuando cambia su `id`.** El backend reenvía el último `notice` en cada mensaje del WebSocket.
4. **No hay botón de eliminar línea.** Los productos se quitan sacándolos del carro: la báscula detecta la bajada de peso y el backend borra la línea que coincide.
5. **El escáner bloqueado no da error.** Una acción no permitida en el estado actual responde 200 con el estado y un `notice` que lo explica. El front solo muestra el toast.
6. **Errores reales:** los body mal formados o los ids que no existen devuelven 400 / 404 / 422 con `{ "detail": "..." }`.

## Ejemplos

Sirven como datos falsos para montar las pantallas antes de que el backend esté listo.

### `idle` con dos líneas (completo)

```json
{
  "state": "idle",
  "mode": "scanner",
  "weight_g": 1964,
  "scale_target_g": 1964,
  "stable": true,
  "scanner_locked": false,
  "pending": null,
  "measured_g": 0,
  "lines": [
    {
      "id": "f3a9c1d2",
      "product": { "id": "leche-entera", "barcode": "2000000000015", "name": "Leche entera Hacendado 1 L", "price": 0.95, "unit": "unit", "weight_g": 1050, "vision_label": "a carton of milk", "emoji": "🥛" },
      "weight_g": 1052,
      "quantity": 1,
      "total": 0.95,
      "source": "scanner",
      "warning": null
    },
    {
      "id": "7b2e90aa",
      "product": { "id": "platano", "barcode": "2000000000114", "name": "Plátano de Canarias", "price": 2.35, "unit": "kg", "weight_g": 900, "vision_label": "bananas", "emoji": "🍌" },
      "weight_g": 912,
      "quantity": 0.912,
      "total": 2.14,
      "source": "selector",
      "warning": null
    }
  ],
  "total": 3.09,
  "candidates": [],
  "capture_request_id": null,
  "alert": null,
  "notice": { "id": "c41d8e07", "text": "Added Plátano de Canarias" },
  "receipt_id": null,
  "vision_status": "ready"
}
```

Los siguientes ejemplos muestran solo los campos que cambian respecto al anterior (en un mock: `{ ...idle, ...ejemplo }`).

### `waiting_item`

```json
{
  "state": "waiting_item",
  "scanner_locked": true,
  "pending": { "id": "agua", "barcode": "2000000000053", "name": "Agua mineral 1,5 L", "price": 0.3, "unit": "unit", "weight_g": 1530, "vision_label": "a plastic bottle of water", "emoji": "💧" }
}
```

### `measuring`

```json
{
  "state": "measuring",
  "weight_g": 2870,
  "scale_target_g": 3494,
  "stable": false,
  "scanner_locked": true
}
```

### `recognizing` (V2)

```json
{
  "state": "recognizing",
  "mode": "vision",
  "weight_g": 2961,
  "scanner_locked": true,
  "measured_g": 997,
  "capture_request_id": "a1b2c3d4"
}
```

### `confirming` (V2)

```json
{
  "state": "confirming",
  "mode": "vision",
  "weight_g": 2961,
  "scanner_locked": false,
  "measured_g": 997,
  "candidates": [
    { "product": { "id": "manzana", "barcode": "2000000000121", "name": "Manzana Golden", "price": 2.19, "unit": "kg", "weight_g": 1000, "vision_label": "apples", "emoji": "🍎" }, "score": 0.48 },
    { "product": { "id": "platano", "barcode": "2000000000114", "name": "Plátano de Canarias", "price": 2.35, "unit": "kg", "weight_g": 900, "vision_label": "bananas", "emoji": "🍌" }, "score": 0.31 }
  ]
}
```

### `alert`

```json
{
  "state": "alert",
  "weight_g": 2764,
  "scanner_locked": true,
  "alert": "Item added without scanning. Take it out and scan it first."
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
