import { useState } from 'react'
import { Mic, Save, Trash2, BookOpen } from 'lucide-react'
import { setState, uid, useStore } from '../lib/store'
import { EMOTIONS, emotionById } from '../lib/emotions'
import { useFreeText, useVoice, useVoiceCommands } from '../lib/voice'
import { Chip, VoiceHints } from '../components/ui'
import { toast } from '../components/Toast'

export function JournalPanel({ compact = false, id = 'journal' }) {
  const entries = useStore((s) => s.journal)
  const v = useVoice()
  const [text, setText] = useState('')
  const [mood, setMood] = useState(null)
  const [dictating, setDictating] = useState(false)

  const save = () => {
    if (!text.trim()) return toast('Escribe o dicta algo primero.', { tone: 'warn' })
    setState((s) => ({ journal: [{ id: uid(), date: new Date().toISOString(), mood, text: text.trim() }, ...s.journal].slice(0, 300) }))
    setText('')
    setMood(null)
    setDictating(false)
    toast('Guardado en tu diario')
  }
  const remove = (eid) => setState((s) => ({ journal: s.journal.filter((e) => e.id !== eid) }))

  const toggleDictation = () => {
    const on = !dictating
    setDictating(on)
    if (on && v.status !== 'listening') v.startListening()
    if (on) toast('Dictado activo: lo que digas se escribe. Di “guardar” para terminar.')
  }

  // Mientras se dicta, el texto libre se agrega a la entrada
  useFreeText(`${id}-dict`, dictating ? (t) => setText((p) => (p ? `${p} ${t}` : t)) : undefined, [dictating], true)
  useVoiceCommands(
    id,
    [
      { re: /^(guardar|guarda|guardar entrada)$/, label: 'guardar', run: save },
      { re: /^(dictar|empezar a dictar|escribir por voz)$/, label: 'dictar', run: () => { setDictating(true); toast('Dictado activo') }, say: 'Te escucho. Di guardar cuando termines.' },
      { re: /^(borrar texto|limpiar)$/, label: 'borrar texto', run: () => setText('') }
    ],
    [text, mood]
  )

  return (
    <div className={compact ? 'stack' : 'journal-layout'}>
      <div className="card stack journal-editor">
        <div className="field">
          <label className="label" htmlFor={`${id}-t`}>¿Qué pasó hoy?</label>
          <textarea id={`${id}-t`} className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe lo que quieras. Solo tú lo ves." maxLength={2000} />
        </div>
        {!compact && (
          <div className="row-wrap" role="group" aria-label="Emoción de esta entrada">
            {EMOTIONS.map((e) => (
              <Chip key={e.id} pressed={mood === e.id} onClick={() => setMood(mood === e.id ? null : e.id)}>{e.label}</Chip>
            ))}
          </div>
        )}
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={save}><Save size={18} /> Guardar</button>
          <button className="btn" aria-pressed={dictating} onClick={toggleDictation} style={dictating ? { borderColor: 'var(--success)', color: 'var(--success)' } : undefined}>
            <Mic size={18} /> {dictating ? 'Dictando…' : 'Dictar'}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="stack-sm" style={{ textAlign: 'center', alignItems: 'center', padding: '16px 0' }}>
          <span className="ico-tile"><BookOpen size={22} /></span>
          <p className="muted">Tu diario está vacío. La primera entrada puede ser una sola frase.</p>
        </div>
      ) : (
        <div className="stack-sm">
          {entries.slice(0, compact ? 3 : 50).map((e) => {
            const emo = emotionById(e.mood)
            return (
              <article key={e.id} className="card stack-sm" style={{ padding: 14 }}>
                <div className="row between">
                  <span className="muted small">
                    {new Date(e.date).toLocaleString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    {emo && <span className="tag"><span className="dot" style={{ color: emo.color }} /> {emo.label}</span>}
                    <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => remove(e.id)} aria-label="Borrar entrada"><Trash2 size={16} /></button>
                  </div>
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Journal() {
  return (
    <div>
      <div className="page-head">
        <h1>Diario emocional</h1>
        <p>Escribir lo que sientes ayuda a ordenarlo. Se guarda solo en este dispositivo.</p>
      </div>
      <JournalPanel />
      <div style={{ marginTop: 16 }}>
        <VoiceHints items={['dictar', 'guardar', 'borrar texto']} />
      </div>
    </div>
  )
}
