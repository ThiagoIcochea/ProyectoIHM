import { mat } from './textures'
import { terrainHeight, blocked } from './terrainMath'

// Mundos del Santuario de calma (A-Frame). Todo se genera con primitivas: no hay modelos ni texturas externas.
// Cada mundo combina cielo en degradado, suelo, vegetación o paisaje, partículas animadas y luz propia.

export const WORLDS = {
  bosque: {
    label: 'Bosque', sound: 'bosque', text: '#0E293D', desc: 'Pinos, un arroyo y luciérnagas entre los árboles.',
    sky: ['#7FC4EC', '#E4F3FA'], ground: '#4F8A5F', terrain: { height: 5, flat: 10, low: '#3F7A34', mid: '#6E9A45', high: '#7B6E5A', tex: 'grass', repeat: 60 }, fog: '#CFE8F2', ambient: 0.85, sun: 0.75, sunColor: '#FFF4DC'
  },
  playa: {
    label: 'Playa', sound: 'olas', text: '#0E293D', desc: 'Atardecer, palmeras y olas que van y vienen.',
    sky: ['#F59E7B', '#FCE6C8'], ground: '#E8D2A2', terrain: { height: 0.5, flat: 80, low: '#E3CB95', mid: '#F0DDB0', high: '#D9C08A', tex: 'sand', repeat: 70 }, fog: '#F6E3CF', ambient: 0.9, sun: 0.8, sunColor: '#FFD7A8'
  },
  noche: {
    label: 'Noche', sound: 'lluvia', text: '#E7F1F8', desc: 'Una fogata tranquila bajo la aurora y las estrellas.',
    sky: ['#050B18', '#1B3552'], ground: '#13283B', terrain: { height: 5, flat: 10, low: '#1B3426', mid: '#2A4430', high: '#3C4048', tex: 'grass', repeat: 60 }, fog: '#0B1A2A', ambient: 0.45, sun: 0.25, sunColor: '#9FC3FF'
  },
  montana: {
    label: 'Montaña', sound: 'bosque', text: '#0E293D', desc: 'Un lago entre montañas nevadas y nubes lentas.',
    sky: ['#5DA9E9', '#EAF4FB'], ground: '#6E8F63', terrain: { height: 9, flat: 27, snow: 11, low: '#4E7D3C', mid: '#7E9450', high: '#8C877E', peak: '#F4F7FA', tex: 'grass', repeat: 60 }, fog: '#DCEBF5', ambient: 0.9, sun: 0.8, sunColor: '#FFFFFF'
  },
  fogata: {
    label: 'Fogata', sound: 'fogata', text: '#F4E9DA', desc: 'Una fogata en un claro del bosque, bajo las estrellas.',
    sky: ['#04070F', '#22203A'], ground: '#1C2A1E', terrain: { height: 4, flat: 9, low: '#24402A', mid: '#3A5434', high: '#4E4A42', tex: 'grass', repeat: 60 }, fog: '#0C0F1A', ambient: 0.35, sun: 0.15, sunColor: '#8FA8FF'
  },
  espacio: {
    label: 'Espacio', sound: 'olas', text: '#E7F1F8', desc: 'Flotas sobre una plataforma entre planetas y nebulosas.',
    sky: ['#02030A', '#1A1040'], ground: null, fog: null, ambient: 0.6, sun: 0.5, sunColor: '#C8B6FF'
  },
  jardin: {
    label: 'Jardín zen', sound: 'lluvia', text: '#0E293D', desc: 'Cerezos, faroles de piedra y un estanque con peces koi.',
    sky: ['#F7C6D9', '#FDF1F5'], ground: '#E9E1CF', terrain: { height: 2, flat: 30, low: '#E6DCC6', mid: '#DCCFB4', high: '#B9B2A6', tex: 'sand', repeat: 60 }, fog: '#F6E8EE', ambient: 0.95, sun: 0.6, sunColor: '#FFE9F1'
  }
}

// Cielo en degradado vertical como textura (canvas → data URL)
const skyCache = {}
export function skyTexture([top, bottom]) {
  const k = top + bottom
  if (skyCache[k]) return skyCache[k]
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 512
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, top)
  grad.addColorStop(0.55, bottom)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 512)
  return (skyCache[k] = c.toDataURL())
}

function rng(seed) {
  let x = seed
  return () => ((x = (x * 16807) % 2147483647) / 2147483647)
}
const f = (n) => n.toFixed(2)
const ring = (r, min, max) => {
  const a = r() * Math.PI * 2
  const d = min + r() * (max - min)
  return [Math.cos(a) * d, Math.sin(a) * d]
}
// Evita el pasillo frente al usuario donde está la esfera y los paneles
let WORLD = ''
const clearPath = (x, z) => !(Math.abs(x) < 3 && z < 0 && z > -7) && !blocked(WORLD, x, z, 1.6)

const HIDE = 'hide-on-enter-ar'
let TER = null
const Y = (x, z) => terrainHeight(x, z, TER)

