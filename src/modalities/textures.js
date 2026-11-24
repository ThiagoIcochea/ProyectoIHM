// Texturas realistas generadas en el navegador (ruido fractal repetible + mapa de normales).
// No se descarga ninguna imagen: todo sale de un canvas y se guarda en memoria la primera vez.

import { auroraTexture } from './planets'

const SIZE = 384
const cache = {}

function hashRand(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

// Ruido de valor que se repite sin costuras en un periodo dado
function makeNoise(seed) {
  const r = hashRand(seed)
  const perm = new Float32Array(256 * 256)
  for (let i = 0; i < perm.length; i++) perm[i] = r()
  return (x, y, period) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const g = (a, b) => perm[(((a % period) + period) % period) + (((b % period) + period) % period) * 256]
    const a = g(xi, yi)
    const b = g(xi + 1, yi)
    const c = g(xi, yi + 1)
    const d = g(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

function fbm(noise, x, y, base, octaves, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    const p = base * freq
    sum += noise((x / SIZE) * p, (y / SIZE) * p, p) * amp
    norm += amp
    amp *= gain
    freq *= 2
  }
  return sum / norm
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const clamp = (v) => Math.max(0, Math.min(1, v))

// Construye color + mapa de normales a partir de una función de altura y una paleta
function build(id, heightFn, colorFn, strength = 2.2) {
  if (cache[id]) return cache[id]
  const h = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = heightFn(x, y)
  const col = document.createElement('canvas')
  const nor = document.createElement('canvas')
  col.width = nor.width = col.height = nor.height = SIZE
  const ci = col.getContext('2d').createImageData(SIZE, SIZE)
  const ni = nor.getContext('2d').createImageData(SIZE, SIZE)
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const [r, g, b] = colorFn(at(x, y), x, y)
      ci.data[i] = r
      ci.data[i + 1] = g
      ci.data[i + 2] = b
      ci.data[i + 3] = 255
      // Sobel → normal en espacio tangente
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      ni.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      ni.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      ni.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      ni.data[i + 3] = 255
    }
  }
  col.getContext('2d').putImageData(ci, 0, 0)
  nor.getContext('2d').putImageData(ni, 0, 0)
  return (cache[id] = { map: col.toDataURL('image/jpeg', 0.86), normal: nor.toDataURL('image/png'), colCanvas: col, norCanvas: nor })
}

const N = {
  stone: makeNoise(11),
  bark: makeNoise(23),
  grass: makeNoise(37),
  sand: makeNoise(41),
  moss: makeNoise(53),
  water: makeNoise(67),
  wax: makeNoise(79),
  skin: makeNoise(83),
  cloth: makeNoise(97),
  hair: makeNoise(101)
}
const frac = (v) => v - Math.floor(v)
const TAU = Math.PI * 2

export const TEXTURES = {
  stone: () =>
    build('stone', (x, y) => {
      const f = fbm(N.stone, x, y, 4, 6, 0.55)
      const cracks = Math.abs(fbm(N.stone, x + 91, y + 17, 3, 3) - 0.5) < 0.018 ? -0.25 : 0
      return f + cracks
    }, (v, x, y) => {
      const speck = fbm(N.stone, x * 3, y * 3, 16, 2) > 0.62 ? 0.12 : 0
      return mix(hex('#5A5F63'), hex('#C9CDD0'), clamp(v * 1.2 - 0.1 + speck))
    }, 3),
  bark: () =>
    build('bark', (x, y) => {
      const ridges = Math.sin((x / SIZE) * Math.PI * 2 * 9 + fbm(N.bark, x, y, 4, 4) * 6)
      return 0.5 + ridges * 0.35 + fbm(N.bark, x, y, 8, 3) * 0.3
    }, (v) => mix(hex('#4A3424'), hex('#A9845F'), clamp(v)), 3.4),
  grass: () =>
    build('grass', (x, y) => fbm(N.grass, x, y, 32, 4, 0.6), (v, x, y) => {
      const patch = fbm(N.grass, x + 40, y + 9, 3, 3)
      return mix(mix(hex('#3D7A2E'), hex('#8CC04F'), clamp(v * 1.3 - 0.15)), hex('#8B8A4A'), clamp((patch - 0.6) * 2))
    }, 1.6),
  sand: () =>
    build('sand', (x, y) => fbm(N.sand, x, y, 6, 3) * 0.6 + Math.sin((y / SIZE) * Math.PI * 2 * 6 + fbm(N.sand, x, y, 3, 2) * 4) * 0.15 + fbm(N.sand, x, y, 64, 2) * 0.25,
      (v) => mix(hex('#D9BC85'), hex('#FFF0CC'), clamp(v)), 1.4),
  moss: () =>
    build('moss', (x, y) => fbm(N.moss, x, y, 16, 5, 0.6), (v) => mix(hex('#2E5A22'), hex('#9CCB55'), clamp(v * 1.4 - 0.2)), 2.4),
  water: () =>
    build('water', (x, y) => fbm(N.water, x, y, 4, 4) * 0.7 + Math.sin(((x + y) / SIZE) * Math.PI * 2 * 3) * 0.08,
      (v) => mix(hex('#1E5C86'), hex('#5FA8D8'), clamp(v)), 1.2),
  wax: () =>
    build('wax', (x, y) => fbm(N.wax, x, y, 3, 3) * 0.3, (v) => mix(hex('#EFE6D2'), hex('#FFF9EC'), clamp(v * 2)), 0.6),
  // --- Materiales de personajes (en tonos neutros: el color real lo pone el material) ---
  // Piel: poros finos y leve moteado
  skin: () =>
    build('skin', (x, y) => fbm(N.skin, x, y, 6, 3) * 0.25 - (fbm(N.skin, x + 7, y + 3, 64, 2) > 0.66 ? 0.12 : 0) + fbm(N.skin, x, y, 128, 1) * 0.06,
      (v, x, y) => mix(hex('#E9E1DE'), hex('#FFFFFF'), clamp(0.55 + (fbm(N.skin, x + 50, y, 5, 3) - 0.5) * 0.8)), 1.2),
  // Tela de algodón: tejido plano (trama y urdimbre)
  fabric: () =>
    build('fabric', (x, y) => {
      const u = (x / SIZE) * 96
      const v = (y / SIZE) * 96
      const over = (Math.floor(u) + Math.floor(v)) % 2
      const t = over ? Math.sin(Math.PI * frac(v)) : Math.sin(Math.PI * frac(u))
      return 0.35 + t * 0.45 + fbm(N.cloth, x, y, 12, 3) * 0.2
    }, (v, x, y) => mix(hex('#D9D9D9'), hex('#FFFFFF'), clamp(v * 0.7 + fbm(N.cloth, x + 9, y, 4, 3) * 0.4)), 1.6),
  // Tejido de punto (chompas, chullos y polerones)
  knit: () =>
    build('knit', (x, y) => {
      const u = (x / SIZE) * 40
      const v = (y / SIZE) * 56
      const fu = frac(u)
      return 0.5 + 0.5 * Math.cos(TAU * (frac(v) + Math.abs(fu - 0.5) * 0.9)) * Math.sin(Math.PI * fu) + fbm(N.cloth, x, y, 24, 2) * 0.15
    }, (v) => mix(hex('#C8C8C8'), hex('#FFFFFF'), clamp(v)), 2.6),
  // Jean: sarga en diagonal con hilos claros
  denim: () =>
    build('denim', (x, y) => {
      const u = (x / SIZE) * 72
      const v = (y / SIZE) * 72
      return 0.5 + 0.35 * Math.sin(TAU * (u + v)) + fbm(N.cloth, x, y, 32, 2) * 0.25
    }, (v, x, y) => mix(hex('#BFC6D0'), hex('#FFFFFF'), clamp(v * 0.6 + fbm(N.cloth, x + 31, y, 3, 3) * 0.5)), 1.4),
  // Cuero / goma de zapatillas
  leather: () =>
    build('leather', (x, y) => fbm(N.cloth, x + 77, y, 24, 4, 0.6), (v) => mix(hex('#DADADA'), hex('#FFFFFF'), clamp(v)), 1.6),
  // Pelo: mechones finos que bajan desde la coronilla
  hair: () =>
    build('hair', (x, y) => {
      const w = fbm(N.hair, x, y, 3, 3) * 3
      return 0.5 + 0.3 * Math.sin(TAU * ((x / SIZE) * 90 + w)) + 0.2 * Math.sin(TAU * ((x / SIZE) * 37 + w * 0.6)) + fbm(N.hair, x, y, 48, 2) * 0.2
    }, (v, x, y) => mix(hex('#8C8C8C'), hex('#FFFFFF'), clamp(v * 0.8 + (fbm(N.hair, x + 13, y, 6, 3) - 0.5) * 0.5)), 2.2),
  // Rizos: bucles pequeños
  curls: () =>
    build('curls', (x, y) => {
      const u = (x / SIZE) * 28
      const v = (y / SIZE) * 28
      const d = Math.hypot(frac(u + fbm(N.hair, x, y, 4, 2)) - 0.5, frac(v) - 0.5)
      return 0.5 + 0.5 * Math.cos(TAU * d * 2.2) + fbm(N.hair, x, y, 40, 2) * 0.3
    }, (v) => mix(hex('#7A7A7A'), hex('#FFFFFF'), clamp(v * 0.85)), 2.8)
}

// Textura three.js lista para usar (comparte el mismo canvas entre todas las copias)
const threeCache = {}
export function threeTex(THREE, k, repeat = 1, normal = false) {
  const id = `${k}|${repeat}|${normal}`
  if (threeCache[id]) return threeCache[id]
  const t = TEXTURES[k]()
  const tex = new THREE.CanvasTexture(normal ? t.norCanvas : t.colCanvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  if (!normal && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
  return (threeCache[id] = tex)
}

// <a-assets> con todas las texturas (mapas de color y de normales)
export function assetsHTML(keys = ['stone', 'bark', 'grass', 'sand', 'moss', 'water', 'wax', 'knit']) {
  return `<a-assets timeout="3000">${keys
    .map((k) => {
      const t = TEXTURES[k]()
      return `<img id="tx-${k}" src="${t.map}" crossorigin="anonymous"><img id="tx-${k}-n" src="${t.normal}" crossorigin="anonymous">`
    })
    .join('')}<img id="tx-aurora" src="${auroraTexture()}"></a-assets>`
}

// Material PBR listo para usar en un atributo material="..."
export function mat(k, { repeat = 1, rough = 0.9, metal = 0, color = '#FFFFFF', extra = '' } = {}) {
  return `material="src: #tx-${k}; normalMap: #tx-${k}-n; repeat: ${repeat} ${repeat}; normalTextureRepeat: ${repeat} ${repeat}; normalScale: 1 1; roughness: ${rough}; metalness: ${metal}; color: ${color}${extra ? `; ${extra}` : ''}"`
}
