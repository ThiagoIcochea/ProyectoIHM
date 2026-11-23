import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOff, Wind, HeartHandshake, Mic, ShieldCheck, BookOpen, MessageCircle, LifeBuoy } from 'lucide-react'
import { setState } from '../lib/store'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { Logo } from '../components/AppShell'

const STEPS = [
  {
    title: 'Aquí puedes ser tú, sin dar tu nombre.',
    text: 'Escucha es anónimo. No te pedimos tu nombre real, tu colegio ni tu número. Lo que escribes se queda en este dispositivo.',
    icons: [EyeOff, ShieldCheck]
  },
  {
    title: 'Una pausa pequeña puede ayudarte.',
    text: 'Respira un minuto, escribe en tu diario o conversa con el asistente cuando lo necesites.',
    icons: [Wind, BookOpen, MessageCircle]
  },
  {
    title: 'Si necesitas más apoyo, no estás a solas.',
    text: 'El botón SOS, siempre arriba, te conecta con un adulto de confianza o con la Línea 113, opción 5, gratuita y las 24 horas.',
    icons: [HeartHandshake, LifeBuoy]
  }
]

function Illus({ icons }) {
  return (
    <div className="onb-illus" aria-hidden="true">
      <div style={{ display: 'flex', gap: 16 }}>
        {icons.map((Icon, i) => (
          <span key={i} style={{ width: 88, height: 88, borderRadius: 28, background: 'var(--surface)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-1)', transform: `translateY(${i % 2 ? 14 : -6}px)` }}>
            <Icon size={40} />
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Onboarding() {
  const [i, setI] = useState(0)
  const [alias, setAlias] = useState('')
  const navigate = useNavigate()
  const v = useVoice()
  const last = i === STEPS.length

  const finish = () => {
    setState({ onboarded: true, alias: alias.trim().slice(0, 24) })
    navigate('/', { replace: true })
  }
  const next = () => (last ? finish() : setI(i + 1))
  const prev = () => setI(Math.max(0, i - 1))

  useVoiceCommands(
    'onboarding',
    [
      { re: /\b(siguiente|continuar|continua|adelante)\b/, label: 'siguiente', run: next },
      { re: /\b(atras|anterior)\b/, label: 'atrás', run: prev },
      { re: /\b(omitir|saltar)\b/, label: 'omitir', run: () => setI(STEPS.length) },
      { re: /\b(comenzar|empezar|listo|entrar)\b/, label: 'comenzar', run: finish },
      { re: /\b(?:me llamo|mi apodo es|llamame)\s+(\w+)/, label: 'mi apodo es…', run: (m) => setAlias(m[1]) }
    ],
    [i, alias]
  )

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="row between">
          <span className="brand"><Logo /> Escucha</span>
          {!last && (
            <button className="btn btn-ghost btn-sm" onClick={() => setI(STEPS.length)}>
              Omitir
            </button>
          )}
        </div>
        <div className="steps" aria-label={`Paso ${i + 1} de ${STEPS.length + 1}`}>
          {[...STEPS, 0].map((_, k) => (
            <i key={k} className={k <= i ? 'on' : ''} />
          ))}
        </div>

        {!last ? (
          <>
            <Illus icons={STEPS[i].icons} />
            <div className="stack-sm" aria-live="polite">
              <h1>{STEPS[i].title}</h1>
              <p className="muted">{STEPS[i].text}</p>
            </div>
          </>
        ) : (
          <>
            <div className="stack-sm">
              <h1>¿Cómo quieres que te llamemos?</h1>
              <p className="muted">Puede ser un apodo. Es opcional y puedes cambiarlo en Perfil.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="alias">Apodo</label>
              <input id="alias" className="input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Por ejemplo: Luna" maxLength={24} autoComplete="off" />
            </div>
            <div className="notice">
              <Mic size={18} aria-hidden="true" />
              <div>
                <b style={{ color: 'var(--ink)' }}>También puedes usar tu voz.</b> Toca el micrófono o pulsa la tecla V y di, por ejemplo, “abre respiración” o “necesito ayuda”.
              </div>
            </div>
          </>
        )}

        <div className="row" style={{ gap: 10 }}>
          {i > 0 && (
            <button className="btn" onClick={prev}>
              Atrás
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={next}>
            {last ? 'Comenzar' : 'Siguiente'}
          </button>
          <button className="icon-btn" onClick={v.toggleListening} aria-label="Hablar" data-status={v.status} style={{ border: '1px solid var(--border-strong)', width: 48, height: 48, color: v.status === 'listening' ? 'var(--success)' : 'var(--ink)' }}>
            <Mic size={22} />
          </button>
        </div>
        {v.heard && <p className="muted small" aria-live="polite">Escuché: “{v.heard}”</p>}
      </div>
    </div>
  )
}
