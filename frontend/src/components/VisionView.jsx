import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './Icons.jsx'
import { cameraMessage } from './ScannerView.jsx'

const VISION_STATUS = {
  ready: null,
  mock: null,
  loading: 'La IA se está cargando, puede tardar un poco…',
}

// Screen 5 of the mockup (V2): take a photo, the backend recognises the product.
export default function VisionView({ visionStatus, onPhoto, onClose }) {
  const videoRef = useRef(null)
  const [camError, setCamError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stream
    let stopped = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        videoRef.current.srcObject = s
        videoRef.current.play().catch(() => {})
      })
      .catch((e) => setCamError(cameraMessage(e)))
    if (!navigator.mediaDevices) setCamError(cameraMessage())
    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const shoot = async () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    // API rule 2: ~640 px wide JPEG at quality 0.8.
    const w = Math.min(640, video.videoWidth)
    const h = Math.round((video.videoHeight * w) / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(video, 0, 0, w, h)
    setBusy(true)
    await onPhoto(canvas.toDataURL('image/jpeg', 0.8))
    setBusy(false)
  }

  const statusText =
    visionStatus in VISION_STATUS
      ? VISION_STATUS[visionStatus]
      : visionStatus?.startsWith('error')
        ? 'La IA no está disponible. Usa el escáner de códigos.'
        : null

  return (
    <section className="card main camera-panel">
      <div className="camera">
        <video ref={videoRef} muted playsInline />
        {camError && <div className="camera-msg">{camError}</div>}
        {!camError && <span className="camera-tag">Pon el producto delante de la cámara y haz la foto</span>}
        {busy && (
          <div className="camera-msg">
            <span className="spinner" aria-hidden="true" />
            Reconociendo…
          </div>
        )}
        <button className="icon-btn camera-close" onClick={onClose} aria-label="Cerrar cámara">
          <CloseIcon size={22} />
        </button>
      </div>
      <div className="row-head">
        <div>
          <div className="h3">Escaneo con IA</div>
          <div className="muted">{statusText ?? 'La cámara reconoce el producto y lo comprueba con el catálogo.'}</div>
        </div>
        <button className="btn-solid big" onClick={shoot} disabled={busy || !!camError}>
          Hacer foto
        </button>
      </div>
    </section>
  )
}
