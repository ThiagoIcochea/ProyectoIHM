import { useEffect, useRef } from 'react'
import { Check, Info } from 'lucide-react'

export function Switch({ checked, onChange, label, hint, id }) {
  return (
    <div className="switch-row">
      <span className="txt">
        <span id={`${id}-l`} style={{ fontWeight: 600 }}>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={!!checked} aria-labelledby={`${id}-l`} className="switch" onClick={() => onChange(!checked)} />
    </div>
  )
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ pressed, onClick, children, check = true }) {
  return (
    <button type="button" className="chip" aria-pressed={!!pressed} onClick={onClick}>
      {check && <span className="chip-check" aria-hidden="true">{pressed && <Check size={13} strokeWidth={3} />}</span>}
      {children}
    </button>
  )
}

export function Notice({ tone = '', icon: Icon = Info, children }) {
  return (
    <div className={`notice ${tone}`}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children, labelledBy = 'sheet-title' }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Solo enfoca al abrir: si dependiera de onClose (que cambia en cada render) robaría el foco
  // a los campos de texto y el teclado del móvil se cerraría al escribir.
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    ref.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" aria-hidden="true" />
        {title && <h2 id={labelledBy} style={{ marginBottom: 12 }}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function VoiceHints({ items }) {
  return (
    <div className="voice-cmds" aria-label="Órdenes de voz de esta pantalla">
      {items.map((t) => (
        <span key={t} className="tag">“{t}”</span>
      ))}
    </div>
  )
}

export function HowTo({ title = 'Cómo probarlo', items }) {
  return (
    <details className="howto card" style={{ padding: '4px 16px 12px' }}>
      <summary>
        <Info size={18} aria-hidden="true" /> {title}
      </summary>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  )
}
