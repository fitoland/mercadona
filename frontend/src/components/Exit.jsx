import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { eur, countUnits, productsLabel } from '../format.js'
import { CheckIcon } from './Icons.jsx'

// API rule 6: the QR opens the digital ticket on the customer's phone.
export const ticketUrl = (receiptId) => `${location.origin}/#/ticket/${receiptId}`

// Screen 8 of the mockup: paid, scan the QR to take the ticket home.
export default function Exit({ state, onNewCart }) {
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!state.receipt_id) return
    QRCode.toDataURL(ticketUrl(state.receipt_id), { width: 280, margin: 1, color: { dark: '#13261A', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [state.receipt_id])

  return (
    <section className="card main exit">
      <div className="exit-text">
        <div className="ok-badge">
          <CheckIcon size={46} />
        </div>
        <h1 className="h1 left">Pago completado</h1>
        <p className="lead left">Escanea el QR con la cámara de tu móvil para llevarte el ticket digital. Sin papel.</p>
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
          {qr ? (
            <img className="qr" src={qr} alt={`QR del ticket ${state.receipt_id}`} />
          ) : (
            <span className="spinner big" aria-hidden="true" />
          )}
          <div className="barcode-text">{state.receipt_id}</div>
        </div>
        <div className="muted">Tu ticket digital</div>
      </div>
    </section>
  )
}
