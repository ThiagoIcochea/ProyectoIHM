import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Heart, Wind, LifeBuoy, Smile } from 'lucide-react'
import { useBreath } from '../lib/breath'
import { setState, uid, useStore } from '../lib/store'
import { EMOTIONS } from '../lib/emotions'
import { useVoiceCommands } from '../lib/voice'
import { vibrate } from '../lib/sound'
import { HowTo, VoiceHints } from '../components/ui'
import { MODALITIES } from '../lib/modalities'

const SCREENS = ['face', 'breathe', 'mood', 'sos']
const MOOD6 = EMOTIONS.slice(0, 6)

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Watch() {
  const meta = MODALITIES[0]
  const now = useClock()
  const bpm = useStore((s) => s.iot.band.bpm)
  const checkins = useStore((s) => s.checkins)
  const [screen, setScreen] = useState(0)
  const [full, setFull] = useState(false)
  const [hold, setHold] = useState(0)
  const [sent, setSent] = useState(false)
  const [moodSaved, setMoodSaved] = useState(null)
  const holdRef = useRef(null)
  const wheelLock = useRef(0)
  const touchY = useRef(null)
  const b = useBreath({ sound: false })

  const go = (d) => {
    setScreen((s) => (s + d + SCREENS.length) % SCREENS.length)
    vibrate(10)
  }
  const goTo = (name) => setScreen(SCREENS.indexOf(name))

  // Corona digital: rueda del mouse / trackpad o flechas
  const onWheel = (e) => {
    const t = performance.now()
    if (t - wheelLock.current < 350) return
    wheelLock.current = t
    go(e.deltaY > 0 ? 1 : -1)
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') go(1)
      if (e.key === 'ArrowUp') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // SOS: mantener presionado 2 segundos (evita toques accidentales)
  const startHold = () => {
    const t0 = performance.now()
    vibrate(20)
    holdRef.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / 2000)
      setHold(p)
      if (p >= 1) {
        clearInterval(holdRef.current)
        vibrate([200, 100, 200, 100, 400])
        setSent(true)
      }
    }, 30)
  }
  const endHold = () => {
    clearInterval(holdRef.current)
    if (hold < 1) setHold(0)
  }

  const saveMood = (e) => {
    setState((s) => ({ checkins: [{ id: uid(), date: new Date().toISOString(), emotions: [e.id], intensity: 3, note: 'Desde el reloj' }, ...s.checkins] }))
    setMoodSaved(e)
    vibrate([30, 40, 30])
    setTimeout(() => setMoodSaved(null), 1800)
  }

  useVoiceCommands(
    'watch',
    [
      { re: /\b(siguiente|baja|abajo)\b/, label: 'siguiente', run: () => go(1) },
      { re: /\b(anterior|sube|arriba)\b/, label: 'anterior', run: () => go(-1) },
      { re: /\b(respir\w*|empezar)\b/, label: 'respirar', run: () => { goTo('breathe'); b.start() }, say: 'Respira conmigo.' },
      { re: /\b(sos|alerta|ayuda)\b/, label: 'SOS', run: () => goTo('sos') },
      { re: /\b(hora|esfera|inicio del reloj)\b/, label: 'hora', run: () => goTo('face'), say: () => `Son las ${new Date().toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}.` },
      { re: /\b(pantalla completa|maximiza\w*)\b/, label: 'pantalla completa', run: () => setFull(true) },
      { re: /\b(pulso|ritmo|latidos)\b/, label: 'mi pulso', run: () => goTo('face'), say: () => `Tu pulso es de ${bpm} latidos por minuto.` }
    ],
    [bpm]
  )

  const name = SCREENS[screen]
  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })

  const face = (
    <div
      className="watch-screen"
      onWheel={onWheel}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current == null) return
        const dy = e.changedTouches[0].clientY - touchY.current
        if (Math.abs(dy) > 40) go(dy < 0 ? 1 : -1)
        touchY.current = null
      }}
      aria-live="polite"
      aria-label={`Pantalla del reloj: ${name}`}
    >
      <div className="w-dots" aria-hidden="true">{SCREENS.map((s, i) => <i key={s} className={i === screen ? 'on' : ''} />)}</div>

      {name === 'face' && (
        <>
          <span className="w-sub">{date}</span>
          <span className="w-time">{time}</span>
          <span className="w-comp">
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Heart size={14} color="#ff8a80" fill="#ff8a80" /> {bpm}</span>
            <span>·</span>
            <span>{checkins.length} registros</span>
          </span>
          <button className="w-btn" onClick={() => { goTo('breathe'); b.start() }}>Respirar</button>
        </>
      )}

      {name === 'breathe' && (
        <>
          <div className="watch-orb" data-phase={b.phase?.id || 'idle'} />
          <span style={{ fontWeight: 700, fontSize: 'calc(var(--size) * 0.06)' }}>{b.phase ? `${b.phase.label} ${b.left}` : 'Respira 1 min'}</span>
          {b.started ? (
            <button className="w-btn alt" onClick={b.stop}>Detener</button>
          ) : (
            <button className="w-btn" onClick={b.start}>Empezar</button>
          )}
        </>
      )}

      {name === 'mood' && (
        <>
          <span className="w-sub">{moodSaved ? 'Guardado' : '¿Cómo estás?'}</span>
          {moodSaved ? (
            <span style={{ fontSize: 'calc(var(--size) * 0.07)', fontWeight: 700, color: moodSaved.color }}>{moodSaved.label}</span>
          ) : (
            <div className="watch-moods">
              {MOOD6.map((e) => (
                <button key={e.id} style={{ background: e.color }} onClick={() => saveMood(e)} aria-label={e.label}>
                  {e.label.slice(0, 4)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {name === 'sos' && (
        <>
          {sent ? (
            <>
              <span style={{ fontWeight: 700, fontSize: 'calc(var(--size) * 0.06)' }}>Alerta lista</span>
              <span className="w-sub">Llama al 113, opción 5</span>
              <a className="w-btn danger" href="tel:113" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Llamar 113</a>
              <button className="w-btn alt" onClick={() => { setSent(false); setHold(0) }}>Cancelar</button>
            </>
          ) : (
            <>
              <span className="w-sub">Mantén presionado 2 s</span>
              <button
                className="w-btn danger"
                style={{ width: '62%', aspectRatio: 1, borderRadius: '50%', position: 'relative', fontSize: 'calc(var(--size) * 0.07)' }}
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="SOS: mantén presionado dos segundos"
              >
                SOS
                <svg className="hold-ring" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="6" strokeDasharray={`${hold * 289} 289`} transform="rotate(-90 50 50)" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
        </>
      )}
    </div>
  )

  const device = (
    <div className="watch">
      <span className="watch-strap top" aria-hidden="true" />
      <span className="watch-strap bottom" aria-hidden="true" />
      <div className="watch-body">
        {face}
        <button className="watch-crown" onClick={() => go(1)} aria-label="Corona: siguiente pantalla" />
        <button className="watch-btn" onClick={() => goTo('sos')} aria-label="Botón lateral: SOS" />
      </div>
    </div>
  )

  if (full) {
    return (
      <div className="watch-full">
        {device}
        <button className="btn btn-sm" style={{ position: 'fixed', top: 16, right: 16 }} onClick={() => setFull(false)}><Minimize2 size={16} /> Salir</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="mod-head">
        <div className="stack-sm" style={{ maxWidth: 560 }}>
          <span className="muted small">1 de 7 · {meta.tech}</span>
          <h1>{meta.name}</h1>
          <p className="muted">{meta.short} Las interacciones son de un toque, con vibración y textos de una línea, pensadas para una pantalla de 2 cm.</p>
        </div>
        <button className="btn" onClick={() => setFull(true)}><Maximize2 size={18} /> Pantalla completa</button>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="watch-stage">{device}</div>
        <div className="stack">
          <div className="card stack-sm">
            <h3>Pantallas</h3>
            <div className="row-wrap">
              {[['face', 'Hora y pulso', Heart], ['breathe', 'Respirar', Wind], ['mood', 'Cómo estoy', Smile], ['sos', 'SOS', LifeBuoy]].map(([k, l, I]) => (
                <button key={k} className="chip" aria-pressed={name === k} onClick={() => goTo(k)}><I size={16} /> {l}</button>
              ))}
            </div>
          </div>
          <HowTo
            items={[
              'Laptop: gira la rueda del mouse o usa las flechas ↑ ↓ como si fuera la corona digital.',
              'Móvil: desliza hacia arriba o abajo sobre la esfera. La vibración funciona en Android.',
              'Reloj real: abre esta misma dirección en el navegador del reloj (Wear OS) y toca Pantalla completa.',
              'Reloj real por Bluetooth: en Perfil → Mis dispositivos vincula tu reloj; si comparte su pulso, aparece aquí y puedes enviarle avisos.'
            ]}
          />
          <VoiceHints items={['respirar', 'siguiente', 'SOS', 'mi pulso', 'qué hora es']} />
        </div>
      </div>
    </div>
  )
}
