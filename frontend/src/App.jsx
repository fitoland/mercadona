// #/debug opens the demo control panel; anything else is the cart screen.
// There is no QR / pairing screen: the cart starts already linked ("Carro conectado").
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useCart } from './api.js'
import { countUnits } from './format.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import EmptyCart from './components/EmptyCart.jsx'
import Ticket from './components/Ticket.jsx'
import ScannerView from './components/ScannerView.jsx'
import VisionView from './components/VisionView.jsx'
import Confirming from './components/Confirming.jsx'
import Payment from './components/Payment.jsx'
import Exit from './components/Exit.jsx'
import Toast from './components/Toast.jsx'
import DebugPanel from './components/DebugPanel.jsx'

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const cart = useCart()
  if (hash === '#/debug') return <DebugPanel {...cart} />
  return <CartScreen {...cart} />
}

function CartScreen({ state, conn, act, error }) {
  // Which camera panel is open on the left: null | "scanner" | "vision".
  const [panel, setPanel] = useState(null)
  const lastScan = useRef({ code: null, at: 0 })
  const units = useRef(0)
  units.current = countUnits(state?.lines)

  // API rule 1: ignore the same barcode for ~2 s (the camera reads it many times per second).
  const onScan = useCallback(
    async (code, { manual = false } = {}) => {
      const now = Date.now()
      if (!manual && lastScan.current.code === code && now - lastScan.current.at < 2000) return
      lastScan.current = { code, at: now }
      const before = units.current
      const next = await act(() => api.scan(code))
      // Back to the shopping list once the product is in; an unknown barcode keeps the camera open to retry.
      if (next && countUnits(next.lines) > before) setPanel(null)
    },
    [act],
  )

  // USB barcode readers type the digits and press Enter: accept them on any screen.
  useEffect(() => {
    let buf = ''
    let last = 0
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      const now = Date.now()
      if (now - last > 100) buf = ''
      last = now
      if (/^\d$/.test(e.key)) buf += e.key
      else if (e.key === 'Enter' && buf.length >= 8) {
        onScan(buf, { manual: true })
        buf = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onScan])

  // Keep the backend's mode in sync with the panel the user opens.
  const openPanel = (next) => {
    const target = panel === next ? null : next
    setPanel(target)
    if (target && state.mode !== target) act(() => api.mode(target))
  }

  // Leaving the shopping states closes the camera.
  useEffect(() => {
    if (state && (state.state === 'paying' || state.state === 'paid')) setPanel(null)
  }, [state?.state]) // eslint-disable-line react-hooks/exhaustive-deps

  let body
  if (!state) {
    body = (
      <section className="card main center">
        <span className="spinner big" aria-hidden="true" />
        <p className="lead">Conectando con el carro…</p>
      </section>
    )
  } else if (state.state === 'paid') {
    body = <Exit state={state} onNewCart={() => act(api.newCart)} />
  } else if (state.state === 'paying') {
    body = <Payment state={state} onBack={() => act(api.cancel)} onConfirm={() => act(api.payConfirm)} />
  } else {
    let main
    if (state.state === 'confirming')
      main = (
        <Confirming
          candidates={state.candidates}
          onSelect={(id) => act(() => api.select(id))}
          onCancel={() => act(api.cancel)}
        />
      )
    else if (panel === 'scanner') main = <ScannerView onScan={onScan} onClose={() => setPanel(null)} />
    else if (panel === 'vision')
      main = (
        <VisionView
          connected={conn === 'live' && state.mode === 'vision'}
          onAdd={(token, id) => act(() => api.addDetection(token, id))}
          lines={state.lines}
          onRemove={(id) => act(() => api.remove(id))}
          onClose={() => setPanel(null)}
        />
      )
    else if (state.lines.length) main = <Ticket lines={state.lines} onRemove={(id) => act(() => api.remove(id))} />
    else main = <EmptyCart />

    body = (
      <>
        {main}
        <Sidebar state={state} panel={panel} onPanel={openPanel} onPay={() => act(api.pay)} />
      </>
    )
  }

  return (
    <div className="screen">
      <Header conn={conn} />
      <main className="body">{body}</main>
      <Toast notice={state?.notice} error={error} />
    </div>
  )
}
