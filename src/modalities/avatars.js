// Personajes personalizables para las salas. Se dibujan con primitivas 3D (A-Frame) y con un retrato SVG.
// Opciones: cuerpo, contextura, estatura, piel, ojos, cejas, expresión, peinado, color de pelo, vello facial,
// prenda superior, colores de ropa, pantalón, zapatillas y hasta 4 accesorios.

export const SKINS = ['#F6E0CC', '#EBC6A5', '#D9A57F', '#BF875F', '#9E6B47', '#7A4E33', '#5A3825']
export const HAIR_COLORS = ['#1A1412', '#3B2619', '#6A4128', '#9A6A3E', '#D8B26E', '#E8D6A8', '#B4462F', '#9AA3AD', '#5A6FD6', '#D96BA8']
export const EYE_COLORS = ['#3B2416', '#6B4423', '#4E7A3A', '#3D6FA8', '#6E7F8C']
export const CLOTH = ['#0966BF', '#1F7A4D', '#B4462F', '#8A5BD6', '#E0A43A', '#2B3A45', '#E86F9A', '#F4F1EA', '#3FA7A3', '#C0392B']
export const PANTS = ['#2E3B4E', '#1B1B1B', '#5B6B7A', '#7A5A3A', '#3D5A80', '#E7E1D3']
export const SHOES = ['#F4F4F4', '#1B1B1B', '#C0392B', '#0966BF', '#7A5A3A']

export const BODIES = { mujer: 'Mujer', hombre: 'Hombre' }
export const BUILDS = { delgado: 'Delgada/o', medio: 'Media', robusto: 'Robusta/o' }
export const HEIGHTS = { baja: 'Baja', media: 'Media', alta: 'Alta' }
export const EXPRESSIONS = { sonrisa: 'Sonrisa', alegre: 'Alegre', tranquila: 'Tranquila' }
export const BROWS = { finas: 'Finas', gruesas: 'Gruesas' }
export const HAIRS = { corto: 'Corto', largo: 'Largo', ondulado: 'Ondulado', rizado: 'Rizado', afro: 'Afro', trenzas: 'Trenzas', cola: 'Cola', recogido: 'Moño', flequillo: 'Flequillo', rapado: 'Rapado' }
export const FACIAL = { ninguno: 'Ninguno', bigote: 'Bigote', candado: 'Candado', barba: 'Barba' }
export const TOPS = { polo: 'Polo', camisa: 'Camisa', casaca: 'Casaca', poleron: 'Polerón', vestido: 'Vestido', poncho: 'Poncho andino' }
export const ACCESSORIES = {
  lentes: 'Lentes', lentes_sol: 'Lentes de sol', gorra: 'Gorra', chullo: 'Chullo', sombrero: 'Sombrero', audifonos: 'Audífonos',
  aretes: 'Aretes', flor: 'Flor en el pelo', collar: 'Collar', bufanda: 'Bufanda', mochila: 'Mochila', reloj: 'Reloj'
}
const HEAD_HATS = ['gorra', 'chullo', 'sombrero']

export const DEFAULT_AVATAR = {
  body: 'mujer', build: 'medio', height: 'media', skin: SKINS[2], eyes: EYE_COLORS[0], brows: 'finas', expression: 'sonrisa',
  hair: 'largo', hairColor: HAIR_COLORS[1], facial: 'ninguno', top: 'polo', outfit: CLOTH[0], pants: PANTS[0], shoes: SHOES[0], accessories: []
}

