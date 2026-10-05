import { NUTRI, tint } from '../format.js'

export function Thumb({ product, size = 56 }) {
  return (
    <div
      className="thumb"
      style={{ background: tint(product.id), width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {product.emoji}
    </div>
  )
}

export function NutriScore({ letter }) {
  if (!letter || !NUTRI[letter]) return null
  const [bg, fg] = NUTRI[letter]
  return (
    <span className="ns" style={{ background: bg, color: fg }} title={`Nutri-Score ${letter}`}>
      {letter}
    </span>
  )
}
