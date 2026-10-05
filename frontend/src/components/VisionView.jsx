import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { newGate, stepGate } from '../gate.mjs'
import { CloseIcon } from './Icons.jsx'
import { cameraMessage } from './ScannerView.jsx'
import { eur, quantityPrefix } from '../format.js'

export default function VisionView({ onAdd, onClose, connected, lines = [], onRemove }) {
  const video = useRef(null), canvas = useRef(null), stream = useRef(null)
  const generation = useRef(0), gate = useRef(newGate()), active = useRef(false)
  const autoRef = useRef(false), threshold = useRef(.45), adding = useRef(false)
  const addCallback = useRef(onAdd)
  addCallback.current = onAdd
  const [camera, setCamera] = useState(false), [running, setRunning] = useState(false)
  const [automatic, setAutomatic] = useState(false), [confidence, setConfidence] = useState(.45)
  const [result, setResult] = useState(null), [error, setError] = useState(null)
  const [busy, setBusy] = useState(false), [used, setUsed] = useState(false)
  const [message, setMessage] = useState('Activa la cámara o selecciona una foto')
  const [ratio, setRatio] = useState('4 / 3')
  useEffect(() => () => { generation.current++; active.current = false; stream.current?.getTracks().forEach(t => t.stop()) }, [])

  function pause() {
    generation.current++; active.current = false; setRunning(false)
    setResult(null); setBusy(false)
    gate.current = { ...newGate(), locked: gate.current.locked }
  }
  function stopCamera() {
    pause(); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false)
  }
  async function startCamera() {
    stopCamera(); const token = generation.current; setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita HTTPS. Abre el enlace seguro del portátil.')
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      if (token !== generation.current) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media; video.current.srcObject = media
      await video.current.play()
      if (token !== generation.current) return
      setRatio(`${video.current.videoWidth} / ${video.current.videoHeight}`)
      setCamera(true); setMessage('Cámara lista · inicia la detección')
    } catch (e) { setError(e.name === 'Error' ? e.message : cameraMessage(e)) }
  }
  async function commit(data, key) {
    if (adding.current) return
    const d = data.detections.find(item => item.product_key === key && item.product_id)
    if (!d) return
    adding.current = true; setUsed(true)
    try {
      const next = await addCallback.current(data.detection_id, d.product_id)
      if (!next) { active.current = false; setRunning(false); setError('No se confirmó la entrada. Revisa el ticket antes de volver a analizar.') }
      return next
    } finally { adding.current = false }
  }
  async function infer(image, token, autoAllowed) {
    setBusy(true)
    try {
      const data = await api.detect(image, threshold.current)
      if (token !== generation.current) return
      setResult(data); setUsed(false); setError(null)
      if (autoAllowed && autoRef.current) {
        const next = stepGate(gate.current, data.detections)
        gate.current = next.gate; setMessage(next.message)
        if (next.add) await commit(data, next.add)
      } else setMessage(data.detections.length ? 'Selecciona una categoría para añadir al ticket' : 'Sin detecciones. Acerca el objeto o mejora la luz.')
    } catch (e) {
      if (token === generation.current) { setError(e.message); setResult(null); active.current = false; setRunning(false) }
    } finally { if (token === generation.current) setBusy(false) }
  }
  function capture() {
    const v = video.current, c = canvas.current
    if (!v?.videoWidth) return null
    const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', .8)
  }
  useEffect(() => {
    if (!running || !camera) return
    let cancelled = false, timer
    const token = generation.current
    async function tick() {
      if (cancelled || !active.current || token !== generation.current) return
      const image = capture()
      if (image) await infer(image, token, true)
      if (!cancelled && active.current) timer = setTimeout(tick, 350)
    }
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [running, camera])
  function toggleRunning() {
    if (running) { pause(); setMessage('Detección pausada'); return }
    setError(null); active.current = true; setRunning(true); setMessage('Analizando en el portátil…')
  }
  async function shoot() {
    const image = capture()
    if (image) await infer(image, generation.current, false)
  }
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    stopCamera(); const token = generation.current; setError(null)
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      if (token !== generation.current) { bitmap.close(); return }
      const c = canvas.current, scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height))
      c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale)
      c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height); bitmap.close()
      setRatio(`${c.width} / ${c.height}`)
      await infer(c.toDataURL('image/jpeg', .85), token, false)
    } catch (e) { setError('No se pudo leer la foto: ' + e.message) }
  }
  return <section className="card main camera-panel yolo-panel">
    <div className="row-head"><div><h2 className="h2">Visión YOLO</h2><div className="muted small">80 clases · inferencia en el portátil {result && `· ${result.inference_ms} ms`}</div></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar cámara"><CloseIcon size={22}/></button></div>
    {!connected && <div className="banner banner-warn">YOLO necesita conexión real al backend. El modo simulado no ejecuta visión.</div>}
    <div className="camera yolo-camera" style={{ aspectRatio: ratio }}>
      <video ref={video} muted playsInline style={{ display: camera ? 'block' : 'none' }}/>
      <canvas ref={canvas} style={{ display: !camera && result ? 'block' : 'none' }}/>
      {!camera && !result && <div className="camera-msg">Enseña una manzana, un plátano o una botella</div>}
      {camera && automatic && <div className="yolo-gate"><span>UN OBJETO EN LA ZONA</span></div>}
      {result?.detections.map((d,i) => <div key={i} className={'yolo-box ' + (d.product_key ? '' : 'yolo-other')} style={{left:`${d.box[0]*100}%`,top:`${d.box[1]*100}%`,width:`${(d.box[2]-d.box[0])*100}%`,height:`${(d.box[3]-d.box[1])*100}%`}}><span>{d.name} · {Math.round(d.confidence*100)}%</span></div>)}
    </div>
    <div role="status" className="small">{busy ? 'Analizando… ' : ''}{message}</div>
    {error && <div className="banner banner-warn" role="alert">{error}</div>}
    <div className="yolo-controls"><button className="btn-solid" disabled={!connected || busy && !running} onClick={camera ? toggleRunning : startCamera}>{camera ? running ? 'Pausar' : 'Iniciar detección' : 'Activar cámara'}</button><button className="btn-ghost" disabled={!connected || !camera || running || busy} onClick={shoot}>Hacer foto</button><label className="btn-ghost yolo-upload">Analizar foto<input type="file" accept="image/*" disabled={!connected || busy} onChange={upload}/></label></div>
    <div className="yolo-settings"><label><input type="checkbox" checked={automatic} onChange={e=>{autoRef.current=e.target.checked;setAutomatic(e.target.checked);gate.current={...newGate(),locked:gate.current.locked}}}/> Añadir automáticamente</label><label>Confianza {Math.round(confidence*100)}% <input type="range" aria-label="Confianza mínima" min=".2" max=".8" step=".05" value={confidence} onChange={e=>{threshold.current=+e.target.value;setConfidence(+e.target.value);gate.current={...newGate(),locked:gate.current.locked}}}/></label></div>
    <div className="muted small">Automático: 1 objeto, 3 lecturas con ≥60% de confianza y retirar para repetir. Categorías genéricas con precios ficticios por unidad; no reconoce marcas ni peso.</div>
    <div className="yolo-results">{result?.detections.map((d,i)=><div className="yolo-result" key={i}><span>{d.name} <small>({Math.round(d.confidence*100)}%)</small></span>{d.product_id ? <button className="btn-ghost" disabled={used || busy || running} onClick={()=>commit(result,d.product_key)}>+ Añadir</button> : <span className="muted small">Sin producto asociado</span>}</div>)}{running && !automatic && <small>Pausa para cambiar de modo; usa «Hacer foto» para añadir manualmente.</small>}</div>
    {!!lines.length && <div className="yolo-ticket"><h3 className="h3">Ticket compartido</h3>{lines.map(l=><div className="yolo-result" key={l.id}><span>{quantityPrefix(l, { always: true })}{l.product.name}</span><strong>{eur(l.total)}</strong><button className="icon-btn" aria-label={`Quitar una unidad de ${l.product.name}`} onClick={()=>onRemove(l.id)}>−</button></div>)}</div>}
  </section>
}