const HEX = /^#[0-9a-f]{6}$/i
export function normalizeAvatar(a = {}) {
  const v = { ...DEFAULT_AVATAR, ...(a || {}) }
  if (!BODIES[v.body]) v.body = 'mujer'
  if (!BUILDS[v.build]) v.build = 'medio'
  if (!HEIGHTS[v.height]) v.height = 'media'
  if (!EXPRESSIONS[v.expression]) v.expression = 'sonrisa'
  if (!BROWS[v.brows]) v.brows = 'finas'
  if (!HAIRS[v.hair]) v.hair = 'corto'
  if (!FACIAL[v.facial]) v.facial = 'ninguno'
  if (!TOPS[v.top]) v.top = 'polo'
  ;['skin', 'hairColor', 'eyes', 'outfit', 'pants', 'shoes'].forEach((k) => { if (!HEX.test(v[k] || '')) v[k] = DEFAULT_AVATAR[k] })
  // compatibilidad con la versión anterior (un solo accesorio)
  let acc = Array.isArray(v.accessories) ? v.accessories : []
  if (a?.accessory && a.accessory !== 'ninguno' && !acc.length) acc = [a.accessory]
  acc = [...new Set(acc.filter((x) => ACCESSORIES[x]))]
  // solo un sombrero a la vez
  const hats = acc.filter((x) => HEAD_HATS.includes(x))
  if (hats.length > 1) acc = acc.filter((x) => !HEAD_HATS.includes(x) || x === hats[hats.length - 1])
  if (acc.includes('lentes') && acc.includes('lentes_sol')) acc = acc.filter((x) => x !== 'lentes')
  v.accessories = acc.slice(0, 4)
  delete v.accessory
  return v
}

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * f))))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
const n3 = (x) => x.toFixed(3)

// ---------- 3D ----------
function hair3D(a) {
  const c = `color: ${a.hairColor}; roughness: 0.8`
  const cap = `<a-sphere radius="0.203" theta-length="78" position="0 0.012 0.008" material="${c}"></a-sphere>`
  const back = `<a-sphere radius="0.185" scale="1.05 0.92 1" position="0 0 0.055" material="${c}"></a-sphere>`
  const strands = (n, len, z = 0.1, w = 0.17) => {
    let o = ''
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const x = -w + t * w * 2
      o += `<a-cylinder radius="0.045" height="${len}" position="${n3(x)} ${n3(-len / 2 + 0.02)} ${n3(z + Math.abs(x) * -0.2)}" material="${c}"></a-cylinder>`
    }
    return o
  }
  switch (a.hair) {
    case 'largo':
      return cap + back + strands(6, 0.42, 0.1)
    case 'ondulado': {
      let o = cap + back
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1
        const k = Math.floor(i / 2)
        o += `<a-sphere radius="0.07" position="${n3(side * (0.15 + (k % 2) * 0.03))} ${n3(-0.05 - k * 0.055)} ${n3(0.07 + (k % 2) * 0.02)}" material="${c}"></a-sphere>`
      }
      return o
    }
    case 'rizado': {
      let o = ''
      for (let i = 0; i < 18; i++) {
        const a1 = (i / 18) * Math.PI * 2
        o += `<a-sphere radius="0.07" position="${n3(Math.cos(a1) * 0.165)} ${n3(0.09 + Math.sin(i * 1.7) * 0.03)} ${n3(Math.sin(a1) * 0.165 + 0.03)}" material="${c}"></a-sphere>`
      }
      return o + `<a-sphere radius="0.17" position="0 0.1 0.03" material="${c}"></a-sphere>` + back
    }
    case 'afro':
      return `<a-sphere radius="0.25" scale="1 0.95 0.95" position="0 0.11 0.1" material="${c}; roughness: 1"></a-sphere>`
    case 'trenzas': {
      let o = cap + back
      ;[-1, 1].forEach((side) => {
        for (let k = 0; k < 7; k++) o += `<a-sphere radius="${n3(0.042 - k * 0.002)}" position="${n3(side * 0.17)} ${n3(-0.08 - k * 0.06)} ${n3(0.02 - k * 0.005)}" material="${c}"></a-sphere>`
        o += `<a-sphere radius="0.022" position="${n3(side * 0.17)} -0.52 -0.02" material="color: #E86F9A"></a-sphere>`
      })
      return o
    }
    case 'cola':
      return `${cap}${back}<a-sphere radius="0.05" position="0 0.08 0.2" material="color: #E86F9A"></a-sphere><a-cylinder radius="0.05" radius-top="0.06" height="0.36" position="0 -0.08 0.23" rotation="12 0 0" material="${c}"></a-cylinder><a-sphere radius="0.05" position="0 -0.26 0.26" material="${c}"></a-sphere>`
    case 'recogido':
      return `${cap}${back}<a-sphere radius="0.095" position="0 0.17 0.15" material="${c}"></a-sphere>`
    case 'flequillo':
      return `${cap}${back}<a-box width="0.3" height="0.07" depth="0.06" position="0 0.11 -0.15" rotation="-18 0 0" material="${c}"></a-box>`
    case 'rapado':
      return `<a-sphere radius="0.196" theta-length="75" position="0 0.004 0.004" material="color: ${a.hairColor}; opacity: 0.7; transparent: true; roughness: 1"></a-sphere>`
    default:
      return cap + back
  }
}


