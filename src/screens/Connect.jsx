import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Tv, Speaker, Lightbulb, Maximize2, Volume2, ArrowLeft } from 'lucide-react'
import { useHub, joinHub, leaveHub, ROLES } from '../lib/hub'
import { useBreath } from '../lib/breath'
import { playAmbient, stopAmbient, setAmbientVolume, SOUNDS, canChooseOutput, chooseOutput, setOutput } from '../lib/sound'
import { Logo } from '../components/AppShell'
import { toast } from '../components/Toast'

const LAMP = { calma: '#7CC0F8', calida: '#F3C06B', foco: '#F4F9FC' }
const ICON = { tv: Tv, parlante: Speaker, luz: Lightbulb }

// Mantiene la pantalla encendida mientras el dispositivo hace de TV o de luz
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return
    let lock
    const get = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    get()
    const vis = () => document.visibilityState === 'visible' && get()
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release?.() }
  }, [on])
}

function TvView({ state, breath }) {
  const b = useBreath({ sound: false, haptics: false })
  const lastAt = useRef(0)
  useEffect(() => {
    if (!breath || breath.at === lastAt.current) return
    lastAt.current = breath.at
    if (breath.action === 'start') b.start()
    else b.stop()
  }, [breath]) // eslint-disable-line react-hooks/exhaustive-deps
  const lamp = state?.lamp
  const color = lamp?.on ? LAMP[lamp.mode] : '#2F86D6'
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="tv-view" style={{ '--glow': color }}>
      <div className="tv-aurora" aria-hidden="true" />
      <div className="tv-orb" data-phase={b.phase?.id || 'idle'} />
      <div className="tv-text" aria-live="assertive">
        {b.phase ? <><span>{b.phase.label}</span><span className="tnum" style={{ fontSize: '0.6em', opacity: 0.8 }}>{b.left}</span></> : <span>Respira con calma</span>}
      </div>
      <div className="tv-foot">
        <span className="tnum">{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{state?.speaker?.on ? `Sonido: ${SOUNDS[state.speaker.sound]}` : 'Escucha · Hogar conectado'}</span>
        <span className="tnum">{state?.band ? `${state.band.bpm} lpm` : ''}</span>
      </div>
    </div>
  )
}

function SpeakerView({ state }) {
  const [unlocked, setUnlocked] = useState(false)
  const [outs, setOuts] = useState([])
  const [outName, setOutName] = useState('')
  const sp = state?.speaker
  useEffect(() => {
    if (!unlocked) return
    if (sp?.on) playAmbient(sp.sound, (sp.volume ?? 50) / 100)
    else stopAmbient()
  }, [unlocked, sp?.on, sp?.sound]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (unlocked && sp) setAmbientVolume(sp.volume / 100) }, [sp?.volume]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopAmbient(), [])
  const pick = async () => {
    try {
      const r = await chooseOutput()
      if (typeof r === 'string') setOutName(r)
      else setOuts(r)
    } catch { toast('No se pudo cambiar la salida de audio.', { tone: 'warn' }) }
  }
  return (
    <div className="role-view">
      <Speaker size={96} strokeWidth={1.4} className={sp?.on && unlocked ? 'pulse' : ''} />
      <h1>{sp?.on ? SOUNDS[sp.sound] : 'En silencio'}</h1>
      <p className="muted">{sp?.on ? `Volumen ${sp.volume} %` : 'El panel controla cuándo suena.'}</p>
      {!unlocked ? (
        <button className="btn btn-primary" onClick={() => setUnlocked(true)}><Volume2 size={18} /> Tocar para activar el sonido</button>
      ) : (
        <span className="tag tag-live">Sincronizado</span>
      )}
      {canChooseOutput && <button className="btn" onClick={pick}>Elegir salida (Bluetooth, TV…)</button>}
      {outName && <span className="muted small">Saliendo por: {outName}</span>}
      {outs.length > 0 && (
        <select className="select" style={{ maxWidth: 320 }} onChange={(e) => setOutput(e.target.value).then(() => setOutName(e.target.selectedOptions[0].text)).catch(() => {})} defaultValue="">
          <option value="" disabled>Elige una salida</option>
          {outs.map((o) => <option key={o.deviceId} value={o.deviceId}>{o.label || 'Salida de audio'}</option>)}
        </select>
      )}
    </div>
  )
}

