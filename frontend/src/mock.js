// In-browser fake of the backend, following docs/API.md.
// Used automatically when the backend is not reachable (or with ?mock in the URL),
// so the screens can be shown and tested before the real API exists.
import catalogData from '../../backend/app/data/catalog.json'

const uid = () => Math.random().toString(16).slice(2, 10)
const round = (n) => Math.round(n * 100) / 100
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

class HttpError extends Error {}

export function createMock() {
  const products = catalogData.products
  const subs = new Set()
  let s = fresh('scanner')

  function fresh(mode) {
    return {
      state: 'idle',
      mode,
      scanner_locked: false,
      lines: [],
      total: 0,
      candidates: [],
      notice: null,
      receipt_id: null,
      vision_status: 'mock',
    }
  }

  const snapshot = () => structuredClone(s)
  const emit = () => {
    const snap = snapshot()
    subs.forEach((fn) => fn(snap))
    return snap
  }
  const notice = (text) => {
    s.notice = { id: uid(), text }
  }
  const lineTotal = (p, q) => round(p.unit === 'kg' ? (p.price * p.weight_g * q) / 1000 : p.price * q)
  const recalc = () => {
    s.total = round(s.lines.reduce((t, l) => t + l.total, 0))
  }
  const byId = (id) => {
    const p = products.find((x) => x.id === id)
    if (!p) throw new HttpError(`Producto desconocido: ${id}`)
    return p
  }

  function add(p, source) {
    let line = s.lines.find((l) => l.product.id === p.id)
    if (line) line.quantity += 1
    else {
      line = { id: uid(), product: p, quantity: 1, total: 0, source }
      s.lines.push(line)
    }
    line.total = lineTotal(p, line.quantity)
    recalc()
    s.state = 'idle'
    s.candidates = []
    notice(`Añadido: ${p.name}`)
  }

  const canShop = () => {
    if (s.scanner_locked) {
      notice('El carro está en la pantalla de pago')
      return false
    }
    return true
  }

  async function handle(method, path, body = {}) {
    switch (path) {
      case '/api/catalog':
        return structuredClone(products)
      case '/api/state':
        return snapshot()
      case '/api/scan': {
        if (!canShop()) break
        const p = products.find((x) => x.barcode === body.barcode)
        if (p) add(p, 'scanner')
        else notice(`No encontramos el código ${body.barcode}`)
        break
      }
      case '/api/vision/recognize': {
        if (!canShop()) break
        await wait(900)
        // The mock cannot see: it proposes three random products so the user picks one.
        const pool = [...products].sort(() => Math.random() - 0.5).slice(0, 3)
        const scores = [0.48, 0.31, 0.12]
        s.state = 'confirming'
        s.candidates = pool.map((product, i) => ({ product, score: scores[i] }))
        break
      }
      case '/api/select':
        if (s.state !== 'confirming') {
          notice('No hay nada que confirmar')
          break
        }
        add(byId(body.product_id), 'vision')
        break
      case '/api/cancel':
        // Leaves "confirming", and also goes back from "paying" to keep shopping.
        if (s.state === 'confirming' || s.state === 'paying') {
          s.state = 'idle'
          s.candidates = []
          s.scanner_locked = false
        }
        break
      case '/api/remove': {
        const line = s.lines.find((l) => l.id === body.line_id)
        if (!line) throw new HttpError('Esa línea no existe')
        if (s.scanner_locked) {
          notice('No se puede cambiar el ticket durante el pago')
          break
        }
        line.quantity -= 1
        if (line.quantity <= 0) s.lines = s.lines.filter((l) => l !== line)
        else line.total = lineTotal(line.product, line.quantity)
        recalc()
        notice(`Quitado: ${line.product.name}`)
        break
      }
      case '/api/mode':
        if (body.mode !== 'scanner' && body.mode !== 'vision') throw new HttpError('Modo no válido')
        s.mode = body.mode
        break
      case '/api/pay':
        if (s.state === 'idle' && s.lines.length) {
          s.state = 'paying'
          s.scanner_locked = true
        } else notice('Añade algún producto antes de pagar')
        break
      case '/api/pay/confirm':
        if (s.state !== 'paying') {
          notice('Primero pulsa «Pagar»')
          break
        }
        await wait(700)
        s.state = 'paid'
        s.receipt_id = uid().toUpperCase()
        break
      case '/api/new-cart':
        s = fresh(s.mode)
        break
      case '/api/sim/vision':
        if (!canShop()) break
        add(byId(body.product_id), 'vision')
        break
      default:
        throw new HttpError(`Ruta no simulada: ${method} ${path}`)
    }
    return emit()
  }

  return {
    handle,
    subscribe(fn) {
      subs.add(fn)
      fn(snapshot())
      return () => subs.delete(fn)
    },
  }
}
