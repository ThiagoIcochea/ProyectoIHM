import { useEffect, useRef, useState } from 'react'
import { Trees, Waves, Moon, Mountain, Orbit, Flower2, Play, Square, Camera, Glasses, Volume2, VolumeX, Smartphone, Hand, LocateFixed } from 'lucide-react'
import { WORLDS, buildWorld, skyTexture, breathParticles, groundMaterial, arSanctuary } from './vrWorlds'
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

// Giroscopio suavizado: filtra el temblor de los sensores del móvil (zona muerta + interpolación esférica).
// Reemplaza el "magic window" de A-Frame, que aplica la lectura cruda y hace vibrar la vista.
function registerComponents() {
  const A = window.AFRAME
  if (!A || A.components['gyro-smooth']) return
  const THREE = A.THREE
  A.registerComponent('gyro-smooth', {
    schema: { enabled: { default: true }, factor: { default: 0.1 }, deadzone: { default: 0.35 } },
    init() {
      this.target = new THREE.Quaternion()
      this.euler = new THREE.Euler()
      this.zee = new THREE.Vector3(0, 0, 1)
      this.qScreen = new THREE.Quaternion()
      this.qWorld = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
      this.avg = null
      this.alpha0 = null
      this.onOri = (e) => {
        if (e.alpha == null) return
        const cur = { a: e.alpha, b: e.beta, g: e.gamma }
        if (this.alpha0 == null) this.alpha0 = cur.a
        // Media móvil exponencial sobre los ángulos crudos (manejando el salto 359° → 0°)
        if (!this.avg) this.avg = { ...cur }
        else {
          const k = 0.25
          let da = cur.a - this.avg.a
          if (da > 180) da -= 360
          if (da < -180) da += 360
          this.avg.a = (this.avg.a + da * k + 360) % 360
          this.avg.b += (cur.b - this.avg.b) * k
          this.avg.g += (cur.g - this.avg.g) * k
        }
      }
      this.onRecenter = () => { if (this.avg) this.alpha0 = this.avg.a }
      window.addEventListener('deviceorientation', this.onOri)
      this.el.sceneEl.addEventListener('recenter', this.onRecenter)
    },
    remove() {
      window.removeEventListener('deviceorientation', this.onOri)
      this.el.sceneEl.removeEventListener('recenter', this.onRecenter)
    },
    tick() {
      const sc = this.el.sceneEl
      if (!this.data.enabled || !this.avg || sc.is('vr-mode') || sc.is('ar-mode')) return
      const d = THREE.MathUtils.DEG2RAD
      const orient = (screen.orientation?.angle ?? window.orientation ?? 0) * d
      this.euler.set(this.avg.b * d, (this.avg.a - this.alpha0) * d, -this.avg.g * d, 'YXZ')
      this.target.setFromEuler(this.euler).multiply(this.qWorld).multiply(this.qScreen.setFromAxisAngle(this.zee, -orient))
      const q = this.el.object3D.quaternion
      const ang = q.angleTo(this.target)
      if (ang < this.data.deadzone * d) return
      q.slerp(this.target, Math.min(1, this.data.factor + ang * 0.3))
    }
  })
}

const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window
const needsIOSPermission = typeof window !== 'undefined' && typeof window.DeviceOrientationEvent?.requestPermission === 'function'

function cameraHTML(motion) {
  return `<a-entity id="cam" camera look-controls="pointerLockEnabled: false; magicWindowTrackingEnabled: false; enabled: ${!motion}" wasd-controls="acceleration: 18" gyro-smooth="enabled: ${motion}" position="0 1.6 0"></a-entity>`
}

// Escena de RA sobre la cámara (funciona también en iPhone): fondo transparente y objetos con texturas reales
function arCameraHTML(motion) {
  return `
  <a-scene embedded vr-mode-ui="enabled: false" xr-mode-ui="enabled: false" renderer="alpha: true; antialias: true; colorManagement: true; physicallyCorrectLights: false"
    background="transparent: true" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false" cursor="rayOrigin: mouse">
    ${assetsHTML()}
    <a-entity light="type: hemisphere; color: #FFFFFF; groundColor: #8A7A66; intensity: 0.9"></a-entity>
    <a-entity light="type: directional; intensity: 0.9; color: #FFF3E0" position="1.5 3 2"></a-entity>
    ${arSanctuary('cam-sanctuary', 'position="0 0.9 -1.7" rotation="10 0 0"')}
    <a-text id="ar-phase" value="Mira la esfera y respira" align="center" color="#FFFFFF" width="2.4" position="0 1.78 -1.8"></a-text>
    <a-text id="ar-count" value="" align="center" color="#FFFFFF" width="4" position="0 1.56 -1.8"></a-text>
    ${cameraHTML(motion)}
  </a-scene>`
}

const ICONS = { bosque: Trees, playa: Waves, noche: Moon, montana: Mountain, espacio: Orbit, jardin: Flower2 }
const SCENES = Object.fromEntries(Object.entries(WORLDS).map(([k, w]) => [k, { ...w, icon: ICONS[k] }]))

function button3d(id, label, x, y = 0.95, color = '#0966BF', w = 0.9) {
  return `<a-entity id="${id}" class="clickable" position="${x} ${y} -2.4" geometry="primitive: plane; width: ${w}; height: 0.3" material="color: ${color}; shader: flat; opacity: 0.95" animation__h1="property: scale; to: 1.08 1.08 1; startEvents: mouseenter; dur: 150" animation__h2="property: scale; to: 1 1 1; startEvents: mouseleave; dur: 150"><a-text value="${label}" align="center" color="#FFFFFF" width="2.6" position="0 0 0.01"></a-text></a-entity>`
}

