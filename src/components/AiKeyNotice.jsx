import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { hasKey, setDeviceKey, testKey, explainError, cleanKey } from '../lib/groq'
import { setState, useStore } from '../lib/store'

// Aviso con campo para activar la IA sin salir de la pantalla
export default function AiKeyNotice({ who = 'Escucha' }) {
  useStore((s) => s.groqKey)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  if (hasKey()) return null
  const save = async () => {
    const k = cleanKey(key)
    if (!k) return
    setState({ groqKey: k })
    setDeviceKey(k)
    setMsg('Verificando…')
    try { await testKey(); setMsg('IA activada.') } catch (e) { setMsg(explainError(e)) }
  }
  return (
    <div className="notice warn" style={{ alignItems: 'flex-start' }}>
      <Sparkles size={18} aria-hidden="true" />
      <div className="stack-sm" style={{ flex: 1 }}>
        <span><b>{who} está en modo básico.</b> Sin IA entiende temas y te devuelve preguntas, pero no conversa de verdad. Con tu clave de Groq responde a lo que dices.</span>
        {open ? (
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_…" aria-label="Clave de Groq" autoComplete="off" />
            <button className="btn btn-primary btn-sm" onClick={save}>Activar</button>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Activar IA</button>
        )}
        {msg && <span className="small">{msg}</span>}
      </div>
    </div>
  )
}
