import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatOneDReader } from '@zxing/browser'
import { CloseIcon } from './Icons.jsx'

// The default 640x480 is too blurry for small EAN codes on phones and tablets.
const CAMERA = { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }
const SCAN_INTERVAL_MS = 150

// Screen 3 of the mockup (V1): the camera reads barcodes. A USB reader also works from any screen.
export default function ScannerView({ onScan, onClose }) {
  const videoRef = useRef(null)
  const [camError, setCamError] = useState(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream
    let controls
    let stopped = false
    const video = videoRef.current
    // We own the stream instead of letting zxing open it: StrictMode mounts twice in dev, and two
    // readers opening the camera on the same <video> leave Safari without camera.
    navigator.mediaDevices
      ?.getUserMedia(CAMERA)
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.srcObject = s
        const reader = new BrowserMultiFormatOneDReader(null, SCAN_INTERVAL_MS)
        controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) onScan(result.getText())
        })
        if (stopped) controls.stop()
      })
      .catch((e) => setCamError(cameraMessage(e)))
    if (!navigator.mediaDevices) setCamError(cameraMessage())
    return () => {
      stopped = true
      controls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onScan])

  const submit = (e) => {
    e.preventDefault()
    const code = manual.trim()
    if (code) onScan(code, { manual: true })
    setManual('')
  }

  return (
    <section className="card main camera-panel">
      <div className="camera">
        <video ref={videoRef} muted playsInline />
        {camError ? (
          <div className="camera-msg">{camError}</div>
        ) : (
          <>
            <div className="scan-frame" aria-hidden="true" />
            <span className="camera-tag">Apunta el código de barras a la cámara</span>
          </>
        )}
        <button className="icon-btn camera-close" onClick={onClose} aria-label="Cerrar cámara">
          <CloseIcon size={22} />
        </button>
      </div>
      <form className="manual" onSubmit={submit}>
        <label htmlFor="manual-code">¿No lo lee? Escribe el código</label>
        <div className="manual-row">
          <input
            id="manual-code"
            inputMode="numeric"
            autoComplete="off"
            placeholder="2000000000015"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn-solid" type="submit">
            Añadir
          </button>
        </div>
      </form>
    </section>
  )
}

export function cameraMessage(e) {
  if (!window.isSecureContext) return 'La cámara necesita HTTPS. Arranca el frontend con HTTPS=1 npm run dev.'
  if (e?.name === 'NotAllowedError') return 'Permiso de cámara denegado. Actívalo en el navegador.'
  if (e?.name === 'NotFoundError') return 'No hay ninguna cámara disponible en este dispositivo.'
  return 'No se pudo abrir la cámara.'
}
