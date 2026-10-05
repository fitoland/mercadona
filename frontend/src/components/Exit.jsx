import { eur, countUnits, productsLabel } from '../format.js'
import { CheckIcon } from './Icons.jsx'

// Deterministic bars from the receipt id: a stand-in for the code the exit gate reads.
function bars(code = '') {
  const out = []
  for (const ch of `*${code}*`) {
    const n = ch.charCodeAt(0)
    for (let k = 0; k < 4; k++) out.push(1 + ((n >> k) % 3))
  }
  return out
}

// Screen 8 of the mockup: paid, show the code for the fast exit.
export default function Exit({ state, onNewCart }) {
  const widths = bars(state.receipt_id)
  return (
    <section className="card main exit">
      <div className="exit-text">
        <div className="ok-badge">
          <CheckIcon size={46} />
        </div>
        <h1 className="h1 left">Pago completado</h1>
        <p className="lead left">Pasa por la salida rápida y enseña este código al lector del torno.</p>
        <dl className="facts">
          <div>
            <dt>{productsLabel(countUnits(state.lines))}</dt>
            <dd className="num">{eur(state.total)}</dd>
          </div>
          <div>
            <dt>Ticket</dt>
            <dd>{state.receipt_id}</dd>
          </div>
        </dl>
        <button className="btn-solid big" onClick={onNewCart}>
          Carro nuevo
        </button>
      </div>
      <div className="exit-code">
        <div className="barcode-box">
          <div className="barcode" role="img" aria-label={`Código de salida ${state.receipt_id}`}>
            {widths.map((w, i) => (
              <span key={i} style={{ width: w * 3, background: i % 2 ? '#FFFFFF' : '#13261A' }} />
            ))}
          </div>
          <div className="barcode-text">{state.receipt_id}</div>
        </div>
        <div className="muted">Válido durante 15 minutos</div>
      </div>
    </section>
  )
}
