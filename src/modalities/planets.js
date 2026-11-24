// Luna, planetas y cielo estrellado con texturas generadas en el navegador (sin descargar imágenes).
// Cada cuerpo celeste se ilumina con un sol propio (terminador día/noche real) y relieve horneado en la textura.

// ---------- Ruido 3D (para mapear sin costuras sobre una esfera) ----------
function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise3(x, y, z, seed) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z)
  const xf = x - xi; const yf = y - yi; const zf = z - zi
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf); const w = zf * zf * (3 - 2 * zf)
  const L = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed)
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  )
}
function fbm3(x, y, z, seed, oct = 5, f = 2, gain = 0.5) {
  let a = 1; let s = 0; let n = 0
  for (let o = 0; o < oct; o++) {
    s += noise3(x * f, y * f, z * f, seed + o * 17) * a
    n += a; a *= gain; f *= 2
  }
  return s / n
}
const clamp = (v) => Math.max(0, Math.min(1, v))
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const ramp = (stops, t) => {
  t = clamp(t)
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i]
      return mix(hex(c0), hex(c1), (t - t0) / (t1 - t0 || 1))
    }
  }
  return hex(stops[stops.length - 1][1])
}

// Recorre una textura equirectangular: cada píxel recibe su dirección 3D en la esfera
function equirect(W, H, fn) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const th = (y / H) * Math.PI
    const st = Math.sin(th); const ct = Math.cos(th)
    for (let x = 0; x < W; x++) {
      const ph = (x / W) * Math.PI * 2
      const [r, gg, b, a = 255] = fn(-Math.cos(ph) * st, ct, Math.sin(ph) * st, x, y)
      const i = (y * W + x) * 4
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = a
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

// Cráteres: lista de direcciones con radio angular; el perfil tiene fondo hundido y borde elevado
function makeCraters(n, seed, rMin, rMax) {
  const out = []
  let s = seed
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < n; i++) {
    const z = r() * 2 - 1; const a = r() * Math.PI * 2; const q = Math.sqrt(1 - z * z)
    const rad = rMin + Math.pow(r(), 3) * (rMax - rMin)
    out.push([q * Math.cos(a), z, q * Math.sin(a), rad, Math.cos(rad * 1.6)])
  }
  return out
}
function craterHeight(x, y, z, list) {
  let h = 0
  for (const [cx, cy, cz, rad, cosLim] of list) {
    const d = x * cx + y * cy + z * cz
    if (d < cosLim) continue
    const t = Math.acos(Math.min(1, d)) / rad // 0 centro, 1 borde
    if (t < 1) h += (t * t - 1) * 0.5 * rad * 6 + Math.exp(-((t - 0.95) ** 2) / 0.01) * rad * 2.2
    else h += Math.exp(-((t - 1) ** 2) / 0.04) * rad * 2.2 * (1.6 - t)
  }
  return h
}

