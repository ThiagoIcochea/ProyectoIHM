import { useEffect, useRef, useState } from 'react'
import { Trees, Waves, Moon, Mountain, Orbit, Flower2, Play, Square, Camera, Glasses, Volume2, VolumeX, Smartphone, Hand, LocateFixed, Flame, Users, Copy, LogOut, Share2 } from 'lucide-react'
import { WORLDS, buildWorld, skyTexture, breathParticles, terrainAttr, envAttr, arSanctuary, arFogata } from './vrWorlds'
import { registerXR } from './xr'
import { useRoom, createRoom, joinRoom, leaveRoom, sendPose, sendReaction, sendBreath, onRemoteBreath, REACTIONS } from '../lib/rooms'
import { Sheet } from '../components/ui'
import { toast } from '../components/Toast'
import { assetsHTML } from './textures'
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

const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window
const needsIOSPermission = typeof window !== 'undefined' && typeof window.DeviceOrientationEvent?.requestPermission === 'function'

function cameraHTML(motion) {
  return `<a-entity id="cam" camera look-controls="pointerLockEnabled: false; magicWindowTrackingEnabled: false; enabled: ${!motion}" wasd-controls="acceleration: 18" gyro-smooth="enabled: ${motion}" position="0 1.6 0"></a-entity>`
}

// Escena de RA sobre la cámara (funciona también en iPhone): fondo transparente, iluminación por entorno y texturas reales
function arCameraHTML(motion, arScene) {
  const piece = arScene === 'fogata'
    ? arFogata('cam-sanctuary', 'position="0 0.75 -1.7"')
    : arSanctuary('cam-sanctuary', 'position="0 0.9 -1.7" rotation="10 0 0"')
  return `
  <a-scene embedded vr-mode-ui="enabled: false" xr-mode-ui="enabled: false" renderer="alpha: true; antialias: true; colorManagement: true"
    background="transparent: true" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false" cursor="rayOrigin: mouse"
    env-light="top: #9CC4E0; horizon: #E8E2D6; ground: #5E5244; exposure: 1.05">
    ${assetsHTML()}
    <a-entity light="type: hemisphere; color: #FFFFFF; groundColor: #6E604F; intensity: 0.65"></a-entity>
    <a-entity light="type: directional; intensity: 1.25; color: #FFF1DC" position="1.5 3 2"></a-entity>
    ${piece}
    <a-entity id="avatars" position="0 ${arScene === 'fogata' ? 0.75 : 0.9} -1.7"></a-entity>
    <a-text id="ar-phase" value="Mira la esfera y respira" align="center" color="#FFFFFF" width="2.4" position="0 1.78 -1.8"></a-text>
    <a-text id="ar-count" value="" align="center" color="#FFFFFF" width="4" position="0 1.56 -1.8"></a-text>
    ${cameraHTML(motion)}
  </a-scene>`
}

const ICONS = { bosque: Trees, playa: Waves, noche: Moon, fogata: Flame, montana: Mountain, espacio: Orbit, jardin: Flower2 }
const SCENES = Object.fromEntries(Object.entries(WORLDS).map(([k, w]) => [k, { ...w, icon: ICONS[k] }]))

function button3d(id, label, x, y = 0.95, color = '#0966BF', w = 0.9) {
  return `<a-entity id="${id}" class="clickable" position="${x} ${y} -2.4" geometry="primitive: plane; width: ${w}; height: 0.3" material="color: ${color}; shader: flat; opacity: 0.95" animation__h1="property: scale; to: 1.08 1.08 1; startEvents: mouseenter; dur: 150" animation__h2="property: scale; to: 1 1 1; startEvents: mouseleave; dur: 150"><a-text value="${label}" align="center" color="#FFFFFF" width="2.6" position="0 0 0.01"></a-text></a-entity>`
}