function headAcc3D(a) {
  let o = ''
  const has = (k) => a.accessories.includes(k)
  if (has('lentes')) o += `<a-torus radius="0.042" radius-tubular="0.006" position="-0.065 0.024 -0.19" material="color: #2B2B2B; metalness: 0.4"></a-torus><a-torus radius="0.042" radius-tubular="0.006" position="0.065 0.024 -0.19" material="color: #2B2B2B; metalness: 0.4"></a-torus><a-box width="0.04" height="0.008" depth="0.008" position="0 0.03 -0.195" material="color: #2B2B2B"></a-box>`
  if (has('lentes_sol')) o += `<a-box width="0.085" height="0.05" depth="0.01" position="-0.062 0.024 -0.195" material="color: #121212; metalness: 0.6; roughness: 0.1"></a-box><a-box width="0.085" height="0.05" depth="0.01" position="0.062 0.024 -0.195" material="color: #121212; metalness: 0.6; roughness: 0.1"></a-box><a-box width="0.26" height="0.012" depth="0.01" position="0 0.05 -0.196" material="color: #121212"></a-box>`
  if (has('gorra')) o += `<a-sphere radius="0.212" theta-length="70" position="0 0.03 0" material="color: ${a.outfit}; roughness: 0.8"></a-sphere><a-box width="0.22" height="0.015" depth="0.14" position="0 0.1 -0.24" rotation="-8 0 0" material="color: ${shade(a.outfit, 0.8)}"></a-box><a-sphere radius="0.018" position="0 0.24 0" material="color: ${shade(a.outfit, 0.8)}"></a-sphere>`
  if (has('chullo')) {
    o += `<a-sphere radius="0.216" theta-length="82" position="0 0.03 0" material="color: #C0392B; roughness: 0.95"></a-sphere>`
    ;[['#F4F1EA', 0.1], ['#E0A43A', 0.15], ['#1F7A4D', 0.19]].forEach(([col, y]) => { o += `<a-torus radius="${n3(Math.sqrt(Math.max(0.001, 0.216 ** 2 - (y - 0.03) ** 2)))}" radius-tubular="0.012" rotation="90 0 0" position="0 ${y} 0" material="color: ${col}"></a-torus>` })
    o += `<a-cone radius-bottom="0.06" radius-top="0.01" height="0.18" position="-0.19 -0.09 0.02" material="color: #C0392B"></a-cone><a-cone radius-bottom="0.06" radius-top="0.01" height="0.18" position="0.19 -0.09 0.02" material="color: #C0392B" rotation="0 0 0"></a-cone>`
    o += `<a-cylinder radius="0.005" height="0.12" position="-0.19 -0.24 0.02" material="color: #E0A43A"></a-cylinder><a-cylinder radius="0.005" height="0.12" position="0.19 -0.24 0.02" material="color: #E0A43A"></a-cylinder><a-sphere radius="0.05" position="0 0.27 0" material="color: #E0A43A"></a-sphere>`
  }
  if (has('sombrero')) o += `<a-cylinder radius="0.34" height="0.015" position="0 0.11 0" material="color: #D8B26E; roughness: 0.9"></a-cylinder><a-cylinder radius="0.17" radius-top="0.15" height="0.16" position="0 0.19 0" material="color: #D8B26E; roughness: 0.9"></a-cylinder><a-cylinder radius="0.172" height="0.03" position="0 0.13 0" material="color: #2B3A45"></a-cylinder>`
  if (has('audifonos')) o += `<a-torus radius="0.215" radius-tubular="0.015" arc="180" position="0 0.02 0" material="color: #2B2B2B"></a-torus><a-cylinder radius="0.065" height="0.055" rotation="0 0 90" position="-0.215 0 0" material="color: #2B2B2B"></a-cylinder><a-cylinder radius="0.065" height="0.055" rotation="0 0 90" position="0.215 0 0" material="color: #2B2B2B"></a-cylinder><a-circle radius="0.045" rotation="0 -90 0" position="-0.245 0 0" material="color: ${a.outfit}"></a-circle><a-circle radius="0.045" rotation="0 90 0" position="0.245 0 0" material="color: ${a.outfit}"></a-circle>`
  if (has('aretes')) o += `<a-sphere radius="0.014" position="-0.188 -0.05 -0.005" material="color: #E8C15A; metalness: 0.8; roughness: 0.2"></a-sphere><a-sphere radius="0.014" position="0.188 -0.05 -0.005" material="color: #E8C15A; metalness: 0.8; roughness: 0.2"></a-sphere>`
  if (has('flor')) {
    o += '<a-entity position="0.15 0.13 -0.08">'
    for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; o += `<a-sphere radius="0.025" position="${n3(Math.cos(t) * 0.03)} ${n3(Math.sin(t) * 0.03)} 0" material="color: #F2A3C0"></a-sphere>` }
    o += '<a-sphere radius="0.018" material="color: #F4D35E"></a-sphere></a-entity>'
  }
  return o
}