const cache = {}
const PLANETS = {
  // Luna: mares oscuros, tierras altas claras, cráteres con borde y rayos brillantes
  moon() {
    const big = makeCraters(70, 7, 0.02, 0.2)
    const small = makeCraters(260, 19, 0.006, 0.03)
    const W = 512; const H = 256
    const hgt = new Float32Array(W * H)
    const base = equirect(W, H, (x, y, z, px, py) => {
      const maria = clamp((fbm3(x, y, z, 3, 4, 1.4) - 0.5) * 4 + 0.5)
      const h = craterHeight(x, y, z, big) + craterHeight(x, y, z, small) * 0.7 + fbm3(x, y, z, 9, 5, 6) * 0.06
      hgt[py * W + px] = h
      const tone = 0.62 + fbm3(x, y, z, 21, 5, 8) * 0.35 - maria * 0.32
      const c = ramp([[0, '#3E3F44'], [0.5, '#8E8D8A'], [1, '#E4E1DA']], tone)
      return c
    })
    // Relieve horneado: luz rasante desde la izquierda para que los cráteres se lean de lejos
    const g = base.getContext('2d')
    const img = g.getImageData(0, 0, W, H)
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x
      const dx = hgt[y * W + ((x + 1) % W)] - hgt[y * W + ((x - 1 + W) % W)]
      const dy = hgt[i + W] - hgt[i - W]
      const k = 1 + clamp(0.5 - (dx * 0.8 + dy * 0.4) * 18) - 0.5
      img.data[i * 4] *= k; img.data[i * 4 + 1] *= k; img.data[i * 4 + 2] *= k
    }
    g.putImageData(img, 0, 0)
    return base
  },
  // Gigante gaseoso con bandas turbulentas y una gran tormenta
  gas() {
    const stops = [[0, '#6E4A2E'], [0.25, '#B98B5E'], [0.45, '#E8D3B0'], [0.6, '#C99A6B'], [0.78, '#F1E4CC'], [1, '#9C6B45']]
    return equirect(512, 256, (x, y, z) => {
      const turb = fbm3(x, y, z, 5, 5, 3) - 0.5
      let lat = y + turb * 0.18
      const storm = Math.exp(-(((Math.atan2(z, x) - 0.6) * 2.2) ** 2 + ((y + 0.32) * 9) ** 2))
      lat += storm * 0.05 * Math.sin(Math.atan2(z, x) * 30)
      const band = 0.5 + 0.5 * Math.sin(lat * 22) * 0.6 + Math.sin(lat * 47) * 0.2
      const c = ramp(stops, band)
      return mix(c, hex('#C1502E'), storm * 0.8)
    })
  },
  // Planeta azul con océanos, continentes, desiertos y casquetes polares
  earth() {
    return equirect(512, 256, (x, y, z) => {
      const n = fbm3(x, y, z, 11, 6, 1.6)
      const lat = Math.abs(y)
      if (lat > 0.86 - (n - 0.5) * 0.2) return hex('#F2F6FA')
      if (n < 0.52) return ramp([[0, '#0B2A57'], [0.8, '#1D5D9B'], [1, '#3A8BC4']], n / 0.52)
      const dry = clamp((fbm3(x, y, z, 31, 4, 2) - 0.45) * 3 + (0.35 - lat) * 1.5)
      const land = mix(hex('#3D7A3A'), hex('#C9A66B'), dry)
      return mix(land, hex('#6B5B4A'), clamp((n - 0.66) * 5))
    })
  },
  // Nubes del planeta azul (blanco con transparencia)
  clouds() {
    return equirect(512, 256, (x, y, z) => {
      const n = fbm3(x * 1.3, y * 2.4, z * 1.3, 41, 5, 2)
      const a = clamp((n - 0.5) * 3.2)
      return [255, 255, 255, Math.round(a * 235)]
    })
  },
  // Planeta rojizo con regiones oscuras y algunos cráteres
  mars() {
    const cr = makeCraters(40, 33, 0.01, 0.08)
    return equirect(512, 256, (x, y, z) => {
      const n = fbm3(x, y, z, 51, 5, 2)
      const h = craterHeight(x, y, z, cr)
      if (Math.abs(y) > 0.93) return hex('#EDE6E0')
      return ramp([[0, '#5A2A1C'], [0.5, '#B5562F'], [1, '#E09A6A']], n * 1.2 - 0.1 + h * 2)
    })
  },
  // Asteroide rocoso
  rock() {
    const cr = makeCraters(30, 61, 0.05, 0.3)
    return equirect(256, 128, (x, y, z) => ramp([[0, '#3A3836'], [1, '#9A948C']], fbm3(x, y, z, 71, 5, 3) + craterHeight(x, y, z, cr) * 1.5))
  }
}
export function planetCanvas(kind) {
  if (!cache[kind]) cache[kind] = (PLANETS[kind] || PLANETS.rock)()
  return cache[kind]
}

