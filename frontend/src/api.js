// Talks to the backend described in docs/API.md.
// State arrives over the WebSocket; actions are POSTs that also return the new state.
// If the backend never answers, it falls back to the in-browser mock (src/mock.js).
import { useCallback, useEffect, useState } from 'react'
import { createMock } from './mock.js'

let mock = null
const forceMock = new URLSearchParams(location.search).has('mock')

async function http(method, path, body) {
  if (mock) return mock.handle(method, path, body)
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}`)
  return data
}

export const api = {
  catalog: () => http('GET', '/api/catalog'),
  scan: (barcode) => http('POST', '/api/scan', { barcode }),
  recognize: (image) => http('POST', '/api/vision/recognize', { image }),
  select: (product_id) => http('POST', '/api/select', { product_id }),
  cancel: () => http('POST', '/api/cancel'),
  remove: (line_id) => http('POST', '/api/remove', { line_id }),
  mode: (mode) => http('POST', '/api/mode', { mode }),
  pay: () => http('POST', '/api/pay'),
  payConfirm: () => http('POST', '/api/pay/confirm'),
  newCart: () => http('POST', '/api/new-cart'),
  simVision: (product_id) => http('POST', '/api/sim/vision', { product_id }),
}

/**
 * Cart state + connection status.
 * conn: "connecting" | "live" | "mock"
 * act(fn): runs an api call, applies the returned state, reports errors as a local notice.
 */
export function useCart() {
  const [state, setState] = useState(null)
  const [conn, setConn] = useState('connecting')
  const [error, setError] = useState(null)

  useEffect(() => {
    let ws
    let timer
    let closed = false
    let fails = 0
    let everLive = false
    let unsub = () => {}

    const startMock = () => {
      mock = mock || createMock()
      unsub = mock.subscribe(setState)
      setConn('mock')
    }

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws`)
      ws.onopen = () => {
        everLive = true
        fails = 0
        setConn('live')
      }
      ws.onmessage = (e) => {
        try {
          setState(JSON.parse(e.data))
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        if (closed) return
        fails += 1
        // Never reached the backend: demo with the mock. Lost it mid-session: keep retrying every second.
        if (!everLive && fails >= 3) return startMock()
        setConn('connecting')
        timer = setTimeout(connect, 1000)
      }
    }

    if (forceMock || mock) startMock()
    else connect()

    return () => {
      closed = true
      clearTimeout(timer)
      unsub()
      if (ws) {
        ws.onclose = null
        ws.close()
      }
    }
  }, [])

  const act = useCallback(async (call) => {
    try {
      const next = await call()
      if (next && typeof next.state === 'string') setState(next)
      return next
    } catch (e) {
      setError({ id: Math.random().toString(16).slice(2), text: e.message || 'Algo ha fallado' })
      return null
    }
  }, [])

  return { state, conn, act, error }
}
