# Smart Cart — el supermercado del futuro

Hackathon Mercadona IT. Un carro que registra la compra mientras la haces y te deja pagar sin pasar por caja.

## Dos versiones

- **V1 (segura):** el carro lleva un escáner de códigos de barras. Escaneas cada producto, el ticket se va generando en la pantalla del carro y pagas con Tap to Pay.
- **V2 (YOLO):** cámara en directo o foto, YOLOv8n preentrenado en el portátil, cajas de detección y alta manual o automática de categorías genéricas. El ticket se comparte por WebSocket con los demás dispositivos. El escáner identifica las referencias comerciales exactas.

La demo combina 4 productos envasados reales para el escáner y 13 categorías genéricas de visión con precios ficticios por unidad. La báscula del carro (fruta al peso, antifraude) y el pago real se explican en la presentación, no se implementan.

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
.venv/bin/pip install -r requirements-vision.txt   # V2 (Ultralytics YOLO)
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
npm run dev:https      # HTTPS para iPhone / tablet Android
```

## IA (V2): integración YOLO

Pulsa **Escanear con IA → Activar cámara → Iniciar detección**.
Para sumar sin pulsaciones, activa **Añadir automáticamente** y presenta un objeto
centrado durante tres lecturas estables. Retíralo hasta que el sistema indique que está listo.
Para control manual: **Hacer foto → + Añadir**, o **Analizar foto → + Añadir**.

La cámara envía JPEG de hasta 640 px al portátil; YOLO devuelve todas las clases COCO.
El ticket y el total se guardan en el backend: un móvil puede capturar y una tablet
mostrar el carrito sin abrir su cámara. Usa una sola cámara activa en la presentación.
El modelo se carga al primer análisis; descarga/calienta los pesos antes del evento.

YOLO no identifica Cabreiroá, Antin, fuet ni mini cookies por su envase. Una botella
se añade como **Botella · contenido sin identificar · demo**, nunca como agua por suposición.
Los cuatro productos comerciales siguen disponibles por código de barras.
El pago y los precios de las categorías YOLO son de demostración.

## Catálogo

- `backend/app/data/catalog.json`: las 4 referencias originales con sus EAN y precios, sin cambios.
- `backend/app/data/yolo_catalog.json`: categorías demo `yolo-*` con precios ficticios por unidad.
- `vision_label` queda como metadato; YOLO no usa descripciones de texto para reconocer envases.

## Windows + iPhone / Android

Cierra los servidores antiguos antes de iniciar esta versión (puertos 8000 y 5173).
En PowerShell, dentro de `backend`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-vision.txt
.\.venv\Scripts\python.exe -c "from ultralytics import YOLO; from PIL import Image; YOLO('yolov8n.pt').predict(Image.new('RGB',(640,640)), device='cpu', verbose=False); print('YOLO FUNCIONA')"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

En otra ventana, dentro de `frontend`:

```powershell
npm.cmd ci
npm.cmd run dev:https
```

Conecta el portátil y el móvil/tablet al mismo hotspot (por ejemplo, al del iPhone).
Abre la URL HTTPS **Network / Wi-Fi** que imprime Vite. No uses las interfaces de WSL
ni VirtualBox. Permite acceso en el firewall para el puerto 5173 en la red privada.
Safari/Chrome necesitan HTTPS y permiso de cámara. Si el certificado de desarrollo
bloquea el acceso, se mantienen las rutas de certificado confiable de la demo anterior:
`frontend/certs/local.pem` y `frontend/certs/local-key.pem`, cargadas automáticamente.
La IP del certificado debe coincidir con la del portátil. No publiques esas claves.

Si actualizas tu carpeta anterior, conserva `.venv`, `yolov8n.pt` y los certificados;
sustituye el código por el contenido de `mercadona-develop` y ejecuta las instalaciones.
Si extraes este ZIP en una carpeta nueva, crea su entorno con los comandos anteriores.
Recarga todos los navegadores. Si aparece modo simulado, comprueba que el backend esté
arrancado y recarga sin `?mock`; YOLO no funciona en el modo simulado.

## Pruebas y alcance

- 17 pruebas originales de carrito conservadas y correctas.
- 9 pruebas nuevas: catálogo, altas por detección, WebSocket, duplicados, caducidad,
  pago/escáner, imágenes inválidas, fallos de modelo y cambio de carrito durante inferencia.
- 4 pruebas del control automático; compilación de React correcta.
- Las pruebas de API inyectan detecciones controladas. No miden precisión del modelo.
- No se ha vuelto a validar cámara física/inferencia en este entorno (PyTorch no puede
  inicializar cpuinfo aquí). Validar en el portátil donde ya funcionaba la primera demo.
- El modo automático es una heurística, no seguimiento físico del carro. Oclusiones pueden
  causar errores; quitar un objeto no resta unidades automáticamente. Usa el botón de quitar.
- El ticket reside en memoria: reiniciar el backend lo vacía. Un proceso, sin varios workers.

Más detalles y contrato de visión: [docs/YOLO_INTEGRATION.md](docs/YOLO_INTEGRATION.md).

## Ramas

- `main`: versión estable.
- `develop`: desarrollo. Se trabaja aquí.