function pine(x, z, h, r, c1 = '#2F6B4F', c2 = '#3E8462') {
  return `<a-entity position="${f(x)} ${f(Y(x, z) - 0.05)} ${f(z)}" ${HIDE}><a-cylinder radius="0.13" height="1" position="0 0.5 0" ${mat('bark', { repeat: 1 })}></a-cylinder><a-cone radius-bottom="${f(r)}" radius-top="0" height="${f(h)}" position="0 ${f(0.8 + h / 2)} 0" color="${c1}"></a-cone><a-cone radius-bottom="${f(r * 0.72)}" radius-top="0" height="${f(h * 0.7)}" position="0 ${f(0.8 + h * 0.75)} 0" color="${c2}"></a-cone></a-entity>`
}
function roundTree(x, z, s, leaf = '#5AA469') {
  return `<a-entity position="${f(x)} ${f(Y(x, z) - 0.05)} ${f(z)}" scale="${f(s)} ${f(s)} ${f(s)}" ${HIDE}><a-cylinder radius="0.14" height="1.4" position="0 0.7 0" ${mat('bark', { repeat: 1 })}></a-cylinder><a-sphere radius="0.9" position="0 2 0" ${mat('moss', { repeat: 2, color: leaf })}></a-sphere><a-sphere radius="0.65" position="0.5 1.7 0.2" ${mat('moss', { repeat: 2, color: leaf })}></a-sphere><a-sphere radius="0.6" position="-0.45 1.75 -0.2" ${mat('moss', { repeat: 2, color: leaf })}></a-sphere></a-entity>`
}
function rock(x, z, s, c = '#FFFFFF') {
  return `<a-dodecahedron radius="${f(s)}" position="${f(x)} ${f(Y(x, z) + s * 0.35)} ${f(z)}" rotation="${f(s * 40)} ${f(s * 90)} 0" scale="1 0.7 1" ${mat('stone', { repeat: 1, color: c })} ${HIDE}></a-dodecahedron>`
}
function cloud(x, y, z, s, dur) {
  return `<a-entity position="${f(x)} ${f(y)} ${f(z)}" scale="${f(s)} ${f(s * 0.6)} ${f(s)}" animation="property: position; to: ${f(x + 14)} ${f(y)} ${f(z)}; dur: ${dur}; dir: alternate; loop: true; easing: easeInOutSine" ${HIDE}>
    <a-sphere radius="1.6" material="color: #FFFFFF; opacity: 0.9; transparent: true"></a-sphere><a-sphere radius="1.2" position="1.6 -0.2 0" material="color: #FFFFFF; opacity: 0.9; transparent: true"></a-sphere><a-sphere radius="1.1" position="-1.5 -0.3 0.2" material="color: #FFFFFF; opacity: 0.9; transparent: true"></a-sphere></a-entity>`
}
function glow(x, y, z, color, r, i, dur) {
  return `<a-sphere radius="${f(r)}" position="${f(x)} ${f(y)} ${f(z)}" material="shader: flat; color: ${color}; opacity: 0.9; transparent: true"
    animation="property: position; to: ${f(x + 0.4)} ${f(y + 0.8)} ${f(z - 0.3)}; dir: alternate; loop: true; dur: ${dur}; easing: easeInOutSine; delay: ${i * 120}"
    animation__blink="property: material.opacity; from: 0.15; to: 0.95; dir: alternate; loop: true; dur: ${Math.round(dur / 2)}; delay: ${i * 90}" ${HIDE}></a-sphere>`
}
function bird(x, y, z, radius, dur, color = '#2B3A45') {
  return `<a-entity position="${f(x)} ${f(y)} ${f(z)}" animation="property: rotation; to: 0 360 0; loop: true; dur: ${dur}; easing: linear" ${HIDE}>
    <a-entity position="${f(radius)} 0 0" rotation="0 0 0" animation="property: position; to: ${f(radius)} 0.6 0; dir: alternate; loop: true; dur: 1400; easing: easeInOutSine">
      <a-box width="0.5" height="0.03" depth="0.12" position="-0.22 0 0" rotation="0 0 18" color="${color}" animation="property: rotation; to: 0 0 -18; dir: alternate; loop: true; dur: 380"></a-box>
      <a-box width="0.5" height="0.03" depth="0.12" position="0.22 0 0" rotation="0 0 -18" color="${color}" animation="property: rotation; to: 0 0 18; dir: alternate; loop: true; dur: 380"></a-box>
    </a-entity></a-entity>`
}