function LightView({ state }) {
  const lamp = state?.lamp
  const on = lamp?.on
  const color = on ? LAMP[lamp.mode] : '#000000'
  return (
    <div className="light-view" style={{ background: color, filter: on ? `brightness(${0.35 + (lamp.level / 100) * 0.75})` : 'none' }}>
      {!on && <span style={{ color: '#4A6478' }}>Luz apagada</span>}
    </div>
  )
}

export default function Connect() {
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('codigo') || '').toUpperCase())
  const [role, setRole] = useState(params.get('rol') && ROLES[params.get('rol')] ? params.get('rol') : 'tv')
  const hub = useHub()
  const joined = hub.status === 'joined'
  useWakeLock(joined && role !== 'parlante')
  const autoTried = useRef(false)

  useEffect(() => {
    if (!autoTried.current && params.get('codigo') && params.get('rol')) {
      autoTried.current = true
      joinHub(params.get('codigo'), params.get('rol'), navigator.userAgent.includes('TV') ? 'Smart TV' : 'Dispositivo')
    }
  }, [params])
  useEffect(() => () => leaveHub(), [])

  const full = () => document.documentElement.requestFullscreen?.().catch(() => {})

  if (joined) {
    return (
      <div className="connect-full">
        {role === 'tv' && <TvView state={hub.state} breath={hub.breath} />}
        {role === 'parlante' && <SpeakerView state={hub.state} />}
        {role === 'luz' && <LightView state={hub.state} />}
        <div className="connect-bar">
          <span className="tag">{ROLES[role]} · {hub.code}</span>
          <button className="btn btn-sm" onClick={full} aria-label="Pantalla completa"><Maximize2 size={16} /></button>
          <button className="btn btn-sm" onClick={leaveHub}>Desconectar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="row between">
          <span className="brand"><Logo /> Escucha</span>
          <Link to="/m/iot" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> Volver</Link>
        </div>
        <div className="stack-sm">
          <h1>Conectar este dispositivo</h1>
          <p className="muted">Convierte este teléfono, tablet, laptop o Smart TV en parte de tu espacio de calma. Escribe el código que aparece en el panel del Hogar conectado.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="hub-code">Código</label>
          <input id="hub-code" className="input tnum" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" autoCapitalize="characters" spellCheck={false} style={{ letterSpacing: '0.2em', fontSize: '1.3rem' }} />
        </div>
        <div className="stack-sm" role="radiogroup" aria-label="Qué hará este dispositivo">
          <span className="label">Este dispositivo será…</span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {Object.entries(ROLES).map(([k, l]) => {
              const I = ICON[k]
              return (
                <button key={k} type="button" role="radio" aria-checked={role === k} className="card card-link" onClick={() => setRole(k)}
                  style={{ display: 'grid', placeItems: 'center', gap: 8, padding: 14, cursor: 'pointer', borderColor: role === k ? 'var(--primary)' : undefined, background: role === k ? 'var(--tint)' : undefined }}>
                  <I size={28} color={role === k ? 'var(--primary)' : 'currentColor'} />
                  <span className="small" style={{ fontWeight: 650 }}>{l}</span>
                </button>
              )
            })}
          </div>
        </div>
        {hub.error && <div className="notice warn" role="alert">{hub.error}</div>}
        <button className="btn btn-primary btn-block" disabled={hub.status === 'connecting' || code.length !== 6} onClick={() => joinHub(code, role, role === 'tv' ? 'Pantalla' : role === 'parlante' ? 'Parlante' : 'Luz')}>
          {hub.status === 'connecting' ? 'Conectando…' : 'Conectar'}
        </button>
        <p className="muted small">En una Smart TV abre esta página en su navegador. Con Chromecast o Android TV también puedes enviarla desde el panel con “Transmitir a la TV”.</p>
      </div>
    </div>
  )
}