function sceneHTML(kind, motion) {
  const s = SCENES[kind]
  const keys = Object.keys(SCENES)
  const worldButtons = keys.map((k, i) => button3d(`b-${k}`, SCENES[k].label, ((i % 4) - 1.5) * 0.95, i < 4 ? 0.5 : 0.16, '#24435C', 0.88)).join('')
  return `
  <a-scene embedded xr-mode-ui="enabled: true; XRMode: xr" renderer="antialias: true; colorManagement: true"
    webxr="optionalFeatures: local-floor, bounded-floor, hand-tracking, hit-test, light-estimation" ar-hit-test="target: #ar-sanctuary; type: footprint" ${s.fog ? `fog="type: linear; color: ${s.fog}; near: 14; far: 80"` : ''}
    cursor="rayOrigin: mouse" raycaster="objects: .clickable" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false" env-light="${envAttr(s)}">
    ${assetsHTML()}
    <a-sky id="sky" src="${skyTexture(s.sky)}" hide-on-enter-ar></a-sky>
    <a-entity id="amb" light="type: ambient; intensity: ${s.ambient}"></a-entity>
    <a-entity id="sun" light="type: directional; intensity: ${s.sun}; color: ${s.sunColor}" position="3 8 4"></a-entity>
    <a-entity id="ground" ${s.terrain ? `terrain="${terrainAttr(s)}"` : ''} visible="${!!s.terrain}" hide-on-enter-ar></a-entity>
    <a-entity id="avatars"></a-entity>
    ${arSanctuary('ar-sanctuary', 'position="0 0 -1.2" visible="false"')}
    <a-entity id="props">${buildWorld(kind)}</a-entity>
    <a-cylinder radius="0.9" height="0.06" position="0 0.03 0" material="color: #FFFFFF; opacity: 0.25; transparent: true" hide-on-enter-ar></a-cylinder>
    <a-sphere id="orb" position="0 1.6 -3.2" radius="0.45" scale="0.7 0.7 0.7" material="color: #7CC0F8; emissive: #2F86D6; emissiveIntensity: 0.7; opacity: 0.92; transparent: true"></a-sphere>
    <a-entity light="type: point; color: #7CC0F8; intensity: 0.6; distance: 6" position="0 1.6 -3"></a-entity>
    <a-ring position="0 1.6 -3.25" radius-inner="0.78" radius-outer="0.8" material="color: #FFFFFF; shader: flat; opacity: 0.6; transparent: true"></a-ring>
    ${breathParticles()}
    <a-text id="phase" value="Mira la esfera y respira" align="center" color="${s.text}" width="5" position="0 2.65 -3.2"></a-text>
    <a-text id="desc" value="${s.label}: ${s.desc}" align="center" color="${s.text}" width="3.2" position="0 2.32 -3.2"></a-text>
    <a-text id="count" value="" align="center" color="#FFFFFF" width="7" position="0 1.6 -2.6"></a-text>
    ${button3d('b-start', 'Respirar', 0, 0.86, '#0966BF', 1.1)}
    ${worldButtons}
    <a-entity id="rig" position="0 0 0">
      ${cameraHTML(motion)}
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
  const [arScene, setArScene] = useState('santuario') // santuario | fogata
  const [roomOpen, setRoomOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const room = useRoom()
  const inRoom = room.status === 'host' || room.status === 'member'
  const [audio, setAudio] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [motion, setMotion] = useState(isTouch && !needsIOSPermission)
  const motionRef = useRef(motion)
  motionRef.current = motion
  const video = useRef(null)
  const v = useVoice()
  const kindRef = useRef(kind)
  kindRef.current = kind

  const setOrb = (phase) => {
    const root = host.current
    if (!root) return
    const big = phase === 'inhala' || phase === 'sosten'
    const label = phase ? { inhala: 'Inhala', sosten: 'Sostén', exhala: 'Exhala' }[phase] : 'Mira la esfera y respira'
    root.querySelector('#orb')?.setAttribute('animation', `property: scale; to: ${big ? '1.6 1.6 1.6' : '0.7 0.7 0.7'}; dur: 3800; easing: easeInOutSine`)
    root.querySelectorAll('#ar-sanctuary-orb, #cam-sanctuary-orb').forEach((o) => o.setAttribute('animation', `property: scale; to: ${big ? '1.5 1.5 1.5' : '0.7 0.7 0.7'}; dur: 3800; easing: easeInOutSine`))
    root.querySelectorAll('#phase, #ar-phase').forEach((t) => t.setAttribute('value', label))
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
  const startRef = useRef(null)
  const stopRef = useRef(null)

  useEffect(() => {
    host.current?.querySelectorAll('#count, #ar-count').forEach((el) => el.setAttribute('value', b.phase ? String(b.left) : ''))
  }, [b.left, b.phase])

  // Montar la escena
  useEffect(() => {
    let alive = true
    loadAFrame()
      .then(() => {
        if (!alive || !host.current) return
        registerXR()
        host.current.innerHTML = mode === 'vr' ? sceneHTML(kindRef.current, motionRef.current) : arCameraHTML(motionRef.current, arScene)
        const root = host.current
        const sc = root.querySelector('a-scene')
        // En RA con WebXR se muestra el mini santuario texturizado; toca una superficie para colocarlo
        sc?.addEventListener('enter-vr', () => { if (sc.is('ar-mode')) root.querySelector('#ar-sanctuary')?.setAttribute('visible', true) })
        sc?.addEventListener('exit-vr', () => root.querySelector('#ar-sanctuary')?.setAttribute('visible', false))
        const on = (id, fn) => root.querySelector(id)?.addEventListener('click', fn)
        on('#b-start', () => (bRef.current.started ? stopRef.current() : startRef.current()))
        Object.keys(SCENES).forEach((k) => on(`#b-${k}`, () => setKind(k)))
        setReady(true)
      })
      .catch(() => setErr('No se pudo cargar el motor 3D.'))
    return () => {
      alive = false
      setReady(false)
      if (host.current) host.current.innerHTML = ''
    }
  }, [mode, arScene])

  // Cambiar de escena sin recrear el mundo (no te saca del visor)
  useEffect(() => {
    const root = host.current
    if (!ready || !root || mode !== 'vr') return
    const sc = SCENES[kind]
    root.querySelector('#sky')?.setAttribute('src', skyTexture(sc.sky))
    const g = root.querySelector('#ground')
    if (g) {
      g.setAttribute('visible', !!sc.terrain)
      if (sc.terrain) g.setAttribute('terrain', { size: 140, seg: 160, height: 6, flat: 9, scale: 0.035, low: '#4E8A3A', mid: '#7A9A4A', high: '#8E8A80', peak: '#F1F4F7', snow: 999, tex: 'grass', repeat: 48, ...sc.terrain }, true)
    }
    root.querySelector('a-scene')?.setAttribute('env-light', envAttr(sc))
    const scene = root.querySelector('a-scene')
    if (sc.fog) scene?.setAttribute('fog', `type: linear; color: ${sc.fog}; near: 14; far: 80`)
    else scene?.removeAttribute('fog')
    root.querySelector('#amb')?.setAttribute('light', `type: ambient; intensity: ${sc.ambient}`)
    root.querySelector('#sun')?.setAttribute('light', `type: directional; intensity: ${sc.sun}; color: ${sc.sunColor}`)
    root.querySelectorAll('#phase, #desc').forEach((t) => t.setAttribute('color', sc.text))
    root.querySelector('#desc')?.setAttribute('value', `${sc.label}: ${sc.desc}`)
    const pr = root.querySelector('#props')
    if (pr) pr.innerHTML = buildWorld(kind)
  }, [kind, ready, mode])

  // Cambiar entre mover con el teléfono (giroscopio suavizado) o con el dedo, sin recrear la escena
  useEffect(() => {
    const cam = host.current?.querySelector('#cam')
    if (!cam) return
    cam.setAttribute('gyro-smooth', 'enabled', motion)
    cam.setAttribute('look-controls', 'enabled', !motion)
  }, [motion, ready])

  const toggleMotion = async () => {
    if (!motion && needsIOSPermission) {
      try {
        const r = await window.DeviceOrientationEvent.requestPermission()
        if (r !== 'granted') return
      } catch { return }
    }
    setMotion(!motion)
  }
  const recenter = () => host.current?.querySelector('a-scene')?.emit('recenter')

  // ---------- Sala compartida: avatares que siguen la orientación de cada dispositivo ----------
  useEffect(() => {
    onRemoteBreath((action) => {
      if (action === 'start') { bRef.current.start(); toast('Respiración en grupo') }
      else bRef.current.stop()
    })
    return () => onRemoteBreath(null)
  }, [])

  useEffect(() => {
    if (!inRoom || !ready) return
    const t = setInterval(() => {
      const cam = host.current?.querySelector('#cam')
      const q = cam?.object3D?.quaternion
      if (q) sendPose([q.x, q.y, q.z, q.w], bRef.current.running)
    }, 100)
    return () => clearInterval(t)
  }, [inRoom, ready])

  useEffect(() => {
    const box = host.current?.querySelector('#avatars')
    if (!box || !ready) return
    const list = Object.values(room.members)
    const ids = new Set(list.map((m) => m.id))
    box.querySelectorAll('.avatar').forEach((el) => { if (!ids.has(el.dataset.id)) el.remove() })
    const vrMode = mode === 'vr'
    const R = vrMode ? 2.1 : 0.78
    const SCALE = vrMode ? 1 : 0.3
    const SEATS = [-55, 55, -110, 110, 180]
    list.forEach((m, i) => {
      let el = box.querySelector(`.avatar[data-id="${m.id}"]`)
      const a = (SEATS[i % SEATS.length] * Math.PI) / 180
      const x = Math.sin(a) * R
      const z = vrMode ? -Math.cos(a) * R : Math.cos(a) * R
      if (!el) {
        el = document.createElement('a-entity')
        el.className = 'avatar'
        el.dataset.id = m.id
        el.setAttribute('position', `${x.toFixed(2)} 0 ${z.toFixed(2)}`)
        el.setAttribute('rotation', `0 ${((Math.atan2(x, vrMode ? z : z + 0.0001) * 180) / Math.PI + (vrMode ? 0 : 180)).toFixed(1)} 0`)
        el.setAttribute('scale', `${SCALE} ${SCALE} ${SCALE}`)
        el.innerHTML = `
          <a-cylinder class="body" radius="0.24" radius-top="0.18" height="0.8" position="0 0.45 0" material="color: ${m.color}; roughness: 0.6"></a-cylinder>
          <a-sphere radius="0.2" position="0 0.88 0" material="color: ${m.color}; roughness: 0.5"></a-sphere>
          <a-entity class="head" position="0 1.12 0" avatar-head>
            <a-sphere radius="0.19" material="color: #F4ECE4; roughness: 0.55"></a-sphere>
            <a-box width="0.26" height="0.07" depth="0.06" position="0 0.03 -0.16" material="color: #0E293D; metalness: 0.3; roughness: 0.2"></a-box>
          </a-entity>
          <a-text class="name" value="${m.name.replace(/"/g, '')}" align="center" width="2.2" color="#FFFFFF" position="0 1.5 0" rotation="0 180 0"></a-text>
          <a-text class="bubble" value="" align="center" width="2.4" color="${m.color}" position="0 1.72 0" rotation="0 180 0"></a-text>`
        box.appendChild(el)
      }
      const head = el.querySelector('.head')
      if (m.q && head?.components?.['avatar-head']) head.components['avatar-head'].setPose(m.q)
      const bubble = el.querySelector('.bubble')
      bubble?.setAttribute('value', m.react && Date.now() - (m.reactAt || 0) < 4500 ? REACTIONS[m.react] : '')
      const body = el.querySelector('.body')
      if (body) {
        if (m.breath) body.setAttribute('animation', 'property: scale; from: 1 1 1; to: 1.12 1.05 1.12; dir: alternate; loop: true; dur: 4000; easing: easeInOutSine')
        else body.removeAttribute('animation')
      }
    })
  }, [room.members, ready, mode])

  const startBreath = () => {
    b.start()
    if (inRoom) sendBreath('start')
  }
  const stopBreath = () => {
    b.stop()
    if (inRoom) sendBreath('stop')
  }
  startRef.current = startBreath
  stopRef.current = stopBreath
  const shareCode = async () => {
    const text = `Únete a mi sala de calma en Escucha con el código ${room.code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(room.code); toast('Código copiado') }
    } catch { /* cancelado */ }
  }

  // Sonido de la escena
  useEffect(() => {
    if (audio) playAmbient(mode === 'camara' ? (arScene === 'fogata' ? 'fogata' : 'lluvia') : SCENES[kind].sound, 0.4)
    else stopAmbient()
  }, [audio, kind, mode, arScene])
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
      { re: /\b(fogata|fuego)\b/, label: 'fogata', run: () => (mode === 'camara' ? setArScene('fogata') : setKind('fogata')), say: 'Vamos a la fogata.' },
      { re: /\b(santuario)\b/, label: 'santuario', run: () => (mode === 'camara' ? setArScene('santuario') : setKind('bosque')) },
      { re: /\b(bosque|playa|noche|montana|espacio|jardin)\b/, label: 'bosque, playa, noche, montaña, espacio o jardín', run: (m) => { setMode('vr'); setKind(m[1]) }, say: (m) => `Vamos ${{ bosque: 'al bosque', playa: 'a la playa', noche: 'a la noche', montana: 'a la montaña', espacio: 'al espacio', jardin: 'al jardín zen' }[m[1]]}.` },
      { re: /\b(crea\w*|abrir|abre) (una )?sala\b/, label: 'crear sala', run: () => { setRoomOpen(true); createRoom().catch(() => {}) } },
      { re: /\b(salir de la sala|dejar la sala)\b/, label: 'salir de la sala', run: () => leaveRoom() },
      { re: /\b(te acompano|respira conmigo|gracias|estoy aqui)\b/, label: 'te acompaño', run: (m) => inRoom && sendReaction({ 'te acompano': 'acompano', 'respira conmigo': 'respira', gracias: 'gracias', 'estoy aqui': 'aqui' }[m[1]]) },
      { re: /\b(respir\w*|empez\w*)\b/, label: 'respirar', run: () => startBreath() },
      { re: /\b(deten\w*|parar)\b/, label: 'detener', run: () => stopBreath() },
      { re: /\b(camara|realidad aumentada)\b/, label: 'realidad aumentada', run: () => setMode('camara') },
      { re: /\b(realidad virtual|volver al santuario|modo 3d)\b/, label: 'realidad virtual', run: () => setMode('vr') },
      { re: /\b(sonido|musica)\b/, label: 'sonido', run: () => setAudio((a) => !a) },
      { re: /\b(entrar|entra|visor|inmersivo)\b/, label: 'entrar al visor', run: enterVR }
    ],
    [b.started, mode, inRoom]
  )

  const S = SCENES[kind]
  return (
    <div>
      <div className="vr-wrap">
        {mode === 'camara' && <video ref={video} className="ar-video" autoPlay playsInline muted />}
        <div ref={host} key={mode} style={{ position: 'absolute', inset: 0 }} />
        {mode === 'camara' && camErr && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 120, zIndex: 6 }}>{camErr}</div>}
        {!ready && !err && <div className="glass" style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)' }}>Cargando el santuario 3D…</div>}
        {err && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 80 }}>{err}</div>}

        <div className="vr-overlay">
          <div className="glass" style={{ maxWidth: 360 }}>
            <b>Santuario de calma</b>
            <p className="muted small">{mode === 'vr' ? 'Arrastra para mirar alrededor, W A S D para moverte. Con visor, apunta y aprieta el gatillo.' : (arScene === 'fogata' ? 'Una fogata con fuego, chispas y humo aparece sobre tu cámara.' : 'Un santuario con piedra, musgo, agua en movimiento y una vela aparece sobre tu cámara.') + ' Funciona también en iPhone.'}{isTouch ? (motion ? ' Mueve el teléfono para mirar.' : ' Desliza con el dedo para mirar.') : ''}</p>
          </div>
          <div className="row-wrap">
            {isTouch && (
              <button className="btn btn-sm" onClick={toggleMotion} aria-pressed={motion} title="Cómo mirar alrededor">
                {motion ? <Smartphone size={16} /> : <Hand size={16} />} {motion ? 'Con el teléfono' : 'Con el dedo'}
              </button>
            )}
            {isTouch && motion && <button className="btn btn-sm" onClick={recenter} aria-label="Recentrar la vista"><LocateFixed size={16} /></button>}
            <button className="btn btn-sm" onClick={() => setRoomOpen(true)} aria-label="Sala compartida" style={inRoom ? { borderColor: 'var(--success)', color: 'var(--success)' } : undefined}>
              <Users size={16} /> {inRoom ? `${room.code} · ${Object.keys(room.members).length + 1}` : 'Sala personal'}
            </button>
            <button className="btn btn-sm" onClick={() => setAudio(!audio)} aria-pressed={audio}>{audio ? <Volume2 size={16} /> : <VolumeX size={16} />} Sonido</button>
            {mode === 'vr' ? (
              <button className="btn btn-sm" onClick={() => setMode('camara')}><Camera size={16} /> RA con cámara</button>
            ) : (
              <button className="btn btn-sm" onClick={() => setMode('vr')}><Glasses size={16} /> Volver al 3D</button>
            )}
          </div>
        </div>

        <div className="vr-bottom">
          {mode === 'camara' && [['santuario', 'Santuario', Flower2], ['fogata', 'Fogata', Flame]].map(([k, l, I]) => (
            <button key={k} className="btn btn-sm" aria-pressed={arScene === k} style={arScene === k ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => setArScene(k)}>
              <I size={16} /> {l}
            </button>
          ))}
          {inRoom && Object.entries(REACTIONS).slice(0, 2).map(([k, l]) => (
            <button key={k} className="btn btn-sm" onClick={() => sendReaction(k)}>{l}</button>
          ))}
          {mode === 'vr' && Object.entries(SCENES).map(([k, s]) => {
            const I = s.icon
            return (
              <button key={k} className="btn btn-sm" aria-pressed={kind === k} style={kind === k ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => setKind(k)}>
                <I size={16} /> {s.label}
              </button>
            )
          })}
          {b.started ? (
            <button className="btn btn-sm" onClick={stopBreath}><Square size={16} /> Detener</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={startBreath}><Play size={16} /> {inRoom ? 'Respirar juntos' : 'Respirar'}</button>
          )}
          {mode === 'vr' && <button className="btn btn-sm" onClick={enterVR}><Glasses size={16} /> Entrar al visor</button>}
        </div>
      </div>
      <div style={{ padding: 16, maxWidth: 1000 }} className="stack">
        <div className="stack-sm">
          <span className="muted small">5 de 7 · WebXR · RV y RA</span>
          <h1>Santuario en realidad virtual</h1>
          <p className="muted">Siete lugares tranquilos en 3D para hacer la respiración guiada: bosque, playa, noche, fogata, montaña, espacio y jardín zen. Ahora estás en: {S.label.toLowerCase()}. {S.desc} La esfera crece al inhalar y se encoge al exhalar.</p>
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
      <Sheet open={roomOpen} onClose={() => setRoomOpen(false)} title={inRoom ? `Sala ${room.code}` : 'Sala de autoayuda'}>
        <div className="stack">
          {!inRoom ? (
            <>
              <p className="muted">Ahora estás en tu sala personal: nadie más te ve. Si quieres respirar acompañado, crea una sala y comparte el código, o únete con el código de alguien de confianza.</p>
              <button className="btn btn-primary" disabled={room.status === 'connecting'} onClick={() => createRoom().catch(() => {})}><Users size={18} /> {room.status === 'connecting' ? 'Conectando…' : 'Crear sala'}</button>
              <div className="field">
                <label className="label" htmlFor="room-code">Unirme con código</label>
                <div className="row" style={{ gap: 8 }}>
                  <input id="room-code" className="input tnum" value={joinCode} maxLength={6} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC234" autoCapitalize="characters" spellCheck={false} style={{ letterSpacing: '0.15em' }} />
                  <button className="btn" disabled={room.status === 'connecting' || joinCode.length !== 6} onClick={() => joinRoom(joinCode)}>Unirme</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="card" style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 750, letterSpacing: '0.18em' }}><span className="tnum">{room.code}</span></div>
              <div className="row-wrap">
                <button className="btn" onClick={shareCode}><Share2 size={18} /> Compartir código</button>
                <button className="btn" onClick={() => navigator.clipboard?.writeText(room.code).then(() => toast('Código copiado'))}><Copy size={18} /> Copiar</button>
              </div>
              <div className="stack-sm">
                <span className="label">En la sala ({Object.keys(room.members).length + 1} de 6)</span>
                <div className="row-wrap">
                  <span className="tag" style={{ borderColor: room.me?.color, color: 'var(--ink)' }}><span className="dot" style={{ color: room.me?.color }} /> {room.me?.name} (tú{room.status === 'host' ? ', anfitrión' : ''})</span>
                  {Object.values(room.members).map((m) => <span key={m.id} className="tag" style={{ color: 'var(--ink)' }}><span className="dot" style={{ color: m.color }} /> {m.name}</span>)}
                </div>
              </div>
              <div className="stack-sm">
                <span className="label">Enviar un gesto</span>
                <div className="row-wrap">{Object.entries(REACTIONS).map(([k, l]) => <button key={k} className="btn btn-sm btn-tint" onClick={() => sendReaction(k)}>{l}</button>)}</div>
              </div>
              <button className="btn btn-primary" onClick={() => { startBreath(); setRoomOpen(false) }}><Play size={18} /> Respirar juntos</button>
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => leaveRoom()}><LogOut size={18} /> Salir de la sala</button>
            </>
          )}
          {room.error && <div className="notice warn" role="alert">{room.error}</div>}
          <p className="muted small">Cada persona aparece como un avatar cuya cabeza sigue el movimiento de su teléfono o visor. No hay chat abierto: solo gestos predefinidos, para que sea un espacio seguro. La conexión es directa entre dispositivos (WebRTC); algunas redes móviles o de colegio pueden bloquearla.</p>
        </div>
      </Sheet>
    </div>
  )
}