const BUILDERS = {
  bosque() {
    const r = rng(7)
    let o = ''
    for (let i = 0; i < 60; i++) {
      const [x, z] = ring(r, 6, 30)
      if (!clearPath(x, z)) continue
      o += r() > 0.35 ? pine(x, z, 2.4 + r() * 3, 0.9 + r() * 0.7) : roundTree(x, z, 0.8 + r() * 0.6, r() > 0.5 ? '#5AA469' : '#6DBB7A')
    }
    for (let i = 0; i < 14; i++) { const [x, z] = ring(r, 3.5, 16); if (clearPath(x, z)) o += rock(x, z, 0.2 + r() * 0.5) }
    for (let i = 0; i < 40; i++) {
      const [x, z] = ring(r, 2.5, 12)
      if (!clearPath(x, z)) continue
      const c = ['#F4D35E', '#F28FAD', '#FFFFFF', '#B9A6F5'][i % 4]
      o += `<a-entity position="${f(x)} ${f(Y(x, z))} ${f(z)}" ${HIDE}><a-cylinder radius="0.015" height="0.3" position="0 0.15 0" color="#3E7A4E"></a-cylinder><a-sphere radius="0.07" position="0 0.32 0" color="${c}"></a-sphere></a-entity>`
    }
    // Arroyo
    o += `<a-entity position="7 0.06 -6" rotation="0 25 0" water-surface="width: 2.6; depth: 60; seg: 120; amp: 0.025; flow: 0 1.2; speed: 1.4; deep: #1C5A6B; shallow: #4FB3C9; skyTop: #7FC4EC; skyHorizon: #E4F3FA; foam: 0.5" ${HIDE}></a-entity>`
    for (let i = 0; i < 24; i++) { const [x, z] = ring(r, 3, 14); o += glow(x, 0.6 + r() * 1.6, z, '#F8F3A6', 0.04, i, 2600 + r() * 2000) }
    o += cloud(-12, 16, -30, 1.4, 40000) + cloud(8, 18, -36, 1.8, 52000) + cloud(-20, 14, 10, 1.2, 46000)
    o += bird(0, 9, -12, 8, 22000) + bird(4, 11, -16, 10, 28000)
    return o
  },
  playa() {
    const r = rng(11)
    let o = `<a-entity id="sea" position="0 0.06 -30" water-surface="width: 180; depth: 42; seg: 160; amp: 0.22; flow: 0 0.35; speed: 1; deep: #0A3F66; shallow: #1E9BBF; skyTop: #F59E7B; skyHorizon: #FCE6C8; opacity: 0.9; foam: 0.9" ${HIDE}></a-entity>`
    o += `<a-circle radius="3.2" position="14 7 -55" material="shader: flat; color: #FFD27A" ${HIDE}></a-circle><a-circle radius="5" position="14 7 -55.1" material="shader: flat; color: #FFB86B; opacity: 0.35; transparent: true" ${HIDE}></a-circle>`
    const palms = [[-6, -5], [-8, 2], [7, -4], [9, 3], [-12, -4], [12, -3], [-4, 7], [5, 8]]
    palms.forEach(([x, z], i) => {
      const lean = (i % 2 ? 1 : -1) * (6 + r() * 6)
      let leaves = ''
      for (let k = 0; k < 7; k++) leaves += `<a-cone radius-bottom="0.35" radius-top="0.02" height="2.4" position="0 0 0" rotation="${f(60 + r() * 20)} ${k * 51} 0" color="${k % 2 ? '#3E9B5E' : '#2F8550'}"></a-cone>`
      o += `<a-entity position="${x} 0 ${z}" rotation="0 0 ${f(lean)}" ${HIDE}><a-cylinder radius="0.16" radius-top="0.1" height="4.6" position="0 2.3 0" ${mat('bark', { repeat: 2, color: '#E8D3B8' })}></a-cylinder><a-entity position="0 4.6 0" animation="property: rotation; to: 0 0 4; dir: alternate; loop: true; dur: 2800; easing: easeInOutSine">${leaves}<a-sphere radius="0.18" position="0.2 -0.2 0" color="#6B4F2E"></a-sphere></a-entity></a-entity>`
    })
    for (let i = 0; i < 12; i++) { const [x, z] = ring(r, 2.5, 9); if (clearPath(x, z)) o += `<a-sphere radius="${f(0.08 + r() * 0.08)}" position="${f(x)} 0.04 ${f(z)}" scale="1 0.4 1" color="${['#F7E1D7', '#F1B9A1', '#FFFFFF'][i % 3]}" ${HIDE}></a-sphere>` }
    o += `<a-entity position="-3.5 0 -1.5" ${HIDE}><a-cylinder radius="0.04" height="2.4" position="0 1.2 0" color="#EDEDED"></a-cylinder><a-cone radius-bottom="1.4" radius-top="0.05" height="0.6" position="0 2.4 0" color="#F28F6B"></a-cone></a-entity>`
    o += cloud(-16, 13, -40, 1.6, 50000) + cloud(10, 15, -44, 1.3, 60000)
    o += bird(-2, 7, -14, 7, 20000, '#FFFFFF') + bird(3, 8.5, -18, 9, 26000, '#FFFFFF') + bird(0, 10, -10, 12, 30000, '#FFFFFF')
    return o
  },
  noche() {
    const r = rng(13)
    let o = ''
    for (let i = 0; i < 200; i++) {
      const a = r() * Math.PI * 2
      const e = 0.12 + r() * 1.35
      o += `<a-sphere radius="${f(0.05 + r() * 0.12)}" position="${f(Math.cos(a) * Math.cos(e) * 62)} ${f(Math.sin(e) * 62)} ${f(Math.sin(a) * Math.cos(e) * 62)}" material="shader: flat; color: #F4F9FC" ${i % 6 === 0 ? `animation="property: scale; to: 0.3 0.3 0.3; dir: alternate; loop: true; dur: ${1200 + i * 9}"` : ''} ${HIDE}></a-sphere>`
    }
    o += `<a-circle radius="2.2" position="-12 16 -42" material="shader: flat; color: #F2F5FA" ${HIDE}></a-circle><a-circle radius="3.6" position="-12 16 -42.1" material="shader: flat; color: #9FC3FF; opacity: 0.18; transparent: true" ${HIDE}></a-circle>`
    // Aurora
    ;['#4CF2B3', '#5BC0FF', '#B48CFF'].forEach((c, i) => {
      o += `<a-plane position="${-6 + i * 7} ${16 + i} -48" width="26" height="9" rotation="0 ${-12 + i * 12} ${-6 + i * 4}" material="shader: flat; color: ${c}; opacity: 0.18; transparent: true; side: double" animation="property: material.opacity; from: 0.06; to: 0.3; dir: alternate; loop: true; dur: ${5000 + i * 1300}; easing: easeInOutSine" ${HIDE}></a-plane>`
    })
    // Fogata
    o += `<a-entity position="2.2 0 -2.2" ${HIDE}>
      <a-entity light="type: point; color: #FF9A4D; intensity: 1.4; distance: 12" position="0 0.8 0" animation="property: light.intensity; from: 1; to: 1.7; dir: alternate; loop: true; dur: 260"></a-entity>
      <a-cylinder radius="0.07" height="1" rotation="0 0 80" position="0 0.1 0" color="#5A3B26"></a-cylinder><a-cylinder radius="0.07" height="1" rotation="80 0 0" position="0 0.1 0" color="#5A3B26"></a-cylinder>
      <a-cone radius-bottom="0.3" radius-top="0" height="0.8" position="0 0.5 0" material="shader: flat; color: #FF7A2F; opacity: 0.9; transparent: true" animation="property: scale; to: 1.1 1.35 1.1; dir: alternate; loop: true; dur: 300"></a-cone>
      <a-cone radius-bottom="0.18" radius-top="0" height="0.55" position="0 0.45 0" material="shader: flat; color: #FFD166" animation="property: scale; to: 0.9 1.4 0.9; dir: alternate; loop: true; dur: 220"></a-cone></a-entity>`
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; o += rock(2.2 + Math.cos(a) * 0.55, -2.2 + Math.sin(a) * 0.55, 0.12, '#6B7680') }
    o += `<a-entity position="-4 0 -4" rotation="0 30 0" ${HIDE}><a-cone radius-bottom="1.3" radius-top="0" height="1.6" segments-radial="4" position="0 0.8 0" color="#2F5D7C"></a-cone></a-entity>`
    for (let i = 0; i < 50; i++) { const [x, z] = ring(r, 8, 32); if (clearPath(x, z)) o += pine(x, z, 2.5 + r() * 3, 0.9 + r() * 0.6, '#16362B', '#1E4535') }
    for (let i = 0; i < 26; i++) { const [x, z] = ring(r, 2.5, 12); o += glow(x, 0.5 + r() * 1.8, z, '#E8F59A', 0.04, i, 2400 + r() * 2200) }
    return o
  },
  montana() {
    const r = rng(17)
    let o = ''
    const peaks = [[-28, -48, 18, 14], [-8, -58, 24, 18], [14, -52, 20, 15], [32, -40, 16, 12], [-40, -24, 14, 10], [40, -18, 13, 10], [-36, 10, 12, 9], [34, 20, 14, 10]]
    peaks.forEach(([x, z, h, rad]) => {
      o += `<a-entity position="${x} 0 ${z}" ${HIDE}><a-cone radius-bottom="${rad}" radius-top="0" height="${h}" position="0 ${h / 2} 0" color="#7C8A96" segments-radial="7"></a-cone><a-cone radius-bottom="${f(rad * 0.32)}" radius-top="0" height="${f(h * 0.32)}" position="0 ${f(h - h * 0.16)} 0" color="#F4F9FC" segments-radial="7"></a-cone></a-entity>`
    })
    o += `<a-entity position="0 0.06 -17" water-surface="radius: 9; seg: 96; amp: 0.03; speed: 0.8; deep: #0F3F5C; shallow: #3C92BF; skyTop: #5DA9E9; skyHorizon: #EAF4FB; foam: 0.15" ${HIDE}></a-entity>`
    for (let i = 0; i < 70; i++) { const [x, z] = ring(r, 6, 34); if (clearPath(x, z) && Math.hypot(x, z + 17) > 10) o += pine(x, z, 2.4 + r() * 3.5, 0.8 + r() * 0.6, '#2C5E46', '#3A7357') }
    for (let i = 0; i < 16; i++) { const [x, z] = ring(r, 3, 20); if (clearPath(x, z)) o += rock(x, z, 0.3 + r() * 0.8, '#9AA5AE') }
    o += cloud(-14, 15, -30, 2, 60000) + cloud(10, 18, -38, 2.4, 70000) + cloud(-4, 20, -50, 2.8, 80000)
    o += bird(0, 14, -24, 14, 34000) + bird(-6, 16, -30, 10, 30000)
    return o
  },
  fogata() {
    const r = rng(43)
    const FX = -3.8
    const FZ = -5.2
    let o = ''
    for (let i = 0; i < 220; i++) {
      const a = r() * Math.PI * 2
      const e = 0.15 + r() * 1.3
      o += `<a-sphere radius="${f(0.05 + r() * 0.12)}" position="${f(Math.cos(a) * Math.cos(e) * 64)} ${f(Math.sin(e) * 64)} ${f(Math.sin(a) * Math.cos(e) * 64)}" material="shader: flat; color: #F4F9FC" ${i % 7 === 0 ? `animation="property: scale; to: 0.3 0.3 0.3; dir: alternate; loop: true; dur: ${1100 + i * 7}"` : ''} ${HIDE}></a-sphere>`
    }
    o += `<a-circle radius="1.8" position="14 18 -44" material="shader: flat; color: #F2F5FA" ${HIDE}></a-circle>`
    // Fogata: anillo de piedras, leños cruzados, brasas, fuego con partículas y luz cálida
    o += `<a-entity position="${FX} 0 ${FZ}" ${HIDE}>
      <a-circle radius="2.4" rotation="-90 0 0" position="0 0.02 0" material="shader: flat; color: #FF8A3D; opacity: 0.12; transparent: true" animation="property: material.opacity; from: 0.08; to: 0.18; dir: alternate; loop: true; dur: 380"></a-circle>
      <a-circle radius="0.55" rotation="-90 0 0" position="0 0.03 0" material="color: #1A1410; roughness: 1"></a-circle>`
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      o += `<a-dodecahedron radius="${f(0.13 + r() * 0.05)}" position="${f(Math.cos(a) * 0.68)} 0.08 ${f(Math.sin(a) * 0.68)}" scale="1.2 0.75 1" rotation="${f(r() * 90)} ${f(r() * 180)} 0" ${mat('stone', { color: '#D9D2C8' })}></a-dodecahedron>`
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      o += `<a-cylinder radius="0.07" height="0.9" position="${f(Math.cos(a) * 0.16)} 0.22 ${f(Math.sin(a) * 0.16)}" rotation="${f(Math.sin(a) * 62)} 0 ${f(-Math.cos(a) * 62)}" ${mat('bark', { color: '#C9B49A' })}></a-cylinder>`
    }
    for (let i = 0; i < 14; i++) o += `<a-sphere radius="${f(0.04 + r() * 0.04)}" position="${f((r() - 0.5) * 0.6)} 0.05 ${f((r() - 0.5) * 0.6)}" material="color: #FF5A1F; emissive: #FF3D00; emissiveIntensity: 1.2" animation="property: material.emissiveIntensity; from: 0.5; to: 1.6; dir: alternate; loop: true; dur: ${Math.round(300 + r() * 500)}"></a-sphere>`
    o += `<a-entity position="0 0.12 0" fire="scale: 1.1; flames: 170; sparks: 50; smoke: 34"></a-entity></a-entity>`
    // Troncos para sentarse alrededor
    ;[[0.6, 2.4], [2.1, 1.0], [-1.3, 0.5]].forEach(([dx, dz], i) => {
      const x = FX + dx * (i === 2 ? -1 : 1)
      const z = FZ + dz * (i === 0 ? -1 : 1)
      const yaw = Math.atan2(FX - x, FZ - z) * 57.3 + 90
      o += `<a-cylinder radius="0.22" height="1.6" position="${f(x)} 0.2 ${f(z)}" rotation="0 ${f(yaw)} 90" ${mat('bark', { repeat: 2, color: '#D8C3A5' })} ${HIDE}></a-cylinder>`
    })
    // Carpa, farol y mochila
    o += `<a-entity position="4.2 0 -4.6" rotation="0 -35 0" ${HIDE}><a-cone radius-bottom="1.5" radius-top="0" height="1.9" segments-radial="4" position="0 0.95 0" material="color: #2E6A8C; roughness: 0.8; side: double"></a-cone><a-triangle vertex-a="0 1.6 1.07" vertex-b="-0.45 0 1.07" vertex-c="0.45 0 1.07" material="color: #F2B56B; emissive: #FF9A3D; emissiveIntensity: 0.35"></a-triangle></a-entity>`
    o += `<a-entity position="2.6 0 -2.1" ${HIDE}><a-cylinder radius="0.09" height="0.04" position="0 0.02 0" color="#2B2B2B"></a-cylinder><a-cylinder radius="0.07" height="0.22" position="0 0.15 0" material="color: #FFE2A8; emissive: #FFB347; emissiveIntensity: 1; opacity: 0.85; transparent: true"></a-cylinder><a-entity light="type: point; color: #FFC071; intensity: 0.6; distance: 4" position="0 0.3 0"></a-entity></a-entity>`
    for (let i = 0; i < 70; i++) { const [x, z] = ring(r, 9, 34); if (clearPath(x, z)) o += pine(x, z, 2.6 + r() * 3.5, 0.9 + r() * 0.6, '#14301F', '#1C3D29') }
    for (let i = 0; i < 12; i++) { const [x, z] = ring(r, 4, 9); if (clearPath(x, z)) o += rock(x, z, 0.2 + r() * 0.4, '#9A9A9A') }
    for (let i = 0; i < 30; i++) { const [x, z] = ring(r, 3, 14); o += glow(x, 0.5 + r() * 1.8, z, '#E8F59A', 0.035, i, 2400 + r() * 2200) }
    return o
  },
  espacio() {
    const r = rng(23)
    let o = `<a-cylinder radius="2.6" height="0.25" position="0 -0.12 -0.8" material="color: #1E2A4A; metalness: 0.6; roughness: 0.3"></a-cylinder><a-torus radius="2.6" radius-tubular="0.03" rotation="90 0 0" position="0 0.02 -0.8" material="shader: flat; color: #7CC0F8" animation="property: material.opacity; from: 0.4; to: 1; dir: alternate; loop: true; dur: 2000"></a-torus>`
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2
      const e = (r() - 0.5) * Math.PI
      o += `<a-sphere radius="${f(0.05 + r() * 0.14)}" position="${f(Math.cos(a) * Math.cos(e) * 70)} ${f(Math.sin(e) * 70)} ${f(Math.sin(a) * Math.cos(e) * 70)}" material="shader: flat; color: ${r() > 0.85 ? '#C8B6FF' : '#F4F9FC'}" ${HIDE}></a-sphere>`
    }
    o += `<a-entity position="-14 9 -32" animation="property: rotation; to: 0 360 0; loop: true; dur: 90000; easing: linear" ${HIDE}><a-sphere radius="5" color="#D9A066"></a-sphere><a-torus radius="8" radius-tubular="0.6" rotation="78 0 0" scale="1 1 0.08" material="color: #E8C9A0; opacity: 0.8; transparent: true"></a-torus></a-entity>`
    o += `<a-sphere radius="3" position="18 14 -38" color="#5B8DEF" animation="property: rotation; to: 0 360 0; loop: true; dur: 60000; easing: linear" ${HIDE}></a-sphere><a-sphere radius="0.8" position="22 16 -34" color="#C9D6DF" ${HIDE}></a-sphere>`
    o += `<a-sphere radius="1.6" position="8 -4 -24" color="#E07A5F" ${HIDE}></a-sphere>`
    ;[['#7B5CFF', -20, 2, -50, 14], ['#2FB3FF', 22, -6, -46, 12], ['#FF6FB5', 0, 22, -55, 10]].forEach(([c, x, y, z, rad]) => {
      o += `<a-sphere radius="${rad}" position="${x} ${y} ${z}" material="shader: flat; color: ${c}; opacity: 0.12; transparent: true" animation="property: material.opacity; from: 0.06; to: 0.18; dir: alternate; loop: true; dur: 6000" ${HIDE}></a-sphere>`
    })
    for (let i = 0; i < 18; i++) {
      const [x, z] = ring(r, 6, 20)
      const y = -3 + r() * 9
      o += `<a-dodecahedron radius="${f(0.2 + r() * 0.7)}" position="${f(x)} ${f(y)} ${f(z)}" color="#6E6A75" animation="property: rotation; to: ${f(r() * 360)} 360 ${f(r() * 180)}; loop: true; dur: ${Math.round(20000 + r() * 30000)}; easing: linear" animation__f="property: position; to: ${f(x)} ${f(y + 0.8)} ${f(z)}; dir: alternate; loop: true; dur: ${Math.round(4000 + r() * 4000)}; easing: easeInOutSine" ${HIDE}></a-dodecahedron>`
    }
    return o
  },
  jardin() {
    const r = rng(29)
    let o = ''
    for (let i = 0; i < 26; i++) o += `<a-ring rotation="-90 0 0" position="-6 0.02 -9" radius-inner="${f(1.2 + i * 0.35)}" radius-outer="${f(1.26 + i * 0.35)}" material="shader: flat; color: #D8CDB4" ${HIDE}></a-ring>`
    o += rock(-6, -9, 0.9, '#7D8488') + rock(-4.6, -8.2, 0.5, '#8E959A')
    o += `<a-entity position="6.5 0.06 -8" water-surface="radius: 4; seg: 64; amp: 0.015; speed: 0.6; deep: #1D4D63; shallow: #4F9DB8; skyTop: #F7C6D9; skyHorizon: #FDF1F5; foam: 0.1" ${HIDE}></a-entity>`
    ;['#FF8C42', '#FFFFFF', '#F25F5C'].forEach((c, i) => {
      o += `<a-entity position="6.5 0.12 -8" animation="property: rotation; to: 0 ${i % 2 ? -360 : 360} 0; loop: true; dur: ${14000 + i * 4000}; easing: linear" ${HIDE}><a-sphere radius="0.18" position="${f(1.4 + i * 0.7)} 0 0" scale="2.2 0.6 0.9" color="${c}"></a-sphere></a-entity>`
    })
    const sakura = [[-9, -2], [9, -1], [-11, -14], [12, -15], [0, -20], [-14, 4], [14, 5]]
    sakura.forEach(([x, z]) => {
      let blossoms = ''
      for (let k = 0; k < 6; k++) blossoms += `<a-sphere radius="${f(0.7 + r() * 0.5)}" position="${f(r() * 2 - 1)} ${f(2.4 + r() * 1.2)} ${f(r() * 2 - 1)}" color="${k % 2 ? '#F7B7CC' : '#F9CADA'}"></a-sphere>`
      o += `<a-entity position="${x} 0 ${z}" ${HIDE}><a-cylinder radius="0.18" height="2.6" position="0 1.3 0" rotation="0 0 6" ${mat('bark', { repeat: 1 })}></a-cylinder>${blossoms}</a-entity>`
      for (let k = 0; k < 6; k++) {
        const px = x + r() * 3 - 1.5
        const pz = z + r() * 3 - 1.5
        o += `<a-plane width="0.08" height="0.08" position="${f(px)} 3.2 ${f(pz)}" material="shader: flat; color: #F7B7CC; side: double" animation="property: position; to: ${f(px + 1.2)} 0.02 ${f(pz + 0.8)}; loop: true; dur: ${Math.round(6000 + r() * 5000)}; easing: linear; delay: ${k * 700}" animation__s="property: rotation; to: 360 180 90; loop: true; dur: 3000; easing: linear" ${HIDE}></a-plane>`
      }
    })
    ;[[-3.5, -4], [3.5, -4], [-5, 2], [5, 2]].forEach(([x, z]) => {
      o += `<a-entity position="${x} 0 ${z}" ${HIDE}><a-box width="0.5" height="0.15" depth="0.5" position="0 0.08 0" color="#8E959A"></a-box><a-cylinder radius="0.1" height="0.7" position="0 0.5 0" color="#8E959A"></a-cylinder><a-box width="0.42" height="0.36" depth="0.42" position="0 1.02 0" material="color: #FFE2A8; emissive: #FFB347; emissiveIntensity: 0.7"></a-box><a-cone radius-bottom="0.45" radius-top="0.05" height="0.3" position="0 1.35 0" color="#7D8488" segments-radial="4"></a-cone></a-entity>`
    })
    for (let i = 0; i < 24; i++) {
      const x = -16 + i * 1.4
      o += `<a-cylinder radius="0.08" height="${f(4 + r() * 3)}" position="${f(x)} 2.5 -26" color="${i % 2 ? '#7FB069' : '#6A9C5A'}" animation="property: rotation; to: ${f(r() * 4 - 2)} 0 ${f(r() * 4 - 2)}; dir: alternate; loop: true; dur: ${Math.round(2000 + r() * 2000)}" ${HIDE}></a-cylinder>`
    }
    o += `<a-entity position="0 0 -15" ${HIDE}><a-box width="0.3" height="4" depth="0.3" position="-2 2 0" color="#C0392B"></a-box><a-box width="0.3" height="4" depth="0.3" position="2 2 0" color="#C0392B"></a-box><a-box width="5.4" height="0.3" depth="0.4" position="0 4.1 0" color="#C0392B"></a-box><a-box width="5" height="0.22" depth="0.3" position="0 3.4 0" color="#C0392B"></a-box></a-entity>`
    return o
  }
}

