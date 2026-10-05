import { useEffect, useRef, useState } from 'react'

// API rule 3: show a notice only when its id changes.
export default function Toast({ notice, error }) {
  const [shown, setShown] = useState(null)
  const seen = useRef(new Set())

  useEffect(() => {
    for (const [item, kind] of [
      [notice, 'info'],
      [error, 'error'],
    ]) {
      if (item && !seen.current.has(item.id)) {
        seen.current.add(item.id)
        setShown({ ...item, kind })
      }
    }
  }, [notice, error])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 3000)
    return () => clearTimeout(t)
  }, [shown])

  return (
    <div className="toast-zone" aria-live="polite">
      {shown && (
        <div key={shown.id} className={`toast toast-${shown.kind}`}>
          {shown.text}
        </div>
      )}
    </div>
  )
}
