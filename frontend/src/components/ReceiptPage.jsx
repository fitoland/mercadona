import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { eur, countUnits, lineDetail, productsLabel } from '../format.js'
import { Thumb } from './Product.jsx'

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' })

// #/ticket/{receipt_id}: the digital ticket the customer opens on their phone from the QR (API rule 6).
export default function ReceiptPage({ receiptId }) {
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .receipt(receiptId)
      .then(setReceipt)
      .catch(() => setError('No encontramos este ticket. Puede que el carro se haya reiniciado.'))
  }, [receiptId])

  return (
    <div className="receipt-page">
      <header className="receipt-brand">Carro inteligente</header>
      <main className="receipt card">
        {error && <p className="lead">{error}</p>}
        {!error && !receipt && <span className="spinner big" aria-hidden="true" />}
        {receipt && (
          <>
            <div className="receipt-head">
              <h1 className="h3">Ticket digital</h1>
              <div className="muted">{dateFmt.format(new Date(receipt.paid_at))}</div>
              <div className="muted">Nº {receipt.id}</div>
            </div>
            <ul className="receipt-lines">
              {receipt.lines.map((l) => (
                <li key={l.id}>
                  <Thumb product={l.product} size={40} />
                  <span className="receipt-name">
                    {l.product.name}
                    <small className="muted">
                      {lineDetail(l)}
                    </small>
                  </span>
                  <strong className="num">{eur(l.total)}</strong>
                </li>
              ))}
            </ul>
            <div className="receipt-total">
              <span>Total · {productsLabel(countUnits(receipt.lines))}</span>
              <strong className="num">{eur(receipt.total)}</strong>
            </div>
            <p className="muted receipt-foot">Pagado con Tap to Pay. ¡Gracias por tu compra!</p>
          </>
        )}
      </main>
    </div>
  )
}
