import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { eur } from '../format.js'

// #/debug — control panel for the demo (works from a phone): simulate scans and AI hits.
export default function DebugPanel({ state, conn, act }) {
  const [catalog, setCatalog] = useState([])

  useEffect(() => {
    if (conn === 'connecting') return
    api.catalog().then(setCatalog).catch(() => setCatalog([]))
  }, [conn])

  return (
    <div className="debug">
      <header className="debug-head">
        <h1>Panel de demo</h1>
        <a href="#/">Ir a la pantalla del carro</a>
      </header>

      <section className="debug-box">
        <div className="debug-status">
          <span>
            Conexión: <strong>{conn}</strong>
          </span>
          <span>
            Estado: <strong>{state?.state ?? '—'}</strong>
          </span>
          <span>
            Modo: <strong>{state?.mode ?? '—'}</strong>
          </span>
          <span>
            IA: <strong>{state?.vision_status ?? '—'}</strong>
          </span>
          <span>
            Total: <strong>{eur(state?.total)}</strong>
          </span>
        </div>
        <div className="debug-actions">
          <button onClick={() => act(() => api.mode(state?.mode === 'vision' ? 'scanner' : 'vision'))}>
            Cambiar a {state?.mode === 'vision' ? 'escáner (V1)' : 'IA (V2)'}
          </button>
          <button onClick={() => act(api.pay)}>Pagar</button>
          <button onClick={() => act(api.payConfirm)}>Confirmar pago</button>
          <button onClick={() => act(api.cancel)}>Cancelar</button>
          <button onClick={() => act(api.newCart)}>Carro nuevo</button>
        </div>
      </section>

      <section className="debug-box">
        <h2>Productos</h2>
        <ul className="debug-products">
          {catalog.map((p) => (
            <li key={p.id}>
              <span className="debug-emoji" aria-hidden="true">
                {p.emoji}
              </span>
              <span className="debug-name">
                {p.name}
                <small>
                  {p.barcode} · {eur(p.price)}
                  {p.unit === 'kg' ? '/kg' : ''}
                </small>
              </span>
              <button onClick={() => act(() => api.scan(p.barcode))}>Escanear</button>
              <button onClick={() => act(() => api.simVision(p.id))}>IA</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
