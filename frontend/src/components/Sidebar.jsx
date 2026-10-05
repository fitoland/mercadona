import { eur, countUnits, productsLabel } from '../format.js'
import { BarcodeIcon, CameraIcon, CardIcon } from './Icons.jsx'

export function TotalCard({ state, footer }) {
  return (
    <div className="card total-card">
      <div className="muted">Total · {productsLabel(countUnits(state.lines))}</div>
      <div className="total-amount">{eur(state.total)}</div>
      {footer}
    </div>
  )
}

export default function Sidebar({ state, panel, onPanel, onPay }) {
  const empty = state.lines.length === 0
  const busy = state.state === 'confirming'
  return (
    <aside className="side">
      <TotalCard state={state} />
      <button
        className={`btn ${panel === 'scanner' ? 'on' : ''}`}
        aria-pressed={panel === 'scanner'}
        onClick={() => onPanel('scanner')}
        disabled={busy}
      >
        <BarcodeIcon />
        Escanear producto
      </button>
      <button
        className={`btn ${panel === 'vision' ? 'on' : ''}`}
        aria-pressed={panel === 'vision'}
        onClick={() => onPanel('vision')}
        disabled={busy}
      >
        <CameraIcon />
        Escanear con IA
      </button>
      <div className="spacer" />
      <button className="pay" onClick={onPay} disabled={empty || busy}>
        <CardIcon />
        Pagar
      </button>
    </aside>
  )
}
