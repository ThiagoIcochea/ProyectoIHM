import { useEffect, useRef, useState } from 'react'
import { Trees, Waves, Moon, Play, Square, Camera, Glasses, Volume2, VolumeX } from 'lucide-react'
import { useBreath } from '../lib/breath'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { playAmbient, stopAmbient } from '../lib/sound'
import { HowTo } from '../components/ui'

// A-Frame (WebXR) se carga solo al entrar a esta pantalla, desde /vendor (sin CDN).
let aframePromise
function loadAFrame() {
  if (window.AFRAME) return Promise.resolve()
  if (!aframePromise) {
    aframePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = new URL('vendor/aframe.min.js', document.baseURI).href
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  return aframePromise
}

const SCENES = {
  bosque: { label: 'Bosque', icon: Trees, sky: '#BFE3F5', ground: '#5E9B6E', fog: '#CFE8F2', sound: 'bosque', text: '#0E293D' },
  playa: { label: 'Playa', icon: Waves, sky: '#FAD9BF', ground: '#E8D2A2', fog: '#F6E3CF', sound: 'olas', text: '#0E293D' },
  noche: { label: 'Noche', icon: Moon, sky: '#0B1A2A', ground: '#13283B', fog: '#0B1A2A', sound: 'lluvia', text: '#E7F1F8' }
}

// Números pseudoaleatorios estables para que la escena no cambie en cada render
function rng(seed) {
  let x = seed
  return () => ((x = (x * 16807) % 2147483647) / 2147483647)
}

function props(kind) {
  const r = rng(kind === 'bosque' ? 7 : kind === 'playa' ? 11 : 13)
  let out = ''
  if (kind === 'bosque') {
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2
      const d = 6 + r() * 18
      const x = (Math.cos(a) * d).toFixed(2)
      const z = (Math.sin(a) * d).toFixed(2)
      const h = (2.2 + r() * 2.8).toFixed(2)
      out += `<a-entity position="${x} 0 ${z}"><a-cylinder radius="0.12" height="1" position="0 0.5 0" color="#6B4F3A"></a-cylinder><a-cone radius-bottom="${(0.9 + r() * 0.6).toFixed(2)}" radius-top="0" height="${h}" position="0 ${(1 + h / 2).toFixed(2)} 0" color="${r() > 0.5 ? '#2F6B4F' : '#3E8462'}"></a-cone></a-entity>`
    }
  } else if (kind === 'playa') {
    out += `<a-plane id="sea" rotation="-90 0 0" position="0 0.05 -22" width="120" height="30" color="#4EA3EF" opacity="0.92" animation="property: position; to: 0 0.18 -22; dir: alternate; dur: 3000; loop: true; easing: easeInOutSine" hide-on-enter-ar></a-plane>`
    for (let i = 0; i < 8; i++) {
      out += `<a-sphere radius="${(0.2 + r() * 0.4).toFixed(2)}" position="${(r() * 16 - 8).toFixed(2)} 0.1 ${(-2 - r() * 6).toFixed(2)}" color="#BFA57A" hide-on-enter-ar></a-sphere>`
    }
    out += `<a-circle radius="2.4" position="9 9 -40" color="#FFE7B8" material="shader: flat" hide-on-enter-ar></a-circle>`
  } else {
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2
      const e = 0.15 + r() * 1.3
      const d = 60
      out += `<a-sphere radius="${(0.06 + r() * 0.12).toFixed(2)}" position="${(Math.cos(a) * Math.cos(e) * d).toFixed(1)} ${(Math.sin(e) * d).toFixed(1)} ${(Math.sin(a) * Math.cos(e) * d).toFixed(1)}" material="shader: flat; color: #F4F9FC" hide-on-enter-ar></a-sphere>`
    }
    out += `<a-circle radius="2" position="-10 14 -40" material="shader: flat; color: #E7F1F8" hide-on-enter-ar></a-circle>`
  }
  return out
}

