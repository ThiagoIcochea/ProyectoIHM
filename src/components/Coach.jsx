import { useEffect, useLayoutEffect, useState } from 'react'

// Coach marks: resaltan SOS, micrófono y experiencias la primera vez.
export default function Coach({ steps, onDone }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i]

  useLayoutEffect(() => {
    const measure = () => {
      const els = [...document.querySelectorAll(step.target)].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
      const el = els[0]
      if (!el) return setRect(null)
      el.scrollIntoView({ block: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const vw = window.innerWidth
  const vh = window.innerHeight
  let tipTop = rect ? rect.top + rect.height + 12 : vh / 2 - 80
  if (rect && tipTop + 190 > vh) tipTop = Math.max(12, rect.top - 190)
  const tipLeft = rect ? Math.min(Math.max(16, rect.left + rect.width / 2 - 160), vw - Math.min(320, vw - 32) - 16) : 16

  return (
    <div className="coach" role="dialog" aria-modal="true" aria-labelledby="coach-t">
      {rect && <div className="coach-hole" style={rect} />}
      {!rect && <div className="coach-hole" style={{ top: vh / 2, left: vw / 2, width: 0, height: 0 }} />}
      <div className="coach-tip" style={{ top: tipTop, left: tipLeft }}>
        <span className="muted small">{i + 1} de {steps.length}</span>
        <h3 id="coach-t">{step.title}</h3>
        <p className="muted small">{step.text}</p>
        <div className="row between">
          <button className="btn btn-ghost btn-sm" onClick={onDone}>Omitir</button>
          <button className="btn btn-primary btn-sm" autoFocus onClick={() => (i < steps.length - 1 ? setI(i + 1) : onDone())}>
            {i < steps.length - 1 ? 'Siguiente' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
