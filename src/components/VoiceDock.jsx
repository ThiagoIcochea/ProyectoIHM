import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
import { useVoice } from '../lib/voice'
import { setState, useStore } from '../lib/store'

const STATUS_TEXT = {
  idle: 'Toca para hablar',
  listening: 'Te escucho…',
  processing: 'Pensando…',
  speaking: 'Hablando…',
  unsupported: 'Voz no disponible'
}

export default function VoiceDock() {
  const v = useVoice()
  const captions = useStore((s) => s.captions)
  const active = v.status !== 'idle' && v.status !== 'unsupported'
  const showPill = captions && (active || v.heard)

  return (
    <div className="voice-dock">
      {showPill && (
        <div className="voice-pill" aria-live="polite">
          <span className="vp-status">
            {v.status === 'listening' ? (
              <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>
            ) : v.status === 'speaking' ? (
              <Volume2 size={14} aria-hidden="true" />
            ) : v.status === 'processing' ? (
              <Loader2 size={14} aria-hidden="true" />
            ) : null}
            {STATUS_TEXT[v.status]}
            {v.handsFree && v.wakeWord ? ' · di “Escucha…”' : ''}
          </span>
          <span className="vp-text">{v.interim || v.heard || 'Di, por ejemplo: “abre respiración”'}</span>
          {!v.interim && v.status === 'listening' && <span className="vp-hint">“qué puedo decir” muestra más órdenes</span>}
        </div>
      )}
      <button
        className="hf-toggle"
        aria-pressed={v.handsFree}
        onClick={() => setState({ handsFree: !v.handsFree })}
        title="Escuchar siempre, sin tocar el micrófono"
      >
        <span className="dot" aria-hidden="true" /> Manos libres
      </button>
      <button
        className="mic-fab"
        data-coach="mic"
        data-status={v.status}
        onClick={v.toggleListening}
        aria-label={active ? 'Detener micrófono' : 'Hablar con Escucha (atajo: tecla V)'}
        title="Atajo: tecla V"
      >
        <span className="ring" aria-hidden="true" />
        {v.status === 'unsupported' ? <MicOff size={26} /> : <Mic size={26} />}
      </button>
    </div>
  )
}