export function buildWorld(kind) {
  TER = WORLDS[kind].terrain ? { ...WORLDS[kind].terrain, world: kind } : null
  WORLD = kind
  return BUILDERS[kind]()
}

// Anillo de partículas que acompaña a la esfera de respiración (común a todos los mundos)
export function breathParticles() {
  let o = '<a-entity position="0 1.6 -3.2" animation="property: rotation; to: 0 0 360; loop: true; dur: 24000; easing: linear">'
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    o += `<a-sphere radius="0.035" position="${f(Math.cos(a) * 1.05)} ${f(Math.sin(a) * 1.05)} 0" material="shader: flat; color: #CFE8FF; opacity: 0.8; transparent: true" animation="property: material.opacity; from: 0.2; to: 0.9; dir: alternate; loop: true; dur: 2000; delay: ${i * 125}"></a-sphere>`
  }
  return o + '</a-entity>'
}

export function terrainAttr(w, kind) {
  if (!w.terrain) return ''
  return Object.entries({ ...w.terrain, world: kind || '' }).map(([k, v]) => `${k}: ${v}`).join('; ')
}

export function envAttr(w) {
  return `top: ${w.sky[0]}; horizon: ${w.sky[1]}; ground: ${w.terrain?.low || '#000000'}; exposure: ${w.label === 'Fogata' || w.label === 'Noche' ? 1.3 : 1.12}`
}

