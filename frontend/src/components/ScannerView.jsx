import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { CloseIcon } from './Icons.jsx'

const hints = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]],
])

// Screen 3 of the mockup (V1): the camera reads barcodes. A USB reader also works from any screen.
export default function ScannerView({ onScan, onClose }) {
  const videoRef = useRef(null)
  const [camError, setCamError] = useState(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let controls
    let stopped = false
    const reader = new BrowserMultiFormatReader(hints)
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result) => {
        if (result) onScan(result.getText())
      })
      .then((c) => {
        controls = c
        if (stopped) c.stop()
      })
      .catch((e) => setCamError(cameraMessage(e)))
    return () => {
      stopped = true
      controls?.stop()
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
