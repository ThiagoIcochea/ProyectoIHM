import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Send, Mic, Trash2, Sparkles, LifeBuoy, Bot, Wind, BookOpen } from 'lucide-react'
import { useChat, SUGGESTIONS } from '../lib/chat'
import { useFreeText, useVoice, useVoiceCommands } from '../lib/voice'
import { hasKey } from '../lib/groq'
import { useStore } from '../lib/store'
import { Notice, Sheet } from '../components/ui'
import Helplines from '../components/Helplines'

export function ChatPanel({ compact = false, id = 'chat' }) {
  const v = useVoice()
  const [draft, setDraft] = useState('')
  const logRef = useRef(null)
  const endRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  useStore((s) => s.groqKey)
  const ai = hasKey()

  const { messages, busy, crisis, setCrisis, send, clear } = useChat({
    onReply: (text, { spoken, crisis: c }) => {
      if (spoken || v.handsFree || c) v.speak(text, { force: spoken || c })
    }
  })

  // Mensaje inicial desde el check-in o desde una frase dicha en otra pantalla
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    const seed = location.state?.seed || v.consumePendingChat()
    if (seed) {
      send(seed, { spoken: !location.state?.seed })
      navigate('.', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, busy])

  useFreeText(id, (text) => send(text, { spoken: true }), [send])
  useVoiceCommands(
    id,
    [
      { re: /^(borrar|limpiar|nueva) (conversacion|chat)$/, label: 'borrar conversación', run: clear, say: 'Conversación borrada.' },
      { re: /^(lee|leer|repite) (la )?(ultima )?respuesta$/, label: 'repite la respuesta', run: () => { const m = [...messages].reverse().find((x) => x.role === 'assistant'); if (m) v.speak(m.content, { force: true }) } }
    ],
    [messages]
  )

  const submit = (e) => {
    e?.preventDefault()
    if (!draft.trim()) return
    send(draft)
    setDraft('')
    document.getElementById(`${id}-input`)?.style.removeProperty('height')
  }

  return (
    <div className="chat" style={{ flex: 1 }}>
      {!compact && (
        <Notice icon={Bot}>
          <span className={`tag ${ai ? 'tag-live' : 'tag-sim'}`} style={{ marginRight: 6 }}>{ai ? 'IA activa' : 'Modo básico'}</span>
          <b style={{ color: 'var(--ink)' }}>Escucha · Asistente IA.</b> No es un profesional. Puedes pedir apoyo humano desde <Link to="/ayuda">SOS</Link>.
          {!ai && <> Ahora responde en modo básico; para respuestas con IA agrega tu clave en <Link to="/perfil#ia">Perfil</Link>.</>}
        </Notice>
      )}

      <div className="chat-log" ref={logRef} aria-live="polite" aria-label="Conversación">
        {messages.length === 0 && (
          <div className="stack-sm" style={{ padding: '24px 0', textAlign: 'center', alignItems: 'center' }}>
            <span className="ico-tile" style={{ width: 56, height: 56 }}><Sparkles size={26} /></span>
            <h2>Estamos aquí para escucharte</h2>
            <p className="muted">Escribe o habla. Nada de lo que digas se comparte con tu colegio ni con tu familia.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}${m.crisis ? ' crisis' : ''}`}>
            {m.content}
            {!m.crisis && m.actions?.length > 0 && (
              <div className="row-wrap" style={{ marginTop: 10 }}>
                {m.actions.includes('respirar') && <Link className="btn btn-tint btn-sm" to="/respirar"><Wind size={16} /> Respirar 1 min</Link>}
                {m.actions.includes('diario') && <Link className="btn btn-tint btn-sm" to="/diario"><BookOpen size={16} /> Abrir diario</Link>}
                {m.actions.includes('sos') && <Link className="btn btn-tint btn-sm" to="/ayuda"><LifeBuoy size={16} /> Pausa segura</Link>}
              </div>
            )}
            {m.crisis && (
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-danger btn-sm" onClick={() => setCrisis(true)}>
                  <LifeBuoy size={16} /> Ver líneas de ayuda
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="msg assistant" aria-label="Escribiendo">
            <span className="typing"><i /><i /><i /></span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="suggestions" aria-label="Sugerencias">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={submit} style={compact ? { position: 'static', margin: 0, boxShadow: 'none' } : undefined}>
        <label htmlFor={`${id}-input`} className="sr-only">Mensaje</label>
        <textarea
          id={`${id}-input`}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          placeholder="Escribe aquí…"
          maxLength={1000}
        />
        <button type="button" className="icon-btn" onClick={v.toggleListening} aria-label="Hablar" style={{ color: v.status === 'listening' ? 'var(--success)' : 'var(--ink-2)' }}>
          <Mic size={22} />
        </button>
        <button type="submit" className="btn btn-primary" style={{ minWidth: 48, padding: '0 14px' }} aria-label="Enviar" disabled={!draft.trim() || busy}>
          <Send size={18} />
        </button>
      </form>
      {!compact && messages.length > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={clear}>
          <Trash2 size={16} /> Borrar conversación
        </button>
      )}

      <Sheet open={crisis} onClose={() => setCrisis(false)} title="No estás a solas">
        <div className="stack">
          <p className="muted">Habla ahora con una persona. Estas líneas son gratuitas en Perú.</p>
          <Helplines />
          <Link className="btn btn-block" to="/ayuda" onClick={() => setCrisis(false)}>Más opciones de pausa segura</Link>
        </div>
      </Sheet>
    </div>
  )
}

export default function Chat() {
  return (
    <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '60dvh' }}>
      <ChatPanel />
    </div>
  )
}
