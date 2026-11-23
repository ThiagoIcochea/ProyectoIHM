import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, Square, Volume2, VolumeX, CheckCircle2 } from 'lucide-react'
import { useBreath } from '../lib/breath'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { playAmbient, stopAmbient, SOUNDS } from '../lib/sound'
import { Segmented, Switch, VoiceHints } from '../components/ui'

export function BreathPanel({ compact = false, id = 'breathe' }) {
  const v = useVoice()
  const [guide, setGuide] = useState(true)
  const [sound, setSound] = useState('off')
  const [done, setDone] = useState(false)
  const b = useBreath({
    onPhase: (p) => guide && v.speak(p.label, { force: true }),
    onDone: () => {
      setDone(true)
      if (guide) v.speak('Muy bien. Terminaste un minuto de respiración.', { force: true })
    }
  })

  useEffect(() => {
    if (sound === 'off') stopAmbient()
    else playAmbient(sound, 0.45)
  }, [sound])
  useEffect(() => () => stopAmbient(), [])

  const begin = () => {
    setDone(false)
    b.start()
  }

  useVoiceCommands(
    id,
    [
      { re: /\b(empez\w*|inici\w*|comenz\w*|vamos)\b/, label: 'empezar', run: begin },
      { re: /\b(pausa|pausar|espera)\b/, label: 'pausar', run: b.pause, say: 'En pausa.' },
      { re: /\b(continua\w*|reanuda\w*|sigue)\b/, label: 'continuar', run: b.resume },
      { re: /\b(deten\w*|terminar|parar|para ya)\b/, label: 'detener', run: b.stop, say: 'Detenido.' },
      { re: /\b(lluvia|olas|bosque)\b/, label: 'sonido de lluvia', run: (m) => setSound(m[1]), say: (m) => `Sonido de ${m[1]}.` },
      { re: /\b(sin sonido|quita(r)? (el )?sonido|apaga (el )?sonido)\b/, label: 'sin sonido', run: () => setSound('off') }
    ],
    [guide, b.running, b.started]
  )

  return (
    <div className="breathe">
      {!compact && (
        <div className="stack-sm" style={{ alignItems: 'center' }}>
          <h1>Respiración 4-4</h1>
          <p className="muted">Inhala, sostén y exhala 4 segundos. Cuatro ciclos, alrededor de un minuto.</p>
        </div>
      )}
      <div className="orb-wrap" style={compact ? { width: 'min(60vw, 220px)' } : undefined}>
        <div className="orb" data-phase={b.phase?.id || 'idle'} aria-hidden="true" />
        <div className="orb-label" aria-live="assertive">
          {b.phase ? (
            <span style={{ display: 'grid', placeItems: 'center', gap: 2 }}>
              {b.phase.label}
              <span className="tnum" style={{ fontSize: '2.2rem' }}>{b.left}</span>
            </span>
          ) : done ? (
            <CheckCircle2 size={48} />
          ) : (
            'Listo'
          )}
        </div>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(b.progress * 100)} aria-label="Avance">
        <i style={{ width: `${b.progress * 100}%` }} />
      </div>
      <p className="muted small tnum">{b.started ? `Ciclo ${b.cycle} de ${b.cycles}` : done ? 'Terminaste. ¿Cómo te sientes ahora?' : '4 ciclos · 1 minuto'}</p>

      <div className="row-wrap" style={{ justifyContent: 'center' }}>
        {!b.started ? (
          <button className="btn btn-primary" onClick={begin}><Play size={18} /> {done ? 'Repetir' : 'Empezar'}</button>
        ) : b.running ? (
          <button className="btn" onClick={b.pause}><Pause size={18} /> Pausar</button>
        ) : (
          <button className="btn btn-primary" onClick={b.resume}><Play size={18} /> Continuar</button>
        )}
        {b.started && <button className="btn btn-ghost" onClick={b.stop}><Square size={16} /> Detener</button>}
        {done && <Link className="btn" to="/checkin">Registrar cómo estoy</Link>}
      </div>

      {!compact && (
        <div className="card stack" style={{ width: 'min(100%, 520px)', textAlign: 'left' }}>
          <Switch id="guide" label="Guía por voz" hint="Dice “Inhala”, “Sostén” y “Exhala” en cada fase" checked={guide} onChange={setGuide} />
          <div className="field">
            <span className="label row" style={{ gap: 8 }}>{sound === 'off' ? <VolumeX size={18} /> : <Volume2 size={18} />} Sonido ambiental</span>
            <Segmented label="Sonido ambiental" value={sound} onChange={setSound} options={[{ value: 'off', label: 'Ninguno' }, ...Object.entries(SOUNDS).map(([value, label]) => ({ value, label }))]} />
          </div>
          <VoiceHints items={['empezar', 'pausar', 'sonido de olas', 'detener']} />
        </div>
      )}
    </div>
  )
}

export default function Breathe() {
  return <BreathPanel />
}
