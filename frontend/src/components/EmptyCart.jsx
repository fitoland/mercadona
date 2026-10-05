import { CartIcon } from './Icons.jsx'

// Screen 2 of the mockup: the cart is linked and empty.
export default function EmptyCart() {
  return (
    <section className="card main center">
      <div className="hero-icon">
        <CartIcon size={60} />
      </div>
      <h1 className="h1">¡Listo! Tu carro está vacío</h1>
      <p className="lead">
        Escanea el código de barras de cada producto, o usa el escaneo con IA. Puedes ir guardándolos en tus
        bolsas.
      </p>
      <div className="chips">
        <span className="chip">Cada producto queda registrado al momento</span>
        <span className="chip">Pagas aquí, sin pasar por caja</span>
      </div>
    </section>
  )
}
