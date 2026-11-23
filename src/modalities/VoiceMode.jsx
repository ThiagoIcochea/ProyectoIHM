import { useEffect, useState } from 'react'
import { Mic, Square, AlertTriangle } from 'lucide-react'
import { useChat } from '../lib/chat'
import { useFreeText, useVoice, useVoiceCommands } from '../lib/voice'
import { setState } from '../lib/store'
import { hasKey } from '../lib/groq'
import { HowTo, Notice, VoiceHints } from '../components/ui'
import { MODALITIES } from '../lib/modalities'

const LABEL = { idle: 'Toca la esfera para empezar', listening: 'Te escucho', processing: 'Pensando', speaking: 'Hablando', unsupported: 'Tu navegador no permite voz' }

function useMicLevel(active) {
  const [lvl, setLvl] = useState(0)
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return
    let raf, stream, ctx
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream = s
        ctx = new (window.AudioContext || window.webkitAudioContext)()
        const an = ctx.createAnalyser()
        an.fftSize = 256
        ctx.createMediaStreamSource(s).connect(an)
        const d = new Uint8Array(an.fftSize)
        const loop = () => {
          an.getByteTimeDomainData(d)
          let p = 0
          for (const x of d) p = Math.max(p, Math.abs(x - 128))
          setLvl((prev) => prev * 0.7 + (p / 128) * 0.3)
          raf = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {})
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close()
    }
  }, [active])
  return lvl
}

export default function VoiceMode() {
  const meta = MODALITIES[2]
  const v = useVoice()
  const [on, setOn] = useState(false)
  const lvl = useMicLevel(on && v.status === 'listening')
  const { messages, busy, send } = useChat({ onReply: (t) => v.speak(t, { force: true }) })
  const recent = messages.slice(-6)

  const begin = () => {
    setOn(true)
    setState({ handsFree: true })
    v.speak('Hola. Estoy aquí para escucharte. ¿Cómo te sientes?', { force: true })
  }
  const end = () => {
    setOn(false)
    setState({ handsFree: false })
    v.stopListening()
    v.silence()
  }

  useFreeText('voice-mode', (t) => send(t, { spoken: true }), [send])
  useVoiceCommands('voice-mode', [{ re: /^(terminar|adios|chau|hasta luego|salir)( conversacion)?$/, label: 'terminar', run: end, say: 'Hasta pronto. Aquí estaré cuando me necesites.' }], [])

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="stack-sm">
        <span className="muted small">3 de 7 · {meta.tech}</span>
        <h1>{meta.name}</h1>
        <p className="muted">Habla con naturalidad. Escucha entiende, responde en voz alta y vuelve a escucharte, sin que toques nada. También puedes dar órdenes como “abre respiración”.</p>
      </div>

      {!v.supportsSR && (
        <Notice tone="warn" icon={AlertTriangle}>
          Este navegador no reconoce voz por sí solo. {hasKey() ? 'Usaré Whisper en Groq para transcribirte.' : 'Agrega tu clave de Groq en Perfil o abre la página en Chrome, Edge o Safari.'}
        </Notice>
      )}

      <div className="voice-stage">
        <button className="voice-orb" data-status={v.status} style={{ '--lvl': lvl }} onClick={on ? (v.status === 'speaking' ? v.silence : end) : begin} aria-label={on ? 'Terminar conversación por voz' : 'Empezar conversación por voz'}>
          {on ? <Square size={44} /> : <Mic size={56} />}
        </button>
        <div className="stack-sm" style={{ alignItems: 'center' }} aria-live="polite">
          <h2>{on ? LABEL[v.status] : LABEL.idle}</h2>
          <p className="muted" style={{ minHeight: '1.5em' }}>{v.interim || (busy ? '…' : on ? 'Puedes hablar cuando quieras' : '')}</p>
        </div>
        {recent.length > 0 && (
          <div className="transcript">
            {recent.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>{m.content}</div>
            ))}
          </div>
        )}
      </div>

      <HowTo
        items={[
          'Laptop o Android: usa Chrome o Edge y permite el micrófono. En iPhone usa Safari.',
          'Mientras Escucha habla deja de oír para no escucharse a sí misma; luego retoma sola.',
          'Di “terminar” para cerrar. Si nombras algo que suena a riesgo, te ofrecerá ayuda humana de inmediato.'
        ]}
      />
      <VoiceHints items={['me siento muy cansado', 'abre respiración', 'callate', 'terminar']} />
    </div>
  )
}