// Mini santuario para realidad aumentada: piedra, musgo, bonsái, cuenco de agua, vela y la esfera de respiración
export function arSanctuary(id = 'ar-sanctuary', extra = '') {
  let pebbles = ''
  const r = rng(91)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3
    pebbles += `<a-dodecahedron radius="${f(0.03 + r() * 0.03)}" position="${f(Math.cos(a) * 0.62)} 0.03 ${f(Math.sin(a) * 0.62)}" scale="1 0.55 1" ${mat('stone', { color: '#E8E8E8' })}></a-dodecahedron>`
  }
  return `<a-entity id="${id}" ${extra}>
    <a-cylinder radius="0.55" height="0.1" position="0 0.05 0" segments-radial="48" ${mat('stone', { repeat: 2, rough: 0.85 })} shadow="receive: true"></a-cylinder>
    <a-cylinder radius="0.5" height="0.02" position="0 0.11 0" segments-radial="48" ${mat('sand', { repeat: 2, rough: 1 })}></a-cylinder>
    ${pebbles}
    <a-sphere radius="0.12" position="-0.28 0.12 0.12" scale="1.3 0.35 1" ${mat('moss', { repeat: 1 })}></a-sphere>
    <a-sphere radius="0.09" position="0.3 0.12 0.22" scale="1.4 0.3 1" ${mat('moss', { repeat: 1 })}></a-sphere>
    <a-entity position="0.24 0.12 -0.18">
      <a-cylinder radius="0.025" radius-top="0.018" height="0.22" position="0 0.11 0" rotation="0 0 -10" ${mat('bark')}></a-cylinder>
      <a-cylinder radius="0.016" height="0.14" position="0.05 0.22 0" rotation="0 0 -55" ${mat('bark')}></a-cylinder>
      <a-sphere radius="0.09" position="0.12 0.27 0" scale="1.2 0.7 1" ${mat('moss', { color: '#9BCB6B' })}></a-sphere>
      <a-sphere radius="0.08" position="-0.02 0.3 0.02" scale="1.1 0.7 1" ${mat('moss', { color: '#9BCB6B' })}></a-sphere>
    </a-entity>
    <a-entity position="-0.22 0.12 -0.2">
      <a-cylinder radius="0.11" height="0.05" position="0 0.025 0" segments-radial="32" ${mat('stone', { color: '#B9B2A6', rough: 0.6 })}></a-cylinder>
      <a-entity position="0 0.05 0" water-surface="radius: 0.095; seg: 32; amp: 0.003; speed: 1.2; flow: 0.3 0.2; deep: #164B68; shallow: #59B8DE; skyTop: #BFD9EA; skyHorizon: #F2F7FA; opacity: 0.92; foam: 0"></a-entity>
    </a-entity>
    <a-entity position="-0.05 0.12 0.28">
      <a-cylinder radius="0.035" height="0.12" position="0 0.06 0" ${mat('wax', { rough: 0.5 })}></a-cylinder>
      <a-cone radius-bottom="0.012" radius-top="0" height="0.05" position="0 0.145 0" material="shader: flat; color: #FFC96B" animation="property: scale; to: 0.85 1.3 0.85; dir: alternate; loop: true; dur: 240"></a-cone>
      <a-entity light="type: point; color: #FFB561; intensity: 0.7; distance: 1.6" position="0 0.2 0" animation="property: light.intensity; from: 0.5; to: 0.85; dir: alternate; loop: true; dur: 260"></a-entity>
    </a-entity>
    <a-entity id="${id}-orb" position="0 0.5 0" scale="0.7 0.7 0.7">
      <a-sphere radius="0.16" material="color: #BFE3FF; metalness: 0.1; roughness: 0.05; opacity: 0.55; transparent: true; emissive: #2F86D6; emissiveIntensity: 0.35"></a-sphere>
      <a-sphere radius="0.07" material="shader: flat; color: #E8F5FF; opacity: 0.9; transparent: true"></a-sphere>
    </a-entity>
  </a-entity>`
}