// Anillos: textura cuadrada con círculos concéntricos (el UV de a-ring es plano)
let ringCanvas
function ringTexture() {
  if (ringCanvas) return ringCanvas
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  const img = g.createImageData(512, 512)
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const r = Math.hypot(x - 256, y - 256) / 256 // 0..1 (radio exterior = 1)
    const i = (y * 512 + x) * 4
    const t = (r - 0.55) / 0.45
    let a = t < 0 || t > 1 ? 0 : 0.35 + 0.35 * Math.sin(t * 61) * Math.sin(t * 17) + 0.3 * Math.sin(t * 7)
    if (t > 0.62 && t < 0.67) a *= 0.1 // división oscura
    const [cr, cg, cb] = ramp([[0, '#8C7458'], [0.5, '#E8D6B4'], [1, '#B79D7A']], t)
    img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = Math.round(clamp(a) * 230)
  }
  g.putImageData(img, 0, 0)
  return (ringCanvas = c)
}

// ---------- Cielo estrellado (equirectangular) ----------
const skyCache = {}
export function starSky([top, bottom], { milky = true, nebula = false, seed = 1, density = 1 } = {}) {
  const key = `${top}${bottom}${milky}${nebula}${seed}`
  if (skyCache[key]) return skyCache[key]
  const W = 2048; const H = 1024
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, top)
  grad.addColorStop(0.5, bottom)
  grad.addColorStop(1, nebula ? top : bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // Vía Láctea y nebulosas en baja resolución, luego se escalan suavemente
  if (milky || nebula) {
    const glow = equirect(512, 256, (x, y, z) => {
      // banda inclinada: distancia a un gran círculo
      const d = Math.abs(x * 0.35 + y * 0.82 + z * 0.45)
      const band = milky ? Math.exp(-(d * d) / 0.02) : 0
      const dust = fbm3(x, y, z, 91 + seed, 5, 3)
      const lanes = clamp(1 - Math.max(0, fbm3(x, y, z, 7 + seed, 4, 6) - 0.55) * 4)
      let col = [0, 0, 0]
      let a = band * (0.25 + dust * 0.6) * lanes
      col = mix([200, 210, 255], [255, 236, 210], dust)
      if (nebula) {
        const n1 = clamp((fbm3(x, y, z, 131 + seed, 5, 1.6) - 0.5) * 3)
        const n2 = clamp((fbm3(x, y, z, 151 + seed, 5, 1.6) - 0.52) * 3)
        col = mix(mix(col, [123, 92, 255], n1), [255, 111, 181], n2)
        a = Math.max(a, (n1 * 0.55 + n2 * 0.45) * (0.4 + dust * 0.6))
      }
      return [col[0], col[1], col[2], Math.round(clamp(a) * 200)]
    })
    g.imageSmoothingQuality = 'high'
    g.drawImage(glow, 0, 0, W, H)
  }
  // Estrellas: muchas pequeñas, algunas brillantes con halo y color
  let s = 9 + seed
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const N = Math.round(5200 * density)
  for (let i = 0; i < N; i++) {
    const y = Math.acos(1 - 2 * r()) / Math.PI * H // uniforme en la esfera
    if (!nebula && y > H * 0.58) continue // bajo el horizonte no se ven
    const x = r() * W
    const m = Math.pow(r(), 6)
    const tint = r()
    const col = tint > 0.9 ? '255,214,170' : tint > 0.78 ? '180,205,255' : '255,255,255'
    const rad = 0.3 + m * 1.2
    g.fillStyle = `rgba(${col},${0.35 + m * 0.65})`
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
    if (m > 0.7) {
      const h = g.createRadialGradient(x, y, 0, x, y, rad * 4)
      h.addColorStop(0, `rgba(${col},0.35)`); h.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = h
      g.beginPath(); g.arc(x, y, rad * 4, 0, Math.PI * 2); g.fill()
    }
  }
  return (skyCache[key] = c.toDataURL('image/jpeg', 0.9))
}

