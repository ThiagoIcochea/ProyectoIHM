import { useEffect, useState } from 'react'

const listeners = new Set()
let seq = 0

export function toast(message, opts = {}) {
  const t = { id: ++seq, message, tone: opts.tone || 'info', action: opts.action, duration: opts.duration ?? 3200 }
  listeners.forEach((l) => l(t))
}

export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const on = (t) => {
      setItems((list) => [...list.slice(-2), t])
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.duration)
    }
    listeners.add(on)
    return () => listeners.delete(on)
  }, [])
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span>{t.message}</span>
          {t.action && (
            <button className="toast-action" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