function button3d(id, label, x, y = 0.95) {
  return `<a-entity id="${id}" class="clickable" position="${x} ${y} -2.4" geometry="primitive: plane; width: 0.9; height: 0.34" material="color: #0966BF; shader: flat; opacity: 0.95" animation__h1="property: scale; to: 1.08 1.08 1; startEvents: mouseenter; dur: 150" animation__h2="property: scale; to: 1 1 1; startEvents: mouseleave; dur: 150"><a-text value="${label}" align="center" color="#FFFFFF" width="3" position="0 0 0.01"></a-text></a-entity>`
}

function sceneHTML(kind) {
  const s = SCENES[kind]
  return `
  <a-scene embedded xr-mode-ui="enabled: true; XRMode: xr" renderer="antialias: true; colorManagement: true"
    webxr="optionalFeatures: local-floor, bounded-floor, hand-tracking, hit-test" fog="type: linear; color: ${s.fog}; near: 12; far: 70"
    cursor="rayOrigin: mouse" raycaster="objects: .clickable" loading-screen="enabled: false" device-orientation-permission-ui="enabled: true">
    <a-sky id="sky" color="${s.sky}" hide-on-enter-ar></a-sky>
    <a-entity light="type: ambient; intensity: ${kind === 'noche' ? 0.5 : 0.9}"></a-entity>
    <a-entity light="type: directional; intensity: ${kind === 'noche' ? 0.3 : 0.7}" position="2 6 3"></a-entity>
    <a-circle id="ground" rotation="-90 0 0" radius="40" color="${s.ground}" hide-on-enter-ar></a-circle>
    <a-entity id="props">${props(kind)}</a-entity>
    <a-sphere id="orb" position="0 1.6 -3.2" radius="0.45" scale="0.7 0.7 0.7" material="color: #7CC0F8; emissive: #2F86D6; emissiveIntensity: 0.6; opacity: 0.9; transparent: true"></a-sphere>
    <a-ring position="0 1.6 -3.25" radius-inner="0.78" radius-outer="0.8" material="color: #FFFFFF; shader: flat; opacity: 0.6; transparent: true"></a-ring>
    <a-text id="phase" value="Mira la esfera y respira" align="center" color="${s.text}" width="5" position="0 2.6 -3.2"></a-text>
    <a-text id="count" value="" align="center" color="${s.text}" width="8" position="0 0.75 -3.2"></a-text>
    ${button3d('b-start', 'Respirar', 0, 0.55)}
    ${button3d('b-bosque', 'Bosque', -1.05, 0.12)}
    ${button3d('b-playa', 'Playa', 0, 0.12)}
    ${button3d('b-noche', 'Noche', 1.05, 0.12)}
    <a-entity id="rig" position="0 0 0">
      <a-entity camera look-controls="pointerLockEnabled: false" wasd-controls="acceleration: 18" position="0 1.6 0"></a-entity>
      <a-entity laser-controls="hand: right" raycaster="objects: .clickable; far: 20" line="color: #7CC0F8; opacity: 0.8"></a-entity>
      <a-entity laser-controls="hand: left" raycaster="objects: .clickable; far: 20" line="color: #7CC0F8; opacity: 0.8"></a-entity>
    </a-entity>
  </a-scene>`
}

