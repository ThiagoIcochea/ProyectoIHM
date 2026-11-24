import { useEffect, useRef } from 'react'
import { Check, Info, X } from 'lucide-react'

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
  return <SheetBody refEl={ref} onClose={onClose} title={title} labelledBy={labelledBy}>{children}</SheetBody>
}

// Hoja inferior que se cierra deslizando hacia abajo (desde la barra o cuando el contenido está arriba del todo).
// Un movimiento rápido basta para cerrarla, aunque sea corto.
function SheetBody({ refEl, onClose, title, labelledBy, children }) {
  const drag = useRef(null)
  const start = (e, fromGrip) => {
    const el = refEl.current
    if (!el) return
    if (!fromGrip && el.scrollTop > 0) return
    drag.current = { y: e.touches ? e.touches[0].clientY : e.clientY, t: Date.now(), dy: 0, fromGrip }
    el.style.transition = 'none'
  }
  const move = (e) => {
    const d = drag.current
    const el = refEl.current
    if (!d || !el) return
    const y = e.touches ? e.touches[0].clientY : e.clientY
    let dy = y - d.y
    if (dy < 0) dy = dy * 0.2 // fricción hacia arriba
    if (!d.fromGrip && dy > 0 && el.scrollTop > 0) { drag.current = null; return }
    d.dy = dy
    if (dy > 0 && e.cancelable) e.preventDefault()
    el.style.transform = `translateY(${Math.max(dy, -20)}px)`
  }
  const end = () => {
    const d = drag.current
    const el = refEl.current
    drag.current = null
    if (!d || !el) return
    const v = d.dy / Math.max(1, Date.now() - d.t)
    el.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
    if (d.dy > 120 || v > 0.5) {
      el.style.transform = 'translateY(100%)'
      setTimeout(onClose, 200)
    } else el.style.transform = 'translateY(0)'
  }
  useEffect(() => {
    const el = refEl.current
    if (!el) return
    const onMove = (e) => move(e)
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  })
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={refEl}
        onTouchStart={(e) => start(e, false)} onTouchEnd={end} onTouchCancel={end}>
        <div className="sheet-grip-zone" onTouchStart={(e) => { e.stopPropagation(); start(e, true) }} onPointerDown={(e) => { if (e.pointerType === 'mouse') { start(e, true); const mm = (ev) => move(ev); const up = () => { end(); window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', up) }; window.addEventListener('pointermove', mm); window.addEventListener('pointerup', up) } }} aria-hidden="true">
          <div className="sheet-grip" />
        </div>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 12, gap: 8 }}>
          {title ? <h2 id={labelledBy} style={{ margin: 0 }}>{title}</h2> : <span />}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
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
