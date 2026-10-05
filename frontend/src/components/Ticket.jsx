import { eur, isWeighed, lineDetail, SOURCE_LABEL } from '../format.js'
import { MinusIcon } from './Icons.jsx'
import { NutriScore, Thumb } from './Product.jsx'

// Screens 4 and 6 of the mockup: the running ticket, newest line on top.
export default function Ticket({ lines, onRemove }) {
  const rows = [...lines].reverse()
  return (
    <section className="card main">
      <div className="row-head">
        <h2 className="h2">Tu compra</h2>
        <span className="muted small">Lo más reciente arriba</span>
      </div>
      <ul className="ticket">
        {rows.map((l, i) => (
          <li key={`${l.id}-${l.quantity}`} className={`line ${i === 0 ? 'line-new' : ''}`}>
            <Thumb product={l.product} />
            <div className="line-info">
              <div className="line-name">{l.product.name}</div>
              <div className="line-sub">
                {isWeighed(l.product) ? (
                  <strong>{lineDetail(l)}</strong>
                ) : (
                  <>
                    {l.quantity > 1 && <strong>{l.quantity} × </strong>}
                    {eur(l.product.price)}
                  </>
                )}
                <span className={`src src-${l.source}`}>{SOURCE_LABEL[l.source] ?? l.source}</span>
              </div>
            </div>
            <NutriScore letter={l.product.nutriscore} />
            <div className="line-total">{eur(l.total)}</div>
            <button
              className="icon-btn"
              onClick={() => onRemove(l.id)}
              aria-label={`Quitar una unidad de ${l.product.name}`}
            >
              <MinusIcon size={22} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