// Fogata para realidad aumentada (sobre la cámara o sobre una superficie real)
export function arFogata(id = 'ar-fogata', extra = '') {
  const r = rng(77)
  let o = `<a-entity id="${id}" ${extra}>
    <a-circle radius="0.5" rotation="-90 0 0" position="0 0.005 0" material="shader: flat; color: #FF8A3D; opacity: 0.18; transparent: true" animation="property: material.opacity; from: 0.1; to: 0.24; dir: alternate; loop: true; dur: 360"></a-circle>
    <a-circle radius="0.2" rotation="-90 0 0" position="0 0.01 0" material="color: #1A1410; roughness: 1"></a-circle>`
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2
    o += `<a-dodecahedron radius="${f(0.05 + r() * 0.02)}" position="${f(Math.cos(a) * 0.27)} 0.03 ${f(Math.sin(a) * 0.27)}" scale="1.2 0.75 1" rotation="${f(r() * 90)} ${f(r() * 180)} 0" ${mat('stone', { color: '#E2DBD0' })}></a-dodecahedron>`
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    o += `<a-cylinder radius="0.028" height="0.36" position="${f(Math.cos(a) * 0.06)} 0.09 ${f(Math.sin(a) * 0.06)}" rotation="${f(Math.sin(a) * 62)} 0 ${f(-Math.cos(a) * 62)}" ${mat('bark', { color: '#C9B49A' })}></a-cylinder>`
  }
  for (let i = 0; i < 10; i++) o += `<a-sphere radius="${f(0.015 + r() * 0.015)}" position="${f((r() - 0.5) * 0.22)} 0.02 ${f((r() - 0.5) * 0.22)}" material="color: #FF5A1F; emissive: #FF3D00; emissiveIntensity: 1.2" animation="property: material.emissiveIntensity; from: 0.5; to: 1.6; dir: alternate; loop: true; dur: ${Math.round(300 + r() * 500)}"></a-sphere>`
  o += `<a-entity position="0 0.05 0" fire="scale: 0.42; flames: 120; sparks: 30; smoke: 20"></a-entity>
    <a-entity id="${id}-orb" position="0.55 0.45 0.1" scale="0.7 0.7 0.7">
      <a-sphere radius="0.13" material="color: #FFD9A8; metalness: 0.1; roughness: 0.05; opacity: 0.5; transparent: true; emissive: #FF9A3D; emissiveIntensity: 0.4"></a-sphere>
    </a-entity>
  </a-entity>`
  return o
}