// Aurora: cortinas verticales de luz con bordes suaves (sin rectángulos visibles)
let auroraUrl
export function auroraTexture() {
  if (auroraUrl) return auroraUrl
  const W = 512; const H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  const img = g.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const u = x / W
    const edge = Math.sin(u * Math.PI) ** 1.5
    const rays = 0.45 + 0.55 * Math.abs(Math.sin(u * 53 + Math.sin(u * 7) * 3)) * (0.6 + 0.4 * Math.sin(u * 13))
    const base = H * (0.62 + 0.12 * Math.sin(u * 9) + 0.05 * Math.sin(u * 23))
    for (let y = 0; y < H; y++) {
      const d = (base - y) / H // 0 en la base, positivo hacia arriba
      const a = d < 0 ? Math.exp(-(d * d) / 0.0015) : Math.exp(-d * 3.2) * (1 - Math.exp(-d * 60))
      const i = (y * W + x) * 4
      const t = clamp(d * 2.4)
      img.data[i] = 60 + t * 120; img.data[i + 1] = 240 - t * 90; img.data[i + 2] = 170 + t * 70
      img.data[i + 3] = Math.round(clamp(a * edge * rays) * 255)
    }
  }
  g.putImageData(img, 0, 0)
  return (auroraUrl = c.toDataURL())
}

// ---------- Componente A-Frame ----------
export function registerPlanet(A) {
  if (A.components.planet) return
  const THREE = A.THREE
  const texCache = {}
  const tex = (kind) => {
    if (texCache[kind]) return texCache[kind]
    const t = new THREE.CanvasTexture(kind === 'ring' ? ringTexture() : planetCanvas(kind))
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return (texCache[kind] = t)
  }
  const vert = `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vUv = uv;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`
  const frag = `
    uniform sampler2D map; uniform vec3 sunDir; uniform float ambient; uniform vec3 rim; uniform float rimPow; uniform float glow; uniform float alpha;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 c = texture2D(map, vUv);
      float d = dot(normalize(vN), normalize(sunDir));
      float lit = smoothstep(-0.08, 0.35, d);
      vec3 col = c.rgb * (ambient + lit * (1.0 - ambient) * 1.15);
      float f = pow(1.0 - max(dot(normalize(vN), vV), 0.0), rimPow);
      col += rim * f * (0.25 + lit) * glow;
      gl_FragColor = vec4(col, c.a * alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  A.registerComponent('planet', {
    schema: {
      kind: { default: 'moon' },
      radius: { default: 1 },
      sun: { type: 'vec3', default: { x: -1, y: 0.4, z: 0.6 } },
      ambient: { default: 0.06 },
      rim: { type: 'color', default: '#000000' },
      rimPow: { default: 3 },
      glow: { default: 1 },
      clouds: { default: false },
      ring: { default: false },
      spin: { default: 0 } // segundos por vuelta (0 = quieto)
    },
    init() {
      const d = this.data
      const sun = new THREE.Vector3(d.sun.x, d.sun.y, d.sun.z).normalize()
      const make = (kind, a = 1) => new THREE.ShaderMaterial({
        uniforms: { map: { value: tex(kind) }, sunDir: { value: sun }, ambient: { value: d.ambient }, rim: { value: new THREE.Color(d.rim) }, rimPow: { value: d.rimPow }, glow: { value: d.glow }, alpha: { value: a } },
        vertexShader: vert, fragmentShader: frag, transparent: a < 1 || kind === 'clouds', depthWrite: kind !== 'clouds'
      })
      const g = new THREE.Group()
      this.body = new THREE.Mesh(new THREE.SphereGeometry(d.radius, 64, 40), make(d.kind))
      g.add(this.body)
      if (d.clouds) {
        this.cl = new THREE.Mesh(new THREE.SphereGeometry(d.radius * 1.015, 64, 40), make('clouds'))
        g.add(this.cl)
      }
      if (d.ring) {
        const rg = new THREE.RingGeometry(d.radius * 1.25, d.radius * 2.3, 128, 1)
        const m = new THREE.MeshBasicMaterial({ map: tex('ring'), transparent: true, side: THREE.DoubleSide, depthWrite: false })
        const ring = new THREE.Mesh(rg, m)
        ring.rotation.x = -Math.PI / 2 + 0.42
        ring.rotation.y = 0.18
        g.add(ring)
      }
      this.el.setObject3D('mesh', g)
    },
    tick(t, dt) {
      if (!this.data.spin || !this.body) return
      const k = (Math.PI * 2 * dt) / (this.data.spin * 1000)
      this.body.rotation.y += k
      if (this.cl) this.cl.rotation.y += k * 1.3
    },
    remove() { this.el.removeObject3D('mesh') }
  })
}