function sceneHTML(kind, motion) {
  const s = SCENES[kind]
  const keys = Object.keys(SCENES)
  const worldButtons = keys.map((k, i) => button3d(`b-${k}`, SCENES[k].label, ((i % 3) - 1) * 1.0, i < 3 ? 0.5 : 0.16, '#24435C', 0.92)).join('')
  return `
  <a-scene embedded xr-mode-ui="enabled: true; XRMode: xr" renderer="antialias: true; colorManagement: true"
    webxr="optionalFeatures: local-floor, bounded-floor, hand-tracking, hit-test, light-estimation" ar-hit-test="target: #ar-sanctuary; type: footprint" ${s.fog ? `fog="type: linear; color: ${s.fog}; near: 14; far: 80"` : ''}
    cursor="rayOrigin: mouse" raycaster="objects: .clickable" loading-screen="enabled: false" device-orientation-permission-ui="enabled: false">
    ${assetsHTML()}
    <a-sky id="sky" src="${skyTexture(s.sky)}" hide-on-enter-ar></a-sky>
    <a-entity id="amb" light="type: ambient; intensity: ${s.ambient}"></a-entity>
    <a-entity id="sun" light="type: directional; intensity: ${s.sun}; color: ${s.sunColor}" position="3 8 4"></a-entity>
    <a-circle id="ground" rotation="-90 0 0" radius="60" segments="64" material="${groundMaterial(s)}" visible="${!!s.ground}" hide-on-enter-ar></a-circle>
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

  useEffect(() => {
    host.current?.querySelectorAll('#count, #ar-count').forEach((el) => el.setAttribute('value', b.phase ? String(b.left) : ''))
  }, [b.left, b.phase])

  // Montar la escena
  useEffect(() => {
    let alive = true
    loadAFrame()
      .then(() => {
        if (!alive || !host.current) return
        registerComponents()
        host.current.innerHTML = mode === 'vr' ? sceneHTML(kindRef.current, motionRef.current) : arCameraHTML(motionRef.current)
        const root = host.current
        const sc = root.querySelector('a-scene')
        // En RA con WebXR se muestra el mini santuario texturizado; toca una superficie para colocarlo
        sc?.addEventListener('enter-vr', () => { if (sc.is('ar-mode')) root.querySelector('#ar-sanctuary')?.setAttribute('visible', true) })
        sc?.addEventListener('exit-vr', () => root.querySelector('#ar-sanctuary')?.setAttribute('visible', false))
        const on = (id, fn) => root.querySelector(id)?.addEventListener('click', fn)
        on('#b-start', () => (bRef.current.started ? bRef.current.stop() : bRef.current.start()))
        Object.keys(SCENES).forEach((k) => on(`#b-${k}`, () => setKind(k)))
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
    if (!ready || !root || mode !== 'vr') return
    const sc = SCENES[kind]
    root.querySelector('#sky')?.setAttribute('src', skyTexture(sc.sky))
    const g = root.querySelector('#ground')
    if (g) { g.setAttribute('visible', !!sc.ground); g.setAttribute('material', groundMaterial(sc)) }
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
      { re: /\b(bosque|playa|noche|montana|espacio|jardin)\b/, label: 'bosque, playa, noche, montaña, espacio o jardín', run: (m) => setKind(m[1]), say: (m) => `Vamos ${{ bosque: 'al bosque', playa: 'a la playa', noche: 'a la noche', montana: 'a la montaña', espacio: 'al espacio', jardin: 'al jardín zen' }[m[1]]}.` },
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
        {mode === 'camara' && <video ref={video} className="ar-video" autoPlay playsInline muted />}
        <div ref={host} key={mode} style={{ position: 'absolute', inset: 0 }} />
        {mode === 'camara' && camErr && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 120, zIndex: 6 }}>{camErr}</div>}
        {!ready && !err && <div className="glass" style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)' }}>Cargando el santuario 3D…</div>}
        {err && <div className="glass" style={{ position: 'absolute', left: 16, right: 16, top: 80 }}>{err}</div>}

        <div className="vr-overlay">
          <div className="glass" style={{ maxWidth: 360 }}>
            <b>Santuario de calma</b>
            <p className="muted small">{mode === 'vr' ? 'Arrastra para mirar alrededor, W A S D para moverte. Con visor, apunta y aprieta el gatillo.' : 'Un pequeño santuario con piedra, musgo, agua y una vela aparece sobre tu cámara. Funciona también en iPhone.'}{isTouch ? (motion ? ' Mueve el teléfono para mirar.' : ' Desliza con el dedo para mirar.') : ''}</p>
          </div>
          <div className="row-wrap">
            {isTouch && (
              <button className="btn btn-sm" onClick={toggleMotion} aria-pressed={motion} title="Cómo mirar alrededor">
                {motion ? <Smartphone size={16} /> : <Hand size={16} />} {motion ? 'Con el teléfono' : 'Con el dedo'}
              </button>
            )}
            {isTouch && motion && <button className="btn btn-sm" onClick={recenter} aria-label="Recentrar la vista"><LocateFixed size={16} /></button>}
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
          <p className="muted">Seis lugares tranquilos en 3D para hacer la respiración guiada: bosque, playa, noche con fogata, montaña, espacio y jardín zen. Ahora estás en: {S.label.toLowerCase()}. {S.desc} La esfera crece al inhalar y se encoge al exhalar.</p>
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
