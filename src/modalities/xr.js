// Componentes A-Frame propios de Escucha: agua con shader, terreno con relieve, fuego con partículas,
// iluminación por entorno (reflejos), giroscopio suavizado y avatares de la sala.
import { TEXTURES } from './textures'
import { terrainHeight, terrainNoise } from './terrainMath'

export function registerXR() {
  const A = window.AFRAME
  if (!A || A.components['water-surface']) return
  const THREE = A.THREE

  // ---------- Iluminación realista: mapa de entorno + tone mapping ----------
  A.registerComponent('env-light', {
    schema: { top: { type: 'color', default: '#7FC4EC' }, horizon: { type: 'color', default: '#E4F3FA' }, ground: { type: 'color', default: '#4F6B45' }, exposure: { default: 1.15 } },
    init() {
      const r = this.el.renderer
      if (r) {
        r.toneMapping = THREE.ACESFilmicToneMapping
        r.toneMappingExposure = this.data.exposure
      }
      this.pmrem = r ? new THREE.PMREMGenerator(r) : null
    },
    update() {
      if (!this.pmrem) return
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 128
      const g = c.getContext('2d')
      const grad = g.createLinearGradient(0, 0, 0, 128)
      grad.addColorStop(0, this.data.top)
      grad.addColorStop(0.48, this.data.horizon)
      grad.addColorStop(0.52, this.data.ground)
      grad.addColorStop(1, this.data.ground)
      g.fillStyle = grad
      g.fillRect(0, 0, 256, 128)
      // un "sol" difuso para que el agua y la piedra tengan brillo
      const sun = g.createRadialGradient(170, 34, 0, 170, 34, 30)
      sun.addColorStop(0, 'rgba(255,255,240,0.95)')
      sun.addColorStop(1, 'rgba(255,255,240,0)')
      g.fillStyle = sun
      g.fillRect(0, 0, 256, 128)
      const tex = new THREE.CanvasTexture(c)
      tex.mapping = THREE.EquirectangularReflectionMapping
      tex.colorSpace = THREE.SRGBColorSpace
      const env = this.pmrem.fromEquirectangular(tex).texture
      this.el.object3D.environment = env
      tex.dispose()
    },
    remove() {
      this.el.object3D.environment = null
      this.pmrem?.dispose()
    }
  })

  // ---------- Agua: olas animadas, fresnel, reflejo del cielo, brillo del sol y espuma ----------
  const WATER_VS = `
    uniform float uTime; uniform float uAmp; uniform vec2 uFlow;
    varying vec3 vWorld; varying vec3 vNormal; varying float vH;
    float wave(vec2 p, vec2 d, float f, float s){ return sin(dot(p, d) * f + uTime * s); }
    void main(){
      vec3 p = position;
      vec2 q = p.xz + uFlow * uTime;
      float h = wave(q, vec2(1.0,0.3), 1.3, 1.6) * 0.5 + wave(q, vec2(-0.4,1.0), 2.1, 2.1) * 0.3
              + wave(q, vec2(0.7,-0.7), 3.7, 2.9) * 0.15 + wave(q, vec2(-0.9,-0.2), 6.3, 3.7) * 0.07;
      p.y += h * uAmp;
      float e = 0.05;
      vec2 qx = q + vec2(e,0.0); vec2 qz = q + vec2(0.0,e);
      float hx = wave(qx, vec2(1.0,0.3), 1.3, 1.6) * 0.5 + wave(qx, vec2(-0.4,1.0), 2.1, 2.1) * 0.3 + wave(qx, vec2(0.7,-0.7), 3.7, 2.9) * 0.15 + wave(qx, vec2(-0.9,-0.2), 6.3, 3.7) * 0.07;
      float hz = wave(qz, vec2(1.0,0.3), 1.3, 1.6) * 0.5 + wave(qz, vec2(-0.4,1.0), 2.1, 2.1) * 0.3 + wave(qz, vec2(0.7,-0.7), 3.7, 2.9) * 0.15 + wave(qz, vec2(-0.9,-0.2), 6.3, 3.7) * 0.07;
      vec3 n = normalize(vec3(-(hx - h) * uAmp / e, 1.0, -(hz - h) * uAmp / e));
      vNormal = normalize(mat3(modelMatrix) * n);
      vec4 w = modelMatrix * vec4(p, 1.0);
      vWorld = w.xyz; vH = h;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`
  const WATER_FS = `
    uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon;
    uniform vec3 uSun; uniform float uOpacity; uniform vec2 uFlow; uniform float uFoam;
    varying vec3 vWorld; varying vec3 vNormal; varying float vH;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
    void main(){
      // ondas finas que "fluyen": dos capas de ruido desplazándose en direcciones distintas
      vec2 uv = vWorld.xz * 2.2;
      vec2 f1 = uv + uFlow * uTime * 1.6 + vec2(uTime * 0.25, uTime * 0.13);
      vec2 f2 = uv * 1.7 - uFlow * uTime * 1.1 + vec2(-uTime * 0.19, uTime * 0.22);
      float e = 0.08;
      float n1 = noise(f1) + noise(f2) * 0.6;
      float nx = noise(f1 + vec2(e,0.0)) + noise(f2 + vec2(e,0.0)) * 0.6;
      float nz = noise(f1 + vec2(0.0,e)) + noise(f2 + vec2(0.0,e)) * 0.6;
      vec3 N = normalize(vNormal + vec3(-(nx - n1) * 1.6, 0.0, -(nz - n1) * 1.6));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      vec3 R = reflect(-V, N);
      vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 2.5 + 0.25, 0.0, 1.0));
      vec3 body = mix(uDeep, uShallow, clamp(0.45 + vH * 0.35 + n1 * 0.12, 0.0, 1.0));
      vec3 col = mix(body, sky, 0.08 + fres * 0.5);
      float spec = pow(max(dot(R, normalize(uSun)), 0.0), 220.0) * 3.0 + pow(max(dot(R, normalize(uSun)), 0.0), 24.0) * 0.25;
      col += vec3(1.0, 0.97, 0.9) * spec;
      float foam = smoothstep(0.55, 0.95, vH * 0.5 + n1 * 0.45) * uFoam;
      col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.6);
      gl_FragColor = vec4(col, clamp(uOpacity + fres * 0.3 + foam * 0.3, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  A.registerComponent('water-surface', {
    schema: {
      width: { default: 10 }, depth: { default: 10 }, radius: { default: 0 }, seg: { default: 96 },
      deep: { type: 'color', default: '#0B4A6E' }, shallow: { type: 'color', default: '#36B3D9' },
      skyTop: { type: 'color', default: '#5DA9E9' }, skyHorizon: { type: 'color', default: '#DCEFFA' },
      opacity: { default: 0.86 }, amp: { default: 0.06 }, speed: { default: 1 }, flow: { type: 'vec2', default: { x: 0, y: 0 } }, foam: { default: 0.4 }
    },
    init() {
      const d = this.data
      const geo = d.radius > 0 ? new THREE.CircleGeometry(d.radius, Math.max(24, d.seg)) : new THREE.PlaneGeometry(d.width, d.depth, d.seg, d.seg)
      geo.rotateX(-Math.PI / 2)
      this.mat = new THREE.ShaderMaterial({
        vertexShader: WATER_VS,
        fragmentShader: WATER_FS,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 }, uAmp: { value: d.amp }, uFlow: { value: new THREE.Vector2(d.flow.x, d.flow.y) },
          uDeep: { value: new THREE.Color(d.deep) }, uShallow: { value: new THREE.Color(d.shallow) },
          uSkyTop: { value: new THREE.Color(d.skyTop) }, uSkyHorizon: { value: new THREE.Color(d.skyHorizon) },
          uSun: { value: new THREE.Vector3(0.4, 0.6, -0.7) }, uOpacity: { value: d.opacity }, uFoam: { value: d.foam }
        }
      })
      this.el.setObject3D('mesh', new THREE.Mesh(geo, this.mat))
    },
    update(old) {
      if (!this.mat || !old || !Object.keys(old).length) return
      const u = this.mat.uniforms
      u.uDeep.value.set(this.data.deep)
      u.uShallow.value.set(this.data.shallow)
      u.uSkyTop.value.set(this.data.skyTop)
      u.uSkyHorizon.value.set(this.data.skyHorizon)
    },
    tick(t) {
      if (this.mat) this.mat.uniforms.uTime.value = (t / 1000) * this.data.speed
    },
    remove() {
      this.el.removeObject3D('mesh')
      this.mat?.dispose()
    }
  })

  // ---------- Terreno con relieve: colinas alrededor, zona plana donde está el usuario ----------
  const texCache = {}
  const loadTex = (key, kind) => {
    if (texCache[key + kind]) return texCache[key + kind]
    const t = new THREE.TextureLoader().load(kind === 'n' ? TEXTURES[key]().normal : TEXTURES[key]().map)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (kind !== 'n') t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return (texCache[key + kind] = t)
  }
  A.registerComponent('terrain', {
    schema: {
      size: { default: 140 }, seg: { default: 160 }, height: { default: 6 }, flat: { default: 9 }, scale: { default: 0.035 },
      low: { type: 'color', default: '#4E8A3A' }, mid: { type: 'color', default: '#7A9A4A' }, high: { type: 'color', default: '#8E8A80' }, peak: { type: 'color', default: '#F1F4F7' },
      snow: { default: 999 }, tex: { default: 'grass' }, repeat: { default: 48 }, world: { default: '' }
    },
    update() {
      const d = this.data
      const geo = new THREE.PlaneGeometry(d.size, d.size, d.seg, d.seg)
      geo.rotateX(-Math.PI / 2)
      const pos = geo.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const cLow = new THREE.Color(d.low), cMid = new THREE.Color(d.mid), cHigh = new THREE.Color(d.high), cPeak = new THREE.Color(d.peak)
      const tmp = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i)
        const n = terrainNoise(x, z, d)
        const h = terrainHeight(x, z, d)
        pos.setY(i, h)
        const t = h / Math.max(1, d.height * 1.6)
        tmp.copy(cLow).lerp(cMid, THREE.MathUtils.clamp(n * 1.3 - 0.2, 0, 1))
        if (t > 0.45) tmp.lerp(cHigh, THREE.MathUtils.clamp((t - 0.45) * 3, 0, 1))
        if (h > d.snow) tmp.lerp(cPeak, THREE.MathUtils.clamp((h - d.snow) * 0.6, 0, 1))
        colors[i * 3] = tmp.r
        colors[i * 3 + 1] = tmp.g
        colors[i * 3 + 2] = tmp.b
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.computeVertexNormals()
      const map = loadTex(d.tex, 'c').clone()
      const nrm = loadTex(d.tex, 'n').clone()
      map.repeat.set(d.repeat, d.repeat)
      nrm.repeat.set(d.repeat, d.repeat)
      map.needsUpdate = nrm.needsUpdate = true
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map, normalMap: nrm, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92, metalness: 0 })
      // el mapa de color se usa como detalle: se aclara para que mande el color del terreno
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          diffuseColor.rgb *= mix(vec3(1.0), sampledDiffuseColor.rgb * 1.9, 0.75);
        #endif`)
      }
      const old = this.el.getObject3D('mesh')
      if (old) { old.geometry.dispose(); old.material.dispose() }
      this.el.setObject3D('mesh', new THREE.Mesh(geo, mat))
    },
    remove() {
      const m = this.el.getObject3D('mesh')
      if (m) { m.geometry.dispose(); m.material.dispose() }
      this.el.removeObject3D('mesh')
    }
  })

  // ---------- Fuego: llamas, chispas y humo con partículas ----------
  const spriteTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  A.registerComponent('fire', {
    schema: { scale: { default: 1 }, flames: { default: 140 }, sparks: { default: 40 }, smoke: { default: 30 }, light: { default: true } },
    init() {
      const s = this.data.scale
      const mk = (n, size, blending) => {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
        const mat = new THREE.PointsMaterial({ size: size * s, map: spriteTex, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true })
        const pts = new THREE.Points(geo, mat)
        pts.frustumCulled = false
        return { pts, n, life: new Float32Array(n).map(() => Math.random()), vel: new Float32Array(n * 3), seed: new Float32Array(n).map(() => Math.random()) }
      }
      this.flames = mk(this.data.flames, 0.28, THREE.AdditiveBlending)
      this.sparks = mk(this.data.sparks, 0.05, THREE.AdditiveBlending)
      this.smoke = mk(this.data.smoke, 0.7, THREE.NormalBlending)
      this.smoke.pts.material.opacity = 0.35
      const g = new THREE.Group()
      g.add(this.smoke.pts, this.flames.pts, this.sparks.pts)
      if (this.data.light) {
        this.lightObj = new THREE.PointLight(0xff8a3d, 2.2, 9 * s, 1.6)
        this.lightObj.position.set(0, 0.5 * s, 0)
        g.add(this.lightObj)
      }
      this.el.setObject3D('fire', g)
    },
    tick(t, dt) {
      if (!dt) return
      const s = this.data.scale
      const k = Math.min(dt, 50) / 1000
      const step = (sys, upd) => {
        const p = sys.pts.geometry.attributes.position.array
        const c = sys.pts.geometry.attributes.color.array
        for (let i = 0; i < sys.n; i++) upd(i, p, c)
        sys.pts.geometry.attributes.position.needsUpdate = true
        sys.pts.geometry.attributes.color.needsUpdate = true
      }
      const flame = this.flames
      step(flame, (i, p, c) => {
        flame.life[i] += k * (1.1 + flame.seed[i] * 0.8)
        if (flame.life[i] >= 1) {
          flame.life[i] = 0
          const a = Math.random() * Math.PI * 2
          const r = Math.random() * 0.22 * s
          p[i * 3] = Math.cos(a) * r
          p[i * 3 + 1] = 0.05 * s
          p[i * 3 + 2] = Math.sin(a) * r
        }
        const L = flame.life[i]
        p[i * 3] *= 0.985
        p[i * 3 + 2] *= 0.985
        p[i * 3] += Math.sin(t * 0.004 + i) * 0.0015 * s
        p[i * 3 + 1] += k * (0.7 + flame.seed[i] * 0.6) * s
        // amarillo → naranja → rojo → se apaga
        const fade = 1 - L
        c[i * 3] = 1 * fade + 0.05
        c[i * 3 + 1] = Math.max(0, 0.85 - L * 1.1) * fade
        c[i * 3 + 2] = Math.max(0, 0.35 - L * 1.4) * fade
      })
      const sp = this.sparks
      step(sp, (i, p, c) => {
        sp.life[i] += k * (0.5 + sp.seed[i] * 0.5)
        if (sp.life[i] >= 1) {
          sp.life[i] = 0
          p[i * 3] = (Math.random() - 0.5) * 0.2 * s
          p[i * 3 + 1] = 0.25 * s
          p[i * 3 + 2] = (Math.random() - 0.5) * 0.2 * s
          sp.vel[i * 3] = (Math.random() - 0.5) * 0.5
          sp.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5
        }
        p[i * 3] += sp.vel[i * 3] * k * s
        p[i * 3 + 1] += k * (1.4 + sp.seed[i]) * s
        p[i * 3 + 2] += sp.vel[i * 3 + 2] * k * s
        const f = sp.life[i] < 0.85 ? 1 : (1 - sp.life[i]) / 0.15
        c[i * 3] = f
        c[i * 3 + 1] = 0.7 * f
        c[i * 3 + 2] = 0.3 * f
      })
      const sm = this.smoke
      step(sm, (i, p, c) => {
        sm.life[i] += k * (0.18 + sm.seed[i] * 0.1)
        if (sm.life[i] >= 1) {
          sm.life[i] = 0
          p[i * 3] = (Math.random() - 0.5) * 0.2 * s
          p[i * 3 + 1] = 0.6 * s
          p[i * 3 + 2] = (Math.random() - 0.5) * 0.2 * s
        }
        p[i * 3] += Math.sin(t * 0.001 + i) * 0.002 * s
        p[i * 3 + 1] += k * 0.5 * s
        const g = 0.35 * (1 - sm.life[i])
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = g
      })
      if (this.lightObj) this.lightObj.intensity = 1.8 + Math.sin(t * 0.021) * 0.25 + Math.sin(t * 0.057) * 0.2 + Math.random() * 0.25
    },
    remove() {
      this.el.removeObject3D('fire')
    }
  })

  // ---------- Giroscopio suavizado (evita que la vista vibre en el móvil) ----------
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

  // ---------- Cabeza de avatar: sigue la orientación del dispositivo remoto con suavizado ----------
  A.registerComponent('avatar-head', {
    schema: { yaw: { default: 0 } },
    init() {
      this.target = new THREE.Quaternion()
      this.seat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.data.yaw)
    },
    setPose(q) {
      if (!q) return
      this.target.set(q[0], q[1], q[2], q[3]).premultiply(this.seat)
    },
    tick() {
      this.el.object3D.quaternion.slerp(this.target, 0.2)
    }
  })
}
