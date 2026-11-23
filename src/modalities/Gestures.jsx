import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hand, Grab, ThumbsUp, Pointer, Camera, CameraOff } from 'lucide-react'
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import { setState, uid } from '../lib/store'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { chime, vibrate } from '../lib/sound'
import { HowTo, Sheet } from '../components/ui'
import { toast } from '../components/Toast'
import { MODALITIES } from '../lib/modalities'

const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

const GESTURES = {
  Open_Palm: { label: 'Mano abierta', action: 'Inhala: la luz crece', icon: Hand, key: 'p' },
  Closed_Fist: { label: 'Puño', action: 'Exhala: la luz baja', icon: Grab, key: 'f' },
  Thumb_Up: { label: 'Pulgar arriba', action: 'Registrar “me siento mejor”', icon: ThumbsUp, key: 't' },
  Pointing_Up: { label: 'Índice arriba (2 s)', action: 'Pedir ayuda', icon: Pointer, key: 'h' }
}

export default function Gestures() {
  const meta = MODALITIES[6]
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const recRef = useRef(null)
  const rafRef = useRef(0)
  const streamRef = useRef(null)
  const holdRef = useRef({ name: null, since: 0, fired: false })
  const phaseRef = useRef('none')
  const [status, setStatus] = useState('off') // off | loading | on | error
  const [err, setErr] = useState('')
  const [current, setCurrent] = useState(null)
  const [breaths, setBreaths] = useState(0)
  const [glow, setGlow] = useState(0.2)
  const [askHelp, setAskHelp] = useState(false)
  const navigate = useNavigate()
  const v = useVoice()

  const act = (name) => {
    if (name === 'Open_Palm') {
      setGlow(1)
      if (phaseRef.current !== 'in') {
        phaseRef.current = 'in'
        chime(432, 0.6, 0.06)
      }
    } else if (name === 'Closed_Fist') {
      setGlow(0.15)
      if (phaseRef.current === 'in') {
        setBreaths((b) => b + 1)
        chime(396, 0.6, 0.06)
        vibrate(30)
      }
      phaseRef.current = 'out'
    } else if (name === 'Thumb_Up') {
      setState((s) => ({ checkins: [{ id: uid(), date: new Date().toISOString(), emotions: ['calma'], intensity: 3, note: 'Gesto: me siento mejor' }, ...s.checkins] }))
      toast('Registrado: me siento mejor')
      v.speak('Qué bueno. Lo anoté.', { force: true })
    } else if (name === 'Pointing_Up') {
      setAskHelp(true)
    }
  }

  // Un gesto se confirma cuando se mantiene: 0,4 s (respiración) o 1,2-2 s (registro y ayuda) para evitar falsos positivos
  const feed = (name) => {
    const h = holdRef.current
    const now = performance.now()
    if (name !== h.name) {
      holdRef.current = { name, since: now, fired: false }
      return
    }
    const need = name === 'Pointing_Up' ? 2000 : name === 'Thumb_Up' ? 1200 : 400
    if (!h.fired && name && GESTURES[name] && now - h.since > need) {
      h.fired = true
      act(name)
    }
  }

  const start = async () => {
    setStatus('loading')
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (!recRef.current) {
        const fileset = await FilesetResolver.forVisionTasks(new URL('vendor/mediapipe', document.baseURI).href)
        try {
          recRef.current = await GestureRecognizer.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 })
        } catch {
          recRef.current = await GestureRecognizer.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 1 })
        }
      }
      setStatus('on')
      loop()
    } catch (e) {
      setStatus('error')
      setErr(e?.name === 'NotAllowedError' ? 'Permite la cámara para usar los gestos.' : 'No se pudo iniciar la cámara o el modelo de gestos. Puedes probar con el teclado: P, F, T y H.')
      stop(false)
    }
  }

  let last = 0
  const loop = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const rec = recRef.current
    if (!video || !rec || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const now = performance.now()
    if (now - last > 66) {
      last = now
      const res = rec.recognizeForVideo(video, now)
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (res.landmarks?.length) {
        const du = new DrawingUtils(ctx)
        for (const lm of res.landmarks) {
          du.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, { color: '#7CC0F8', lineWidth: 4 })
          du.drawLandmarks(lm, { color: '#FFFFFF', lineWidth: 1, radius: 3 })
        }
      }
      const g = res.gestures?.[0]?.[0]
      const name = g && g.score > 0.6 && g.categoryName !== 'None' ? g.categoryName : null
      setCurrent(name ? { name, score: g.score } : null)
      feed(name)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const stop = (reset = true) => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (reset) setStatus('off')
    setCurrent(null)
  }
  useEffect(() => () => stop(false), [])

  // Respaldo con teclado para probar sin cámara
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const entry = Object.entries(GESTURES).find(([, g]) => g.key === e.key.toLowerCase())
      if (entry) {
        setCurrent({ name: entry[0], score: 1 })
        act(entry[0])
        setTimeout(() => setCurrent(null), 600)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useVoiceCommands(
    'gestures',
    [
      { re: /\b(activa\w*|enciend\w*|prend\w*|abre) (la )?camara\b|\bempezar\b/, label: 'activa la cámara', run: () => status !== 'on' && start() },
      { re: /\b(apaga\w*|deten\w*) (la )?camara\b/, label: 'apaga la cámara', run: () => stop() }
    ],
    [status]
  )

  const glowColor = `rgba(78, 163, 239, ${0.15 + glow * 0.55})`
  return (
    <div className="stack">
      <div className="mod-head">
        <div className="stack-sm" style={{ maxWidth: 640 }}>
          <span className="muted small">7 de 7 · Interfaces emergentes · {meta.tech}</span>
          <h1>{meta.name}</h1>
          <p className="muted">Respira sin tocar la pantalla: abre la mano al inhalar y cierra el puño al exhalar. La luz responde a tu ritmo. La imagen se procesa en tu dispositivo y no se envía a ningún servidor.</p>
        </div>
        {status === 'on' ? (
          <button className="btn" onClick={() => stop()}><CameraOff size={18} /> Apagar cámara</button>
        ) : (
          <button className="btn btn-primary" onClick={start} disabled={status === 'loading'}><Camera size={18} /> {status === 'loading' ? 'Cargando modelo…' : 'Activar cámara'}</button>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="gest-stage" style={{ boxShadow: `0 0 0 6px ${glowColor}, 0 0 ${40 + glow * 80}px ${glowColor}` }}>
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} />
          {status !== 'on' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#E7F1F8', textAlign: 'center', padding: 24 }}>
              <div className="stack-sm" style={{ alignItems: 'center' }}>
                <Hand size={48} aria-hidden="true" />
                <p>{status === 'loading' ? 'Preparando el reconocimiento de manos…' : err || 'Activa la cámara para empezar'}</p>
              </div>
            </div>
          )}
          <div className="gest-badge">
            <span className="tag" style={{ background: 'rgba(11,21,29,.7)', color: '#fff', borderColor: 'transparent' }} aria-live="polite">
              {current ? `${GESTURES[current.name]?.label || current.name} · ${Math.round(current.score * 100)} %` : 'Sin gesto'}
            </span>
          </div>
          <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 2 }}>
            <span className="tag" style={{ background: 'rgba(11,21,29,.7)', color: '#fff', borderColor: 'transparent' }}>Respiraciones: <b className="tnum">{breaths}</b></span>
          </div>
        </div>
        <div className="stack">
          <div className="gest-legend">
            {Object.entries(GESTURES).map(([k, g]) => {
              const I = g.icon
              return (
                <div key={k} className="item" data-on={current?.name === k}>
                  <span className="ico-tile"><I size={20} /></span>
                  <span><b>{g.label}</b><br /><span className="muted small">{g.action} · tecla {g.key.toUpperCase()}</span></span>
                </div>
              )
            })}
          </div>
          <HowTo
            items={[
              'Laptop: activa la cámara, pon la mano a unos 50 cm y mantén el gesto un momento.',
              'Móvil: usa la cámara frontal con buena luz.',
              'Sin cámara: usa las teclas P (mano abierta), F (puño), T (pulgar) y H (ayuda).',
              'El modelo de MediaPipe se descarga la primera vez desde los servidores de Google; después el reconocimiento ocurre en tu dispositivo.'
            ]}
          />
        </div>
      </div>

      <Sheet open={askHelp} onClose={() => setAskHelp(false)} title="¿Quieres pedir ayuda?">
        <div className="stack">
          <p className="muted">Detecté el gesto de ayuda. Puedes abrir las opciones de pausa segura o seguir aquí.</p>
          <div className="row-wrap">
            <button className="btn btn-danger" onClick={() => navigate('/ayuda')}>Abrir SOS</button>
            <button className="btn" onClick={() => setAskHelp(false)}>Seguir aquí</button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