// Detalles de ropa y accesorios del cuerpo (se suman a la base de avatar3d.js)
function bodyExtras(a) {
  const woman = a.body === 'mujer'
  const bx = { delgado: 0.88, medio: 1, robusto: 1.17 }[a.build]
  const chestZ = -(woman ? 0.165 : 0.185) * bx * 0.74
  const dark = shade(a.outfit, 0.7)
  const has = (k) => a.accessories.includes(k)
  let o = ''
  if (a.top === 'camisa') o += `<a-box width="0.07" height="0.05" depth="0.015" position="-0.04 1.17 ${n3(chestZ * 0.62)}" rotation="0 0 -32" material="color: ${dark}"></a-box><a-box width="0.07" height="0.05" depth="0.015" position="0.04 1.17 ${n3(chestZ * 0.62)}" rotation="0 0 32" material="color: ${dark}"></a-box>${[1.08, 0.99, 0.9].map((y) => `<a-sphere radius="0.008" position="0 ${y} ${n3(chestZ - 0.003)}" material="color: #F4F4F4"></a-sphere>`).join('')}`
  if (a.top === 'casaca') o += `<a-box width="0.03" height="0.42" depth="0.01" position="0 0.96 ${n3(chestZ - 0.002)}" material="color: ${dark}"></a-box><a-torus radius="0.07" radius-tubular="0.022" rotation="90 0 0" position="0 1.2 0" material="color: ${dark}"></a-torus>`
  if (a.top === 'poleron') o += `<a-sphere radius="0.14" scale="1.15 0.75 0.75" position="0 1.21 0.11" material="color: ${a.outfit}; roughness: 0.85"></a-sphere><a-box width="0.18" height="0.09" depth="0.012" position="0 0.84 ${n3(chestZ * 0.86 - 0.004)}" material="color: ${dark}"></a-box><a-cylinder radius="0.004" height="0.1" position="-0.03 1.1 ${n3(chestZ - 0.002)}" material="color: #F4F4F4"></a-cylinder><a-cylinder radius="0.004" height="0.1" position="0.03 1.1 ${n3(chestZ - 0.002)}" material="color: #F4F4F4"></a-cylinder>`
  if (has('collar')) o += `<a-torus radius="0.075" radius-tubular="0.006" rotation="75 0 0" position="0 1.18 -0.02" material="color: #E8C15A; metalness: 0.8; roughness: 0.25"></a-torus><a-sphere radius="0.016" position="0 1.1 ${n3(chestZ * 0.75)}" material="color: #3FA7A3; metalness: 0.3"></a-sphere>`
  if (has('bufanda')) o += `<a-torus radius="0.085" radius-tubular="0.04" rotation="90 0 0" position="0 1.21 0" material="color: #C0392B; roughness: 1"></a-torus><a-box width="0.075" height="0.22" depth="0.035" position="0.06 1.06 ${n3(chestZ - 0.02)}" rotation="0 0 -8" material="color: #C0392B; roughness: 1"></a-box><a-box width="0.077" height="0.02" depth="0.037" position="0.068 0.96 ${n3(chestZ - 0.02)}" material="color: #F4F1EA"></a-box>`
  if (has('mochila')) o += `<a-box width="0.28" height="0.34" depth="0.13" position="0 0.98 ${n3(-chestZ + 0.07)}" material="color: #2B3A45; roughness: 0.8"></a-box><a-box width="0.24" height="0.13" depth="0.04" position="0 0.88 ${n3(-chestZ + 0.15)}" material="color: #E0A43A"></a-box><a-box width="0.028" height="0.36" depth="0.015" position="-0.1 1.0 ${n3(chestZ - 0.004)}" material="color: #2B3A45"></a-box><a-box width="0.028" height="0.36" depth="0.015" position="0.1 1.0 ${n3(chestZ - 0.004)}" material="color: #2B3A45"></a-box>`
  if (has('reloj')) { const x = -((woman ? 0.18 : 0.215) * bx - 0.02 + 0.06); o += `<a-cylinder radius="0.047" height="0.028" position="${n3(x)} 0.66 -0.045" material="color: #1B1B1B"></a-cylinder><a-circle radius="0.024" rotation="0 -90 0" position="${n3(x - 0.048)} 0.66 -0.045" material="shader: flat; color: #7CC0F8"></a-circle>` }
  return o
}

