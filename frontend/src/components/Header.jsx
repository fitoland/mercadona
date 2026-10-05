const CONN = {
  live: null,
  connecting: 'Reconectando…',
  mock: 'Modo demo · sin backend',
}

export default function Header({ conn, cartId = '0427' }) {
  return (
    <header className="header">
      <div className="header-brand">Carro inteligente</div>
      <div className="header-right">
        {CONN[conn] && <span className={`pill pill-${conn}`}>{CONN[conn]}</span>}
        <span className="pill">Carro {cartId} · Cuenta conectada</span>
      </div>
    </header>
  )
}
