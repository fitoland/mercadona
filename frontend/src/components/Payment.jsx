import { useState } from 'react'
import { eur, countUnits, productsLabel } from '../format.js'
import { BackIcon, CardIcon, PhoneIcon } from './Icons.jsx'
import { Thumb } from './Product.jsx'
import { TotalCard } from './Sidebar.jsx'

const METHODS = [
  { id: 'card', Icon: CardIcon, title: 'Tarjeta en el datáfono', text: 'Acércala al lector del manillar, debajo de la pantalla.' },
  { id: 'phone', Icon: PhoneIcon, title: 'Móvil o reloj', text: 'Paga sin contacto con el móvil en el mismo lector.' },
]

// Screen 7 of the mockup: review and pay (Tap to Pay is simulated).
export default function Payment({ state, onBack, onConfirm }) {
  const [method, setMethod] = useState('card')
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <>
      <section className="card main">
        <h1 className="h1 left">Revisa y paga</h1>
        <div className="summary">
          <div className="row-head">
            <div className="h3">Tu ticket</div>
            <div className="muted">{productsLabel(countUnits(state.lines))}</div>
          </div>
          <ul className="summary-list">
            {state.lines.map((l) => (
              <li key={l.id}>
                <Thumb product={l.product} size={36} />
                <span className="summary-name">
                  {l.quantity > 1 && `${l.quantity} × `}
                  {l.product.name}
                </span>
                <strong className="num">{eur(l.total)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="h3">Cómo quieres pagar</div>
        <div className="methods" role="radiogroup" aria-label="Forma de pago">
          {METHODS.map(({ id, Icon, title, text }) => (
            <button
              key={id}
              role="radio"
              aria-checked={method === id}
              className={`method ${method === id ? 'on' : ''}`}
              onClick={() => setMethod(id)}
            >
              <Icon size={36} />
              <span className="h3">{title}</span>
              <span className="muted">{text}</span>
            </button>
          ))}
        </div>
      </section>
      <aside className="side">
        <TotalCard state={state} />
        <button className="btn" onClick={onBack} disabled={busy}>
          <BackIcon />
          Seguir comprando
        </button>
        <div className="spacer" />
        <div className="terminal">
          <div className="terminal-box">Datáfono</div>
          <strong>{method === 'card' ? 'Acerca tu tarjeta' : 'Acerca tu móvil'}</strong>
        </div>
        <button className="pay" onClick={confirm} disabled={busy}>
          {busy ? <span className="spinner dark" aria-hidden="true" /> : <CardIcon />}
          {busy ? 'Procesando…' : `Pagar ${eur(state.total)}`}
        </button>
      </aside>
    </>
  )
}
