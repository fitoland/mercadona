import { eur } from '../format.js'
import { Thumb } from './Product.jsx'

// State "confirming": the AI is not sure, the user picks one of the top 3.
export default function Confirming({ candidates, onSelect, onCancel }) {
  return (
    <section className="card main">
      <div className="banner banner-warn">
        <div>
          <div className="h3">¿Cuál de estos es?</div>
          <div>La IA no está segura. Toca el producto correcto, o escanea su código de barras.</div>
        </div>
      </div>
      <div className="candidates">
        {candidates.map(({ product, score }) => (
          <button key={product.id} className="candidate" onClick={() => onSelect(product.id)}>
            <Thumb product={product} size={96} />
            <span className="candidate-name">{product.name}</span>
            <span className="muted">{eur(product.price)}</span>
            <span className="score">
              <span className="score-bar" style={{ width: `${Math.round(score * 100)}%` }} />
              <span className="small">{Math.round(score * 100)} %</span>
            </span>
          </button>
        ))}
      </div>
      <div>
        <button className="btn-ghost" onClick={onCancel}>
          No es ninguno
        </button>
      </div>
    </section>
  )
}