// Wayra, la viscacha andina: cuerpo redondeado, orejas largas, cola enroscada y bigotes.
// Respira (escala suave), mueve las orejas y, cuando habla, mueve la cabeza.
export function viscachaHTML(id = 'wayra', extra = '') {
  const fur = 'color: #A08C78; roughness: 0.95'
  const light = 'color: #D8CBB8; roughness: 0.95'
  const dark = 'color: #3A2E26; roughness: 0.9'
  return `<a-entity id="${id}" ${extra}>
    <a-dodecahedron radius="0.35" position="0 0.17 0" scale="1.4 0.5 1.2" ${mat('stone', { color: '#CFC8BE' })}></a-dodecahedron>
    <a-entity class="wayra-body" position="0 0.33 0" animation="property: scale; from: 1 1 1; to: 1.04 1.05 1.04; dir: alternate; loop: true; dur: 1800; easing: easeInOutSine">
      <a-sphere radius="0.16" scale="1 1.15 1.05" position="0 0.13 0" material="${fur}"></a-sphere>
      <a-sphere radius="0.11" scale="0.9 1.1 0.6" position="0 0.11 -0.09" material="${light}"></a-sphere>
      <a-sphere radius="0.06" position="-0.1 0.0 -0.05" scale="1 0.7 1.3" material="${fur}"></a-sphere>
      <a-sphere radius="0.06" position="0.1 0.0 -0.05" scale="1 0.7 1.3" material="${fur}"></a-sphere>
      <a-sphere radius="0.035" position="-0.06 0.12 -0.15" material="${light}"></a-sphere>
      <a-sphere radius="0.035" position="0.06 0.12 -0.15" material="${light}"></a-sphere>
      <a-entity position="0 0.05 0.15" rotation="-20 0 0">
        <a-cylinder radius="0.03" height="0.22" position="0 0.1 0.04" rotation="30 0 0" material="${fur}"></a-cylinder>
        <a-sphere radius="0.075" position="0 0.24 0.12" scale="1 1 1.3" material="color: #4A3A2E; roughness: 1" animation="property: rotation; from: -6 0 0; to: 8 0 0; dir: alternate; loop: true; dur: 2600; easing: easeInOutSine"></a-sphere>
      </a-entity>
      <a-entity class="wayra-head" position="0 0.34 -0.03" animation="property: rotation; from: 0 -6 0; to: 0 6 0; dir: alternate; loop: true; dur: 3200; easing: easeInOutSine">
        <a-sphere radius="0.12" scale="1 0.95 1.1" material="${fur}"></a-sphere>
        <a-sphere radius="0.06" position="0 -0.03 -0.1" scale="1.1 0.8 1" material="${light}"></a-sphere>
        <a-sphere radius="0.018" position="0 -0.005 -0.158" material="${dark}"></a-sphere>
        <a-sphere radius="0.026" position="-0.055 0.03 -0.095" material="color: #111111; roughness: 0.15; metalness: 0.2"></a-sphere>
        <a-sphere radius="0.026" position="0.055 0.03 -0.095" material="color: #111111; roughness: 0.15; metalness: 0.2"></a-sphere>
        <a-sphere radius="0.007" position="-0.048 0.04 -0.118" material="shader: flat; color: #FFFFFF"></a-sphere>
        <a-sphere radius="0.007" position="0.062 0.04 -0.118" material="shader: flat; color: #FFFFFF"></a-sphere>
        <a-entity class="wayra-mouth" position="0 -0.05 -0.13"><a-torus radius="0.018" radius-tubular="0.004" arc="180" rotation="0 0 180" material="${dark}"></a-torus></a-entity>
        <a-cylinder radius="0.002" height="0.16" position="-0.07 -0.03 -0.14" rotation="0 20 80" material="color: #F2F2F2"></a-cylinder>
        <a-cylinder radius="0.002" height="0.16" position="0.07 -0.03 -0.14" rotation="0 -20 -80" material="color: #F2F2F2"></a-cylinder>
        <a-cylinder radius="0.002" height="0.15" position="-0.07 -0.045 -0.14" rotation="0 20 95" material="color: #F2F2F2"></a-cylinder>
        <a-cylinder radius="0.002" height="0.15" position="0.07 -0.045 -0.14" rotation="0 -20 -95" material="color: #F2F2F2"></a-cylinder>
        <a-entity position="-0.06 0.11 0.01" rotation="0 0 14" animation="property: rotation; from: 0 0 10; to: 0 0 22; dir: alternate; loop: true; dur: 2100; easing: easeInOutSine">
          <a-sphere radius="0.04" scale="0.55 2.4 0.35" position="0 0.07 0" material="${fur}"></a-sphere>
          <a-sphere radius="0.03" scale="0.5 2.2 0.2" position="0 0.07 -0.008" material="color: #D9A99A; roughness: 0.9"></a-sphere>
        </a-entity>
        <a-entity position="0.06 0.11 0.01" rotation="0 0 -14" animation="property: rotation; from: 0 0 -10; to: 0 0 -22; dir: alternate; loop: true; dur: 2500; easing: easeInOutSine">
          <a-sphere radius="0.04" scale="0.55 2.4 0.35" position="0 0.07 0" material="${fur}"></a-sphere>
          <a-sphere radius="0.03" scale="0.5 2.2 0.2" position="0 0.07 -0.008" material="color: #D9A99A; roughness: 0.9"></a-sphere>
        </a-entity>
      </a-entity>
    </a-entity>
    <a-text class="wayra-bubble" value="" align="center" width="1.6" color="#FFFFFF" position="0 1.05 0" wrap-count="34"></a-text>
  </a-entity>`
}
