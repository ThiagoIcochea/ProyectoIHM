import { useEffect, useRef, useState } from 'react'
import { Trees, Waves, Moon, Mountain, Orbit, Flower2, Play, Square, Camera, Glasses, Volume2, VolumeX, Smartphone, Hand, LocateFixed, Flame, Users, Copy, LogOut, Share2, Mic, MicOff, UserRound, Eye, EyeOff, Menu, Shapes } from 'lucide-react'
import { WORLDS, buildWorld, skyTexture, breathParticles, terrainAttr, envAttr, arSanctuary, arDiorama } from './vrWorlds'
import { registerXR } from './xr'
import { useRoom, createRoom, joinRoom, leaveRoom, resumeRoom, sendPose, sendReaction, sendBreath, onRemoteBreath, REACTIONS, sendAvatar, sendScene, startTalking, stopTalking, listAudioDevices, setVoiceOutput } from '../lib/rooms'
import { avatarHTML } from './avatars'
import { useStore } from '../lib/store'
import AvatarEditor from '../components/AvatarEditor'
import { askWayra } from '../lib/companion'
import { viscachaHTML } from './vrWorlds'
import { Sheet, Switch } from '../components/ui'
import { toast } from '../components/Toast'
import { assetsHTML } from './textures'
import { useBreath } from '../lib/breath'
import { useVoice, useVoiceCommands, useFreeText } from '../lib/voice'
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
function arCameraHTML(motion, kind) {
  const piece = arDiorama(kind, 'cam-sanctuary', kind === 'fogata' ? 'position="0 0.75 -1.7"' : 'position="0 0.9 -1.7" rotation="10 0 0"')
  return `
  <a-scene embedded vr-mode-ui="enabled: false" xr-mode-ui="enabled: false" renderer="alpha: true; antialias: true; colorManagement: true"
    background="transparent: true" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false" cursor="rayOrigin: mouse" raycaster="objects: .clickable"
    env-light="top: #9CC4E0; horizon: #E8E2D6; ground: #5E5244; exposure: 1.05">
    ${assetsHTML()}
    <a-entity light="type: hemisphere; color: #FFFFFF; groundColor: #6E604F; intensity: 0.65"></a-entity>
    <a-entity light="type: directional; intensity: 1.25; color: #FFF1DC" position="1.5 3 2"></a-entity>
    ${piece}
    ${viscachaHTML('wayra', 'class="clickable" position="0.82 0.6 -1.5" rotation="0 153 0" scale="0.7 0.7 0.7"')}
    <a-entity id="avatars" position="0 0.85 -1.7"></a-entity>
    <a-entity id="guide">
    <a-text id="ar-phase" value="Mira la esfera y respira" align="center" color="#FFFFFF" width="2.4" position="0 1.78 -1.8"></a-text>
    <a-text id="ar-count" value="" align="center" color="#FFFFFF" width="4" position="0 1.56 -1.8"></a-text>
    </a-entity>
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
  return `
  <a-scene embedded xr-mode-ui="enabled: false" renderer="antialias: true; colorManagement: true"
    webxr="optionalFeatures: local-floor, bounded-floor, hand-tracking, hit-test, light-estimation" ar-hit-test="target: #ar-sanctuary; type: footprint" ${s.fog ? `fog="type: linear; color: ${s.fog}; near: 14; far: 80"` : ''}
    cursor="rayOrigin: mouse" raycaster="objects: .clickable" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false" env-light="${envAttr(s)}">
    ${assetsHTML()}
    <a-sky id="sky" src="${skyTexture(s.sky)}" hide-on-enter-ar></a-sky>
    <a-entity id="amb" light="type: ambient; intensity: ${s.ambient}"></a-entity>
    <a-entity id="sun" light="type: directional; intensity: ${s.sun}; color: ${s.sunColor}" position="3 8 4"></a-entity>
    <a-entity id="ground" ${s.terrain ? `terrain="${terrainAttr(s, kind)}"` : ''} visible="${!!s.terrain}" hide-on-enter-ar></a-entity>
    <a-entity id="avatars"></a-entity>
    ${arSanctuary('ar-sanctuary', 'position="0 0 -1.2" visible="false"')}
    <a-entity id="props">${buildWorld(kind)}</a-entity>
    <a-cylinder radius="0.9" height="0.06" position="0 0.03 0" material="color: #FFFFFF; opacity: 0.25; transparent: true" hide-on-enter-ar></a-cylinder>
    <a-entity id="guide">
    <a-sphere id="orb" position="0 1.6 -3.2" radius="0.45" scale="0.7 0.7 0.7" material="color: #7CC0F8; emissive: #2F86D6; emissiveIntensity: 0.7; opacity: 0.92; transparent: true"></a-sphere>
    <a-entity light="type: point; color: #7CC0F8; intensity: 0.6; distance: 6" position="0 1.6 -3"></a-entity>
    <a-ring position="0 1.6 -3.25" radius-inner="0.78" radius-outer="0.8" material="color: #FFFFFF; shader: flat; opacity: 0.6; transparent: true"></a-ring>
    ${breathParticles()}
    <a-text id="phase" value="Mira la esfera y respira" align="center" color="${s.text}" width="5" position="0 2.65 -3.2"></a-text>
    <a-text id="desc" value="${s.label}: ${s.desc}" align="center" color="${s.text}" width="3.2" position="0 2.32 -3.2"></a-text>
    <a-text id="count" value="" align="center" color="#FFFFFF" width="7" position="0 1.6 -2.6"></a-text>
    </a-entity>
    ${viscachaHTML('wayra', 'class="clickable" position="2.4 0 -2.2" rotation="0 132 0"')}
    <a-entity id="ui3d">
      ${button3d('b-start', 'Respirar', -0.58, 0.55, '#0966BF', 1.0)}
      ${button3d('b-next', 'Otro lugar', 0.58, 0.55, '#24435C', 1.0)}
    </a-entity>
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
  const [kind, setKind] = useState(() => {
    try { const k = sessionStorage.getItem('escucha.mundo'); return k && WORLDS[k] ? k : 'bosque' } catch { return 'bosque' }
  })
  useEffect(() => { try { sessionStorage.setItem('escucha.mundo', kind) } catch { /* nada */ } }, [kind])
  const [mode, setMode] = useState('vr') // vr | camara
  const [roomOpen, setRoomOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hudVisible, setHudVisible] = useState(true)
  const [guideVisible, setGuideVisible] = useState(true)
  const [xrSupport, setXrSupport] = useState({ vr: false, ar: false })
  useEffect(() => {
    navigator.xr?.isSessionSupported?.('immersive-vr').then((vr) => setXrSupport((x) => ({ ...x, vr }))).catch(() => {})
    navigator.xr?.isSessionSupported?.('immersive-ar').then((ar) => setXrSupport((x) => ({ ...x, ar }))).catch(() => {})
  }, [])
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
  const chooseKindRef = useRef(null)
  const talkRef = useRef(null)

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
        host.current.innerHTML = mode === 'vr' ? sceneHTML(kindRef.current, motionRef.current) : arCameraHTML(motionRef.current, kindRef.current)
        const root = host.current
        const sc = root.querySelector('a-scene')
        // En RA con WebXR se muestra el mini santuario texturizado; toca una superficie para colocarlo
        sc?.addEventListener('enter-vr', () => { if (sc.is('ar-mode')) root.querySelector('#ar-sanctuary')?.setAttribute('visible', true) })
        sc?.addEventListener('exit-vr', () => root.querySelector('#ar-sanctuary')?.setAttribute('visible', false))
        const on = (id, fn) => root.querySelector(id)?.addEventListener('click', fn)
        on('#b-start', () => (bRef.current.started ? stopRef.current() : startRef.current()))
        on('#b-next', () => {
          const keys = Object.keys(SCENES)
          chooseKindRef.current(keys[(keys.indexOf(kindRef.current) + 1) % keys.length])
        })
        root.querySelector('#wayra')?.addEventListener('click', () => talkRef.current())
        setReady(true)
      })
      .catch(() => setErr('No se pudo cargar el motor 3D.'))
    return () => {
      alive = false
      setReady(false)
      if (host.current) host.current.innerHTML = ''
    }
  }, [mode])

  // En RA con cámara, el diorama cambia con el mundo elegido (también cuando lo cambia el anfitrión)
  useEffect(() => {
    const root = host.current
    if (!ready || !root || mode !== 'camara') return
    const old = root.querySelector('#cam-sanctuary')
    if (!old || old.dataset.kind === kind) return
    const html = arDiorama(kind, 'cam-sanctuary', kind === 'fogata' ? 'position="0 0.75 -1.7"' : 'position="0 0.9 -1.7" rotation="10 0 0"')
    old.insertAdjacentHTML('afterend', html)
    old.remove()
    root.querySelector('#cam-sanctuary').dataset.kind = kind
  }, [kind, ready, mode])

  // Cambiar de escena sin recrear el mundo (no te saca del visor)
  useEffect(() => {
    const root = host.current
    if (!ready || !root || mode !== 'vr') return
    const sc = SCENES[kind]
    root.querySelector('#sky')?.setAttribute('src', skyTexture(sc.sky))
    const g = root.querySelector('#ground')
    if (g) {
      g.setAttribute('visible', !!sc.terrain)
      if (sc.terrain) g.setAttribute('terrain', { size: 140, seg: 160, height: 6, flat: 9, scale: 0.035, low: '#4E8A3A', mid: '#7A9A4A', high: '#8E8A80', peak: '#F1F4F7', snow: 999, tex: 'grass', repeat: 48, ...sc.terrain, world: kind }, true)
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

  // Si recargaste la página estando en una sala, vuelves a ella
  useEffect(() => { resumeRoom() }, [])

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
    const R = vrMode ? 2.1 : 0.8
    const SCALE = vrMode ? 1 : 0.24
    const SEATS = [-55, 55, -105, 105, 180]
    list.forEach((m, i) => {
      let el = box.querySelector(`.avatar[data-id="${m.id}"]`)
      const sig = JSON.stringify([m.avatar, m.name])
      if (el && el.dataset.sig !== sig) { el.remove(); el = null }
      const a = (SEATS[i % SEATS.length] * Math.PI) / 180
      const x = Math.sin(a) * R
      const z = -Math.cos(a) * R
      if (!el) {
        el = document.createElement('a-entity')
        el.className = 'avatar'
        el.dataset.id = m.id
        el.dataset.sig = sig
        el.setAttribute('position', `${x.toFixed(2)} 0 ${z.toFixed(2)}`)
        el.setAttribute('rotation', `0 ${((Math.atan2(x, z) * 180) / Math.PI).toFixed(1)} 0`)
        el.setAttribute('scale', `${SCALE} ${SCALE} ${SCALE}`)
        el.innerHTML = avatarHTML(m.avatar, m.name)
        box.appendChild(el)
      }
      const head = el.querySelector('.head')
      if (m.q && head?.components?.['avatar-head']) head.components['avatar-head'].setPose(m.q)
      el.querySelector('.bubble')?.setAttribute('value', m.react && Date.now() - (m.reactAt || 0) < 4500 ? REACTIONS[m.react] : '')
      el.querySelector('.talk')?.setAttribute('visible', !!m.talking)
      el.querySelector('.face')?.components?.['avatar-face']?.setTalking(!!m.talking)
      if (m.breath) el.setAttribute('animation', `property: scale; from: ${SCALE} ${SCALE} ${SCALE}; to: ${SCALE * 1.04} ${SCALE * 1.03} ${SCALE * 1.04}; dir: alternate; loop: true; dur: 4000; easing: easeInOutSine`)
      else el.removeAttribute('animation')
    })
  }, [room.members, ready, mode])

  // El anfitrión elige el escenario para todos; los invitados lo siguen
  const isMember = room.status === 'member'
  const chooseKind = (k) => {
    if (isMember) return toast('En esta sala, el anfitrión elige el escenario.')
    setKind(k)
  }
  useEffect(() => {
    if (room.status === 'host') sendScene(kind, kind)
  }, [room.status, kind, Object.keys(room.members).length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (room.status !== 'member' || !room.scene) return
    if (room.scene.kind && SCENES[room.scene.kind]) setKind(room.scene.kind)
    toast(`El anfitrión cambió a ${SCENES[room.scene.kind]?.label || 'otro lugar'}`)
  }, [room.scene, room.status])

  // Mi personaje: se envía a la sala cuando cambia
  const myAvatar = useStore((st) => st.avatar)
  useEffect(() => { if (inRoom) sendAvatar(myAvatar || {}) }, [myAvatar, inRoom])

  // ---------- Voz en la sala ----------
  const [audioDevs, setAudioDevs] = useState({ inputs: [], outputs: [] })
  const [micId, setMicId] = useState('')
  const loadDevices = () => listAudioDevices().then(setAudioDevs).catch(() => {})
  const toggleTalk = () => (room.talking ? stopTalking() : startTalking(micId))

  // ---------- Wayra, la viscacha (solo en la sala personal) ----------
  const [wayraLine, setWayraLine] = useState('')
  const wayraBusy = useRef(false)
  useEffect(() => {
    const root = host.current
    if (!ready || !root) return
    root.querySelector('#wayra')?.setAttribute('visible', !inRoom)
    if (!inRoom) root.querySelector('.wayra-bubble')?.setAttribute('value', 'Háblame cuando quieras')
  }, [ready, inRoom, mode])
  const wayraSay = (text) => {
    setWayraLine(text)
    const root = host.current
    root?.querySelector('.wayra-bubble')?.setAttribute('value', text.length > 120 ? `${text.slice(0, 117)}…` : text)
    const head = root?.querySelector('.wayra-head')
    const mouth = root?.querySelector('.wayra-mouth')
    v.speak(text, {
      force: true,
      profile: 'viscacha',
      onStart: () => {
        head?.setAttribute('animation__talk', 'property: rotation; from: -4 -8 0; to: 6 8 0; dir: alternate; loop: true; dur: 420; easing: easeInOutSine')
        mouth?.setAttribute('animation', 'property: scale; from: 1 1 1; to: 1.4 2.4 1; dir: alternate; loop: true; dur: 170')
      },
      onEnd: () => {
        head?.removeAttribute('animation__talk')
        mouth?.setAttribute('animation', 'property: scale; to: 1 1 1; dur: 120')
        setTimeout(() => setWayraLine(''), 6000)
      }
    })
  }
  const talkToWayra = async (text) => {
    if (wayraBusy.current || !text) return
    wayraBusy.current = true
    host.current?.querySelector('.wayra-bubble')?.setAttribute('value', '…')
    const reply = await askWayra(text)
    wayraBusy.current = false
    wayraSay(reply)
  }
  // En la sala personal, todo lo que digas por el micrófono (que no sea una orden) va a Wayra
  useFreeText('wayra', !inRoom ? (t) => talkToWayra(t) : undefined, [inRoom])
  // Tocar a Wayra abre el micrófono
  const listenForWayra = () => {
    if (inRoom) return
    host.current?.querySelector('.wayra-bubble')?.setAttribute('value', 'Te escucho…')
    v.startListening()
  }

  const startBreath = () => {
    b.start()
    if (inRoom) sendBreath('start')
  }
  const stopBreath = () => {
    b.stop()
    if (inRoom) sendBreath('stop')
  }
  startRef.current = startBreath
  chooseKindRef.current = chooseKind
  talkRef.current = () => listenForWayra()
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
    if (audio) playAmbient(SCENES[kind].sound, 0.4)
    else stopAmbient()
  }, [audio, kind, mode])
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

  // Mostrar u ocultar la guía de respiración y los botones 3D
  useEffect(() => {
    const root = host.current
    if (!ready || !root) return
    root.querySelector('#guide')?.setAttribute('visible', guideVisible)
    root.querySelectorAll('#cam-sanctuary-orb, #ar-sanctuary-orb').forEach((o) => o.setAttribute('visible', guideVisible))
    root.querySelector('#ui3d')?.setAttribute('visible', hudVisible)
    root.querySelectorAll('#ui3d > a-entity').forEach((el) => el.classList.toggle('clickable', hudVisible))
    root.querySelectorAll('[raycaster]').forEach((r) => r.components?.raycaster?.refreshObjects?.())
  }, [guideVisible, hudVisible, ready, mode, kind])
  useEffect(() => { if (b.started) setGuideVisible(true) }, [b.started])

  const enterAR = () => host.current?.querySelector('a-scene')?.enterAR?.()
  const enterVR = () => {
    const scene = host.current?.querySelector('a-scene')
    if (!scene) return
    if (navigator.xr) scene.enterVR?.()
    else scene.requestFullscreen?.()
  }

  useVoiceCommands(
    'immersive',
    [
      { re: /\b(fogata|fuego)\b/, label: 'fogata', run: () => chooseKind('fogata'), say: 'Vamos a la fogata.' },
      { re: /\b(santuario)\b/, label: 'santuario', run: () => chooseKind('bosque') },
      { re: /\b(bosque|playa|noche|montana|espacio|jardin)\b/, label: 'bosque, playa, noche, montaña, espacio o jardín', run: (m) => { setMode('vr'); chooseKind(m[1]) }, say: (m) => `Vamos ${{ bosque: 'al bosque', playa: 'a la playa', noche: 'a la noche', montana: 'a la montaña', espacio: 'al espacio', jardin: 'al jardín zen' }[m[1]]}.` },
      { re: /\b(crea\w*|abrir|abre) (una )?sala\b/, label: 'crear sala', run: () => { setRoomOpen(true); createRoom().catch(() => {}) } },
      { re: /\b(salir de la sala|dejar la sala)\b/, label: 'salir de la sala', run: () => leaveRoom() },
      { re: /\b(te acompano|respira conmigo|gracias|estoy aqui)\b/, label: 'te acompaño', run: (m) => inRoom && sendReaction({ 'te acompano': 'acompano', 'respira conmigo': 'respira', gracias: 'gracias', 'estoy aqui': 'aqui' }[m[1]]) },

      { re: /\b(activa\w*|abre|abrir) (el )?microfono\b|\bquiero hablar\b/, label: 'activar micrófono de la sala', run: () => inRoom && !room.talking && startTalking(micId) },
      { re: /\b(silencia\w*|apaga\w*|cierra) (el )?microfono\b/, label: 'silenciar micrófono', run: () => stopTalking() },
      { re: /\b(respir\w*|empez\w*)\b/, label: 'respirar', run: () => startBreath() },
      { re: /\b(deten\w*|parar)\b/, label: 'detener', run: () => stopBreath() },
      { re: /\b(camara|realidad aumentada)\b/, label: 'realidad aumentada', run: () => setMode('camara') },
      { re: /\b(realidad virtual|volver al santuario|modo 3d)\b/, label: 'realidad virtual', run: () => setMode('vr') },
      { re: /\b(sonido|musica)\b/, label: 'sonido', run: () => setAudio((a) => !a) },
      { re: /\b(entrar|entra|visor|inmersivo)\b/, label: 'entrar al visor', run: enterVR }
    ],
    [b.started, mode, inRoom, room.status, room.talking, micId]
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

        {hudVisible ? (
          <>
            <div className="hud-top">
              <span className="glass hud-chip">{mode === 'vr' ? S.label : `${S.label} en RA`}{inRoom ? ` · Sala ${room.code} · ${Object.keys(room.members).length + 1}` : room.status === 'reconnecting' ? ' · Reconectando a la sala…' : ''}</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm hud-icon" onClick={() => setHudVisible(false)} aria-label="Ocultar interfaz" title="Ocultar interfaz"><EyeOff size={18} /></button>
                <button className="btn btn-sm hud-icon" onClick={() => setMenuOpen(true)} aria-label="Menú" title="Menú"><Menu size={18} /></button>
              </span>
            </div>
            <div className="hud-bottom">
              {b.started ? (
                <button className="btn btn-sm" onClick={stopBreath}><Square size={16} /> Detener</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={startBreath}><Play size={16} /> {inRoom ? 'Respirar juntos' : 'Respirar'}</button>
              )}
              <button className="btn btn-sm" onClick={() => setMenuOpen(true)}><Shapes size={16} /> Escenario</button>
            </div>
            {!inRoom && wayraLine && <div className="glass wayra-caption" aria-live="polite"><b>Wayra:</b> {wayraLine}</div>}
          </>
        ) : (
          <button className="btn btn-sm hud-icon hud-show" onClick={() => setHudVisible(true)} aria-label="Mostrar interfaz" title="Mostrar interfaz"><Eye size={18} /></button>
        )}
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
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Santuario">
        <div className="stack">
          <div className="stack-sm">
            <span className="label">Escenario{isMember ? ' (lo elige el anfitrión)' : ''}</span>
            <div className="scene-grid">
              {Object.entries(SCENES).map(([k, sc]) => {
                const I = sc.icon
                return <button key={k} className="scene-opt" aria-pressed={kind === k} disabled={isMember} onClick={() => chooseKind(k)}><I size={20} /> {sc.label}</button>
              })}
            </div>
          </div>
          <div className="stack-sm">
            <span className="label">Modo</span>
            <div className="row-wrap">
              {mode === 'vr'
                ? <button className="btn btn-sm" onClick={() => { setMode('camara'); setMenuOpen(false) }}><Camera size={16} /> Realidad aumentada con cámara</button>
                : <button className="btn btn-sm" onClick={() => { setMode('vr'); setMenuOpen(false) }}><Glasses size={16} /> Volver a realidad virtual</button>}
              {mode === 'vr' && xrSupport.vr && <button className="btn btn-sm" onClick={() => { setMenuOpen(false); enterVR() }}><Glasses size={16} /> Entrar al visor (VR)</button>}
              {mode === 'vr' && xrSupport.ar && <button className="btn btn-sm" onClick={() => { setMenuOpen(false); enterAR() }}><Camera size={16} /> RA en tu habitación</button>}
              {mode === 'vr' && !xrSupport.vr && <button className="btn btn-sm" onClick={() => { setMenuOpen(false); enterVR() }}><Glasses size={16} /> Pantalla completa</button>}
            </div>
          </div>
          <div>
            <Switch id="guide-vis" label="Guía de respiración visible" hint="La esfera, el anillo y el texto. Se muestra sola al empezar a respirar." checked={guideVisible} onChange={setGuideVisible} />
            <Switch id="snd" label="Sonido del lugar" checked={audio} onChange={setAudio} />
            {isTouch && <Switch id="mot" label="Mirar moviendo el teléfono" hint="Si lo apagas, deslizas con el dedo" checked={motion} onChange={() => toggleMotion()} />}
          </div>
          <div className="row-wrap">
            {isTouch && motion && <button className="btn btn-sm" onClick={() => { recenter(); setMenuOpen(false) }}><LocateFixed size={16} /> Recentrar la vista</button>}
            <button className="btn btn-sm" onClick={() => { setMenuOpen(false); setRoomOpen(true) }}><Users size={16} /> {inRoom ? `Sala ${room.code}` : 'Sala compartida'}</button>
          </div>
          {!inRoom && <p className="muted small">Wayra, la viscacha, te acompaña en tu sala personal. Habla con el micrófono de siempre (o tócala) y te responderá con su voz.</p>}
        </div>
      </Sheet>
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
                <span className="label">Voz</span>
                <div className="row-wrap">
                  <button className={`btn ${room.talking ? 'btn-primary' : ''}`} onClick={toggleTalk}>{room.talking ? <Mic size={18} /> : <MicOff size={18} />} {room.talking ? 'Te escuchan · tocar para silenciar' : 'Hablar en la sala'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={loadDevices}>Elegir micrófono o auricular</button>
                </div>
                {(audioDevs.inputs.length > 0 || audioDevs.outputs.length > 0) && (
                  <div className="grid-2">
                    <select className="select" aria-label="Micrófono" value={micId} onChange={(e) => { setMicId(e.target.value); if (room.talking) { stopTalking(); startTalking(e.target.value) } }}>
                      <option value="">Micrófono predeterminado</option>
                      {audioDevs.inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Micrófono'}</option>)}
                    </select>
                    {audioDevs.outputs.length > 0 && (
                      <select className="select" aria-label="Salida de voz" defaultValue="" onChange={(e) => setVoiceOutput(e.target.value)}>
                        <option value="">Salida predeterminada</option>
                        {audioDevs.outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Salida de audio'}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <span className="muted small">Para usar un auricular o parlante Bluetooth, primero emparéjalo en los ajustes de Bluetooth de tu teléfono o computadora; luego aparecerá en esta lista.</span>
                {room.micError && <span className="small" style={{ color: 'var(--danger)' }}>{room.micError}</span>}
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
          <details className="howto card" style={{ padding: '4px 16px 12px' }}>
            <summary><UserRound size={18} /> Mi personaje</summary>
            <AvatarEditor />
          </details>
          {room.status === 'host' && <p className="muted small">Eres el anfitrión: el escenario que elijas cambia para todos.</p>}
          <p className="muted small">Cada persona aparece como un avatar cuya cabeza sigue el movimiento de su teléfono o visor. No hay chat abierto: solo gestos predefinidos, para que sea un espacio seguro. La conexión es directa entre dispositivos (WebRTC); algunas redes móviles o de colegio pueden bloquearla.</p>
        </div>
      </Sheet>
    </div>
  )
}
