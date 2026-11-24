import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setState, uid, useStore } from '../lib/store'
import { EMOTIONS } from '../lib/emotions'
import { Chip, Segmented, VoiceHints } from '../components/ui'
import { useVoiceCommands } from '../lib/voice'
import { norm } from '../lib/intents'
import { toast } from '../components/Toast'

const LEVELS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' }
]
const WORDS = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }

export default function Checkin() {
  const [params] = useSearchParams()
  const [sel, setSel] = useState(() => (params.get('e') ? [params.get('e')] : []))
  const [level, setLevel] = useState(3)
  const [note, setNote] = useState('')
  const navigate = useNavigate()
  const recent = useStore((st) => st.checkins).slice(0, 6)

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const save = (goChat = true) => {
    if (!sel.length) return toast('Elige al menos una emoción.', { tone: 'warn' })
    const entry = { id: uid(), date: new Date().toISOString(), emotions: sel, intensity: level, note: note.trim() }
    setState((s) => ({ checkins: [entry, ...s.checkins].slice(0, 200) }))
    const labels = sel.map((id) => EMOTIONS.find((e) => e.id === id).label.toLowerCase()).join(' y ')
    const seed = `Hoy siento ${labels}, con intensidad ${level} de 5.${note.trim() ? ` ${note.trim()}` : ''}`
    if (goChat) navigate('/chat', { state: { seed } })
    else {
      toast('Registro guardado')
      navigate('/')
    }
  }

  useVoiceCommands(
    'checkin',
    [
      { re: /\b(continuar|continua|listo|guardar|acompanamiento)\b/, label: 'continuar', run: () => save(true) },
      {
        re: /\b(intensidad|nivel)\s+(\d|uno|dos|tres|cuatro|cinco)\b/,
        label: 'intensidad 3',
        run: (m) => setLevel(Number(m[2]) || WORDS[m[2]]),
        say: (m) => `Intensidad ${m[2]}.`
      },
      {
        re: /\b(ansie\w*|triste\w*|tristeza|calma|enojo|enojad\w*|esperanza|confusion|confundid\w*)\b/,
        label: 'ansiedad, tristeza, calma…',
        run: (m, text) => {
          const t = norm(text)
          EMOTIONS.forEach((e) => e.re.test(t) && setSel((s) => (s.includes(e.id) ? s : [...s, e.id])))
        },
        say: 'Anotado.'
      }
    ],
    [sel, level, note]
  )

  return (
    <div className="checkin-layout">
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>¿Cómo te sientes hoy?</h1>
        <p>Puedes elegir más de una. No hay respuestas correctas.</p>
      </div>
      <div className="card stack">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 10 }}>Emociones</legend>
          <div className="row-wrap">
            {EMOTIONS.map((e) => (
              <Chip key={e.id} pressed={sel.includes(e.id)} onClick={() => toggle(e.id)}>
                {e.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <span className="label" id="lvl">¿Qué tan fuerte es? <span className="muted">(1 suave · 5 muy fuerte)</span></span>
          <Segmented label="Intensidad" value={level} options={LEVELS} onChange={setLevel} />
        </div>
        <div className="field">
          <label className="label" htmlFor="note">¿Quieres contar algo más? <span className="muted">(opcional)</span></label>
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe aquí…" maxLength={500} />
        </div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={() => save(true)}>Continuar al acompañamiento</button>
          <button className="btn" onClick={() => save(false)}>Solo guardar</button>
        </div>
      </div>
      <VoiceHints items={['me siento ansioso y triste', 'intensidad 4', 'continuar']} />
    </div>
    <aside className="stack checkin-side" aria-label="Tus últimos registros">
      <div className="card stack-sm">
        <h3>Tus últimos registros</h3>
        {recent.length === 0 ? <p className="muted small">Aún no hay registros. El primero aparecerá aquí.</p> : recent.map((c) => (
          <div key={c.id} className="row between" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="row-wrap" style={{ gap: 4 }}>{c.emotions.map((id) => { const e = EMOTIONS.find((x) => x.id === id); return e ? <span key={id} className="tag"><span className="dot" style={{ color: e.color }} /> {e.label}</span> : null })}</span>
            <span className="muted small tnum" style={{ whiteSpace: 'nowrap' }}>{c.intensity}/5 · {new Date(c.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
          </div>
        ))}
      </div>
      <div className="card stack-sm">
        <h3>¿Para qué sirve?</h3>
        <p className="muted small">Ponerle nombre a lo que sientes ayuda a regularlo. Con el tiempo verás patrones: qué días pesan más y qué te ayuda.</p>
      </div>
    </aside>
    </div>
  )
}