function facialHair(a) {
  const fc = `color: ${a.hairColor}; roughness: 1`
  let o = ''
  if (a.facial === 'bigote' || a.facial === 'candado' || a.facial === 'barba') o += `<a-box width="0.1" height="0.02" depth="0.02" position="0 -0.045 -0.185" material="${fc}"></a-box>`
  if (a.facial === 'candado') o += `<a-sphere radius="0.05" scale="1 0.8 0.8" position="0 -0.15 -0.13" material="${fc}"></a-sphere>`
  if (a.facial === 'barba') o += `<a-sphere radius="0.1" scale="1.4 0.85 1" position="0 -0.12 -0.08" material="${fc}"></a-sphere>`
  return o
}

// Personaje completo (mirando hacia -z). La cabeza va en un grupo aparte para seguir la orientación del dispositivo.
export function avatarHTML(av, name = '') {
  const a = normalizeAvatar(av)
  const hy = { baja: 0.92, media: 1, alta: 1.08 }[a.height]
  const json = JSON.stringify(a).replace(/"/g, '&quot;')
  return `<a-entity scale="${hy} ${hy} ${hy}">
    <a-entity class="body" avatar-body="${json}">${bodyExtras(a)}</a-entity>
    <a-entity class="head" position="0 1.43 0" avatar-head>
      <a-entity class="face" avatar-face="${json}"></a-entity>
      ${facialHair(a)}
      ${hair3D(a)}
      ${headAcc3D(a)}
    </a-entity>
    <a-ring class="talk" radius-inner="0.34" radius-outer="0.38" rotation="-90 0 0" position="0 0.02 0" visible="false" material="shader: flat; color: #6FD3A0" animation="property: scale; from: 1 1 1; to: 1.2 1.2 1.2; dir: alternate; loop: true; dur: 500"></a-ring>
    <a-text class="name" value="${String(name).replace(/["<>]/g, '')}" align="center" width="2.2" color="#FFFFFF" position="0 1.95 0" rotation="0 180 0"></a-text>
    <a-text class="bubble" value="" align="center" width="2.4" color="${a.outfit}" position="0 2.15 0" rotation="0 180 0"></a-text>
  </a-entity>`
}

// ---------- Retrato SVG para el editor ----------
export function avatarSVG(av) {
  const a = normalizeAvatar(av)
  const woman = a.body === 'mujer'
  const has = (k) => a.accessories.includes(k)
  const hc = a.hairColor
  const bx = { delgado: 0.9, medio: 1, robusto: 1.15 }[a.build]
  const backHair = {
    largo: `<path d="M37 50 Q34 20 60 18 Q86 20 83 50 L86 100 Q72 92 70 64 L50 64 Q48 92 34 100 Z" fill="${hc}"/>`,
    ondulado: `<path d="M37 50 Q34 20 60 18 Q86 20 83 50 Q90 62 84 72 Q90 84 80 92 L70 64 L50 64 L40 92 Q30 84 36 72 Q30 62 37 50 Z" fill="${hc}"/>`,
    afro: `<circle cx="60" cy="42" r="34" fill="${hc}"/>`,
    trenzas: `<g fill="${hc}">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="37" cy="${66 + i * 7}" r="${5 - i * 0.3}"/><circle cx="83" cy="${66 + i * 7}" r="${5 - i * 0.3}"/>`).join('')}</g>`,
    cola: `<path d="M74 34 Q96 40 90 70 Q86 56 76 48 Z" fill="${hc}"/>`
  }[a.hair] || ''
  const frontHair = {
    corto: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${hc}"/>`,
    largo: `<path d="M38 48 Q40 22 60 21 Q80 22 82 48 Q76 33 60 32 Q44 33 38 48 Z" fill="${hc}"/>`,
    ondulado: `<path d="M38 48 Q40 22 60 21 Q80 22 82 48 Q76 33 60 32 Q44 33 38 48 Z" fill="${hc}"/>`,
    rizado: `<g fill="${hc}">${[32, 41, 50, 60, 70, 79, 88].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 24 : 29}" r="10"/>`).join('')}<circle cx="34" cy="44" r="8"/><circle cx="86" cy="44" r="8"/></g>`,
    afro: '',
    trenzas: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${hc}"/>`,
    cola: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${hc}"/>`,
    recogido: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${hc}"/><circle cx="60" cy="15" r="10" fill="${hc}"/>`,
    flequillo: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 L80 40 Q60 44 40 40 Z" fill="${hc}"/>`,
    rapado: `<path d="M39 46 Q40 23 60 22 Q80 23 81 46 Q76 32 60 31 Q44 32 39 46 Z" fill="${hc}" opacity="0.6"/>`
  }[a.hair]
  const mouth = a.expression === 'alegre'
    ? '<path d="M52 61 Q60 71 68 61 Z" fill="#7A2E28"/><path d="M53 61.5 H67" stroke="#fff" stroke-width="2"/>'
    : a.expression === 'tranquila'
      ? '<path d="M55 63 H65" stroke="#8A3B32" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M53 61 Q60 67 67 61" fill="none" stroke="#8A3B32" stroke-width="2.2" stroke-linecap="round"/>'
  const browW = a.brows === 'gruesas' ? 3 : 1.6
  const facial = { ninguno: '', bigote: `<path d="M52 58 Q60 54 68 58 Q60 60 52 58 Z" fill="${hc}"/>`, candado: `<path d="M52 58 Q60 54 68 58 Q60 60 52 58 Z" fill="${hc}"/><ellipse cx="60" cy="72" rx="6" ry="4" fill="${hc}"/>`, barba: `<path d="M39 54 Q42 80 60 80 Q78 80 81 54 Q76 68 60 69 Q44 68 39 54 Z" fill="${hc}"/><path d="M52 58 Q60 54 68 58 Q60 60 52 58 Z" fill="${hc}"/>` }[a.facial]
  const topShape = {
    polo: `<path d="M${60 - 26 * bx} 90 Q60 80 ${60 + 26 * bx} 90 L${60 + 32 * bx} 120 H${60 - 32 * bx} Z" fill="${a.outfit}"/>`,
    camisa: `<path d="M${60 - 26 * bx} 90 Q60 80 ${60 + 26 * bx} 90 L${60 + 32 * bx} 120 H${60 - 32 * bx} Z" fill="${a.outfit}"/><path d="M52 84 L60 94 L68 84" fill="${shade(a.outfit, 0.7)}"/><circle cx="60" cy="102" r="1.6" fill="#fff"/><circle cx="60" cy="111" r="1.6" fill="#fff"/>`,
    casaca: `<path d="M${60 - 27 * bx} 90 Q60 80 ${60 + 27 * bx} 90 L${60 + 33 * bx} 120 H${60 - 33 * bx} Z" fill="${a.outfit}"/><rect x="58" y="86" width="4" height="34" fill="${shade(a.outfit, 0.65)}"/>`,
    poleron: `<path d="M${60 - 27 * bx} 90 Q60 80 ${60 + 27 * bx} 90 L${60 + 33 * bx} 120 H${60 - 33 * bx} Z" fill="${a.outfit}"/><path d="M44 86 Q60 96 76 86" fill="none" stroke="${shade(a.outfit, 0.7)}" stroke-width="4"/><path d="M57 92 V104 M63 92 V104" stroke="#fff" stroke-width="1.5"/>`,
    vestido: `<path d="M${60 - 20 * bx} 88 Q60 80 ${60 + 20 * bx} 88 L${60 + 34 * bx} 120 H${60 - 34 * bx} Z" fill="${a.outfit}"/><path d="M${60 - 22 * bx} 104 H${60 + 22 * bx}" stroke="${shade(a.outfit, 0.7)}" stroke-width="2"/>`,
    poncho: `<path d="M60 82 L${60 + 44 * bx} 120 H${60 - 44 * bx} Z" fill="${a.outfit}"/><path d="M${60 - 30 * bx} 104 H${60 + 30 * bx}" stroke="#F4F1EA" stroke-width="3"/><path d="M${60 - 36 * bx} 110 H${60 + 36 * bx}" stroke="#E0A43A" stroke-width="3"/>`
  }[a.top]
  let acc = ''
  if (has('mochila')) acc += '<path d="M42 92 V120 M78 92 V120" stroke="#2B3A45" stroke-width="4"/>'
  if (has('collar')) acc += '<path d="M50 82 Q60 92 70 82" fill="none" stroke="#E8C15A" stroke-width="1.8"/><circle cx="60" cy="89" r="2.4" fill="#3FA7A3"/>'
  if (has('bufanda')) acc += '<path d="M44 80 Q60 90 76 80 L76 86 Q60 96 44 86 Z" fill="#C0392B"/><rect x="62" y="86" width="8" height="18" rx="2" fill="#C0392B"/>'
  if (has('aretes')) acc += '<circle cx="38" cy="58" r="2.4" fill="#E8C15A"/><circle cx="82" cy="58" r="2.4" fill="#E8C15A"/>'
  if (has('lentes')) acc += '<g fill="none" stroke="#1B1B1B" stroke-width="2.3"><circle cx="51" cy="49" r="7"/><circle cx="69" cy="49" r="7"/><path d="M58 49 H62"/></g>'
  if (has('lentes_sol')) acc += '<g fill="#121212"><rect x="43" y="44" width="15" height="10" rx="3"/><rect x="62" y="44" width="15" height="10" rx="3"/><rect x="40" y="44" width="40" height="2.5"/></g>'
  if (has('audifonos')) acc += `<path d="M36 50 Q36 15 60 15 Q84 15 84 50" fill="none" stroke="#2B2B2B" stroke-width="4"/><rect x="31" y="43" width="9" height="16" rx="4" fill="#2B2B2B"/><rect x="80" y="43" width="9" height="16" rx="4" fill="#2B2B2B"/>`
  if (has('gorra')) acc += `<path d="M37 40 Q38 14 60 14 Q82 14 83 40 Z" fill="${a.outfit}"/><path d="M34 40 H86 Q80 46 60 45 Q40 46 34 40 Z" fill="${shade(a.outfit, 0.75)}"/>`
  if (has('chullo')) acc += '<path d="M36 42 Q37 12 60 12 Q83 12 84 42 Z" fill="#C0392B"/><path d="M38 30 H82" stroke="#F4F1EA" stroke-width="3"/><path d="M37 36 H83" stroke="#E0A43A" stroke-width="3"/><path d="M36 42 L33 62 L40 44 Z M84 42 L87 62 L80 44 Z" fill="#C0392B"/><circle cx="60" cy="9" r="5" fill="#E0A43A"/>'
  if (has('sombrero')) acc += '<ellipse cx="60" cy="33" rx="36" ry="6" fill="#D8B26E"/><path d="M44 33 Q45 12 60 12 Q75 12 76 33 Z" fill="#D8B26E"/><rect x="44" y="27" width="32" height="4" fill="#2B3A45"/>'
  if (has('flor')) acc += '<g transform="translate(76 30)"><circle cx="-4" cy="0" r="3.5" fill="#F2A3C0"/><circle cx="4" cy="0" r="3.5" fill="#F2A3C0"/><circle cx="0" cy="-4" r="3.5" fill="#F2A3C0"/><circle cx="0" cy="4" r="3.5" fill="#F2A3C0"/><circle r="2.5" fill="#F4D35E"/></g>'
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista previa del personaje">
    <rect width="120" height="120" rx="24" fill="var(--tint)"/>
    ${backHair}
    ${topShape}
    <rect x="54" y="68" width="12" height="14" fill="${a.skin}"/>
    <ellipse cx="38.5" cy="51" rx="3.5" ry="5.5" fill="${a.skin}"/><ellipse cx="81.5" cy="51" rx="3.5" ry="5.5" fill="${a.skin}"/>
    <ellipse cx="60" cy="50" rx="21" ry="24" fill="${a.skin}"/>
    <ellipse cx="52" cy="49" rx="4" ry="3.3" fill="#fff"/><ellipse cx="68" cy="49" rx="4" ry="3.3" fill="#fff"/>
    <circle cx="52" cy="49" r="2.3" fill="${a.eyes}"/><circle cx="68" cy="49" r="2.3" fill="${a.eyes}"/>
    <circle cx="52" cy="49" r="1.1" fill="#0A0A0A"/><circle cx="68" cy="49" r="1.1" fill="#0A0A0A"/>
    <path d="M47 42 Q52 ${a.expression === 'alegre' ? 39 : 41} 57 42 M63 42 Q68 ${a.expression === 'alegre' ? 39 : 41} 73 42" fill="none" stroke="${shade(hc, 0.9)}" stroke-width="${browW}" stroke-linecap="round"/>
    <path d="M60 52 Q58 57 61 57" fill="none" stroke="${shade(a.skin, 0.8)}" stroke-width="1.5" stroke-linecap="round"/>
    ${mouth}
    <circle cx="47" cy="58" r="3.5" fill="#F2A3A3" opacity="${woman ? 0.5 : 0.2}"/><circle cx="73" cy="58" r="3.5" fill="#F2A3A3" opacity="${woman ? 0.5 : 0.2}"/>
    ${facial}
    ${frontHair}
    ${acc}
  </svg>`
}
