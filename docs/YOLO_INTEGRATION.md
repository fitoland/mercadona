# YOLO integrado en develop

Se conservan la UI del equipo, escáner, máquina de estados, pago simulado y WebSocket.
Se sustituye VisionView por la cámara YOLO. Ya no se usa carrito en sessionStorage.

## Rutas

| Ruta | Entrada / salida |
| --- | --- |
| GET `/api/vision/status` | status, model, device, error |
| POST `/api/vision/detect` | image (data URL), confidence (0.1–0.95; defecto .45) → detections, detection_id, inference_ms, width, height, model |
| POST `/api/vision/add` | detection_id, product_id → CartState y emisión por WebSocket |
| POST `/api/vision/recognize` | Foto → CartState, compatibilidad con el contrato original |

`detect` no modifica el ticket. Las cajas son `[x1,y1,x2,y2]` normalizadas a 0–1.
Cada objeto devuelve label COCO, nombre, confianza, product_key y product_id.
product_id es null cuando la categoría no se asocia al catálogo de demo.
El token de detección caduca en 30 segundos y solo permite una adición.
Errores: 400 imagen/selección inválida, 409 token o estado no válido, 422 parámetros,
503 modelo ocupado/no disponible. La inferencia se serializa en el portátil.
La respuesta `detect` es la excepción al contrato original «todos los POST devuelven CartState».

Reiniciar carrito, cambiar modo o iniciar pago invalida los tokens pendientes y descarta
resultados tardíos. La adición solo se admite en idle + vision y debe corresponder a un
producto efectivamente detectado. El score 1.0 usado al confirmar dentro del backend
es una aceptación de la selección, no una confianza atribuida a YOLO.

## Reconocimiento y catálogo

Pesos `yolov8n.pt` (configurable con YOLO_MODEL), CPU por defecto (YOLO_DEVICE).
No se incluyen pesos ni dependencias en el ZIP. Se descargan en la instalación.
Los cuatro EAN reales se conservan; `yolo_catalog.json` añade categorías genéricas por unidad.
La botella no se transforma automáticamente en la referencia comercial de agua.
La fruta se cuenta por unidad y precio ficticio, nunca se estima su peso.

Modo automático reutilizado de la demo anterior: un único objeto comercial centrado,
confianza >=.60 y tres observaciones consecutivas. Después se bloquea hasta cuatro
observaciones con la zona vacía de categorías comerciales. El deslizador afecta a las
cajas mostradas; no baja el umbral de alta automática. Errores/oclusiones pueden duplicar
entradas; revisar ticket y usar modo foto manual si la escena no es estable.
La retirada de productos del carro no se detecta: se resta desde el ticket.

## Varios dispositivos

Una cámara activa recomienda la demo. Otro móvil/tablet puede abrir la misma URL para
ver el ticket sincronizado, sin activar visión. Dos cámaras pueden observar el mismo objeto
y sumarlo dos veces: no hay seguimiento global entre cámaras. Las capturas no se guardan.
El backend mantiene un único carro en memoria; se pierde al reiniciarlo.

## Validación

`python -m pytest` en backend: 26 pruebas (17 originales + 9 de integración).
`npm test` en frontend: 4 pruebas del control de entradas.
`npm run build`: correcto, con aviso de tamaño del bundle por el escáner ZXing existente.
Las detecciones de las pruebas son inyectadas. La cámara física y la precisión de YOLO
requieren prueba en el portátil de presentación. No se afirma validación visual automática.