export default function Immersive() {
  const host = useRef(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')
  const [kind, setKind] = useState('bosque')
  const [mode, setMode] = useState('vr') // vr | camara
  const [audio, setAudio] = useState(false)
  const [camErr, setCamErr] = useState('')
  const video = useRef(null)
  const v = useVoice()
  const kindRef = useRef(kind)
  kindRef.current = kind

  const setOrb = (phase) => {
    const root = host.current
    if (!root) return
    const orb = root.querySelector('#orb')
    const txt = root.querySelector('#phase')
    if (!orb || !txt) return
    const big = phase === 'inhala' || phase === 'sosten'
    orb.setAttribute('animation', `property: scale; to: ${big ? '1.6 1.6 1.6' : '0.7 0.7 0.7'}; dur: 3800; easing: easeInOutSine`)
    txt.setAttribute('value', phase ? { inhala: 'Inhala', sosten: 'Sostén', exhala: 'Exhala' }[phase] : 'Mira la esfera y respira')
  }
  const b = useBreath({
    onPhase: (p) => {
      setOrb(p.id)
      v.speak(p.label, { force: true })
    },
    onDone: () => {
      setOrb(null)
      v.speak('Muy bien. Puedes quedarte aquí el tiempo que quieras.', { force: true })
    }
  })
  const bRef = useRef(b)
  bRef.current = b

  useEffect(() => {
    const el = host.current?.querySelector('#count')
    if (el) el.setAttribute('value', b.phase ? String(b.left) : '')
  }, [b.left, b.phase])

  // Montar la escena
  useEffect(() => {
    if (mode !== 'vr') return
    let alive = true
    loadAFrame()
      .then(() => {
        if (!alive || !host.current) return
        host.current.innerHTML = sceneHTML(kindRef.current)
        const root = host.current
        const on = (id, fn) => root.querySelector(id)?.addEventListener('click', fn)
        on('#b-start', () => (bRef.current.started ? bRef.current.stop() : bRef.current.start()))
        on('#b-bosque', () => setKind('bosque'))
        on('#b-playa', () => setKind('playa'))
        on('#b-noche', () => setKind('noche'))
        setReady(true)
      })
      .catch(() => setErr('No se pudo cargar el motor 3D.'))
    return () => {
      alive = false
      setReady(false)
      if (host.current) host.current.innerHTML = ''
    }
  }, [mode])

  // Cambiar de escena sin recrear el mundo (no te saca del visor)
  useEffect(() => {
    const root = host.current
    if (!ready || !root) return
    const sc = SCENES[kind]
    root.querySelector('#sky')?.setAttribute('color', sc.sky)
    root.querySelector('#ground')?.setAttribute('color', sc.ground)
    root.querySelector('a-scene')?.setAttribute('fog', `type: linear; color: ${sc.fog}; near: 12; far: 70`)
    root.querySelectorAll('#phase, #count').forEach((t) => t.setAttribute('color', sc.text))
    const pr = root.querySelector('#props')
    if (pr) pr.innerHTML = props(kind)
  }, [kind, ready])

  // Sonido de la escena
  useEffect(() => {
    if (audio) playAmbient(SCENES[kind].sound, 0.4)
    else stopAmbient()
  }, [audio, kind])
  useEffect(() => () => stopAmbient(), [])

  // Respaldo de RA con la cámara del móvil (sirve también en iPhone, que no tiene WebXR)
  useEffect(() => {
    if (mode !== 'camara') return
    let stream
    setCamErr('')
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setCamErr('No se pudo usar la cámara. Revisa el permiso del navegador.'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [mode])

  const enterVR = () => {
    const scene = host.current?.querySelector('a-scene')
    if (!scene) return
    if (navigator.xr) scene.enterVR?.()
    else scene.requestFullscreen?.()
  }

  useVoiceCommands(
    'immersive',
    [
      { re: /\b(bosque|playa|noche)\b/, label: 'bosque, playa o noche', run: (m) => setKind(m[1]), say: (m) => `Vamos a la ${m[1] === 'bosque' ? 'naturaleza del bosque' : m[1]}.` },
      { re: /\b(respir\w*|empez\w*)\b/, label: 'respirar', run: () => b.start() },
      { re: /\b(deten\w*|parar)\b/, label: 'detener', run: () => b.stop() },
      { re: /\b(camara|realidad aumentada)\b/, label: 'realidad aumentada', run: () => setMode('camara') },
      { re: /\b(realidad virtual|volver al santuario|modo 3d)\b/, label: 'realidad virtual', run: () => setMode('vr') },
      { re: /\b(sonido|musica)\b/, label: 'sonido', run: () => setAudio((a) => !a) },
      { re: /\b(entrar|entra|visor|inmersivo)\b/, label: 'entrar al visor', run: enterVR }
    ],
    [b.started]
  )

  const S = SCENES[kind]
  return (
    <div>
      <div className="vr-wrap">
        {mode === 'vr' ? (
          <div ref={host} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <>
            <video ref={video} className="ar-video" autoPlay playsInline muted />
            <div className="ar-orb" data-phase={b.phase?.id || 'idle'} aria-hidden="true" />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '18%', textAlign: 'center', color: '#fff', fontWeight: 750, fontSize: '1.6rem', textShadow: '0 2px 12px rgba(0,0,0,.6)' }} aria-live="assertive">
              {b.phase ? `${b.phase.label} · ${b.left}` : 'Mira la esfera y respira'}
            </div>
            {camErr && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 80 }}>{camErr}</div>}
          </>
        )}
        {!ready && mode === 'vr' && !err && <div className="glass" style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)' }}>Cargando el santuario 3D…</div>}
        {err && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 80 }}>{err}</div>}

        <div className="vr-overlay">
          <div className="glass" style={{ maxWidth: 360 }}>
            <b>Santuario de calma</b>
            <p className="muted small">{mode === 'vr' ? 'Arrastra para mirar alrededor, W A S D para moverte. Con visor, apunta y aprieta el gatillo.' : 'Realidad aumentada con tu cámara. Funciona también en iPhone.'}</p>
          </div>
          <div className="row-wrap">
            <button className="btn btn-sm" onClick={() => setAudio(!audio)} aria-pressed={audio}>{audio ? <Volume2 size={16} /> : <VolumeX size={16} />} Sonido</button>
            {mode === 'vr' ? (
              <button className="btn btn-sm" onClick={() => setMode('camara')}><Camera size={16} /> RA con cámara</button>
            ) : (
              <button className="btn btn-sm" onClick={() => setMode('vr')}><Glasses size={16} /> Volver al 3D</button>
            )}
          </div>
        </div>

        <div className="vr-bottom">
          {mode === 'vr' && Object.entries(SCENES).map(([k, s]) => {
            const I = s.icon
            return (
              <button key={k} className="btn btn-sm" aria-pressed={kind === k} style={kind === k ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => setKind(k)}>
                <I size={16} /> {s.label}
              </button>
            )
          })}
          {b.started ? (
            <button className="btn btn-sm" onClick={b.stop}><Square size={16} /> Detener</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={b.start}><Play size={16} /> Respirar</button>
          )}
          {mode === 'vr' && <button className="btn btn-sm" onClick={enterVR}><Glasses size={16} /> Entrar al visor</button>}
        </div>
      </div>
      <div style={{ padding: 16, maxWidth: 1000 }} className="stack">
        <div className="stack-sm">
          <span className="muted small">5 de 7 · WebXR · RV y RA</span>
          <h1>Santuario en realidad virtual</h1>
          <p className="muted">Un lugar tranquilo en 3D para hacer la respiración guiada, ahora en {S.label.toLowerCase()}. La esfera crece al inhalar y se encoge al exhalar.</p>
        </div>
        <HowTo
          items={[
            'Meta Quest: abre esta dirección en el navegador del visor (Meta Quest Browser), toca “Entrar al visor” o el botón VR y apunta a los paneles con el control.',
            'Apple Vision Pro: Safari de visionOS es compatible con WebXR, pero no pudimos probarlo en un equipo real.',
            'Android con Chrome: el botón AR de la escena coloca el santuario en tu habitación. En iPhone usa “RA con cámara”.',
            'Laptop: arrastra con el mouse para mirar y usa W A S D para caminar. En el móvil, mueve el teléfono para mirar alrededor.'
          ]}
        />
      </div>
    </div>
  )
}
