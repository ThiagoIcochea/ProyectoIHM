// Mundos del Santuario de calma (A-Frame). Todo se genera con primitivas: no hay modelos ni texturas externas.
// Cada mundo combina cielo en degradado, suelo, vegetación o paisaje, partículas animadas y luz propia.

export const WORLDS = {
  bosque: {
    label: 'Bosque', sound: 'bosque', text: '#0E293D', desc: 'Pinos, un arroyo y luciérnagas entre los árboles.',
    sky: ['#7FC4EC', '#E4F3FA'], ground: '#4F8A5F', fog: '#CFE8F2', ambient: 0.85, sun: 0.75, sunColor: '#FFF4DC'
  },
  playa: {
    label: 'Playa', sound: 'olas', text: '#0E293D', desc: 'Atardecer, palmeras y olas que van y vienen.',
    sky: ['#F59E7B', '#FCE6C8'], ground: '#E8D2A2', fog: '#F6E3CF', ambient: 0.9, sun: 0.8, sunColor: '#FFD7A8'
  },
  noche: {
    label: 'Noche', sound: 'lluvia', text: '#E7F1F8', desc: 'Una fogata tranquila bajo la aurora y las estrellas.',
    sky: ['#050B18', '#1B3552'], ground: '#13283B', fog: '#0B1A2A', ambient: 0.45, sun: 0.25, sunColor: '#9FC3FF'
  },
  montana: {
    label: 'Montaña', sound: 'bosque', text: '#0E293D', desc: 'Un lago entre montañas nevadas y nubes lentas.',
    sky: ['#5DA9E9', '#EAF4FB'], ground: '#6E8F63', fog: '#DCEBF5', ambient: 0.9, sun: 0.8, sunColor: '#FFFFFF'
  },
  espacio: {
    label: 'Espacio', sound: 'olas', text: '#E7F1F8', desc: 'Flotas sobre una plataforma entre planetas y nebulosas.',
    sky: ['#02030A', '#1A1040'], ground: null, fog: null, ambient: 0.6, sun: 0.5, sunColor: '#C8B6FF'
  },
  jardin: {
    label: 'Jardín zen', sound: 'lluvia', text: '#0E293D', desc: 'Cerezos, faroles de piedra y un estanque con peces koi.',
    sky: ['#F7C6D9', '#FDF1F5'], ground: '#E9E1CF', fog: '#F6E8EE', ambient: 0.95, sun: 0.6, sunColor: '#FFE9F1'
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
const clearPath = (x, z) => !(Math.abs(x) < 3 && z < 0 && z > -7)

const HIDE = 'hide-on-enter-ar'

function pine(x, z, h, r, c1 = '#2F6B4F', c2 = '#3E8462') {
  return `<a-entity position="${f(x)} 0 ${f(z)}" ${HIDE}><a-cylinder radius="0.13" height="1" position="0 0.5 0" color="#6B4F3A"></a-cylinder><a-cone radius-bottom="${f(r)}" radius-top="0" height="${f(h)}" position="0 ${f(0.8 + h / 2)} 0" color="${c1}"></a-cone><a-cone radius-bottom="${f(r * 0.72)}" radius-top="0" height="${f(h * 0.7)}" position="0 ${f(0.8 + h * 0.75)} 0" color="${c2}"></a-cone></a-entity>`
}
function roundTree(x, z, s, leaf = '#5AA469') {
  return `<a-entity position="${f(x)} 0 ${f(z)}" scale="${f(s)} ${f(s)} ${f(s)}" ${HIDE}><a-cylinder radius="0.14" height="1.4" position="0 0.7 0" color="#7A5A40"></a-cylinder><a-sphere radius="0.9" position="0 2 0" color="${leaf}"></a-sphere><a-sphere radius="0.65" position="0.5 1.7 0.2" color="${leaf}"></a-sphere><a-sphere radius="0.6" position="-0.45 1.75 -0.2" color="${leaf}"></a-sphere></a-entity>`
}
function rock(x, z, s, c = '#8C969E') {
  return `<a-dodecahedron radius="${f(s)}" position="${f(x)} ${f(s * 0.35)} ${f(z)}" rotation="${f(s * 40)} ${f(s * 90)} 0" color="${c}" ${HIDE}></a-dodecahedron>`
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
      o += `<a-entity position="${f(x)} 0 ${f(z)}" ${HIDE}><a-cylinder radius="0.015" height="0.3" position="0 0.15 0" color="#3E7A4E"></a-cylinder><a-sphere radius="0.07" position="0 0.32 0" color="${c}"></a-sphere></a-entity>`
    }
    // Arroyo
    o += `<a-plane rotation="-90 0 25" position="7 0.03 -6" width="2.4" height="60" material="color: #6FB7E8; opacity: 0.85; transparent: true; metalness: 0.2; roughness: 0.1" animation="property: material.opacity; from: 0.7; to: 0.95; dir: alternate; loop: true; dur: 2500" ${HIDE}></a-plane>`
    for (let i = 0; i < 24; i++) { const [x, z] = ring(r, 3, 14); o += glow(x, 0.6 + r() * 1.6, z, '#F8F3A6', 0.04, i, 2600 + r() * 2000) }
    o += cloud(-12, 16, -30, 1.4, 40000) + cloud(8, 18, -36, 1.8, 52000) + cloud(-20, 14, 10, 1.2, 46000)
    o += bird(0, 9, -12, 8, 22000) + bird(4, 11, -16, 10, 28000)
    return o
  },
  playa() {
    const r = rng(11)
    let o = `<a-plane id="sea" rotation="-90 0 0" position="0 0.05 -26" width="160" height="34" material="color: #3D8FD6; opacity: 0.92; transparent: true; metalness: 0.3; roughness: 0.2" animation="property: position; to: 0 0.2 -25; dir: alternate; loop: true; dur: 3200; easing: easeInOutSine" ${HIDE}></a-plane>`
    for (let i = 0; i < 4; i++) o += `<a-plane rotation="-90 0 0" position="0 0.08 ${-9.5 - i * 0.6}" width="140" height="0.25" material="shader: flat; color: #FFFFFF; opacity: 0.7; transparent: true" animation="property: position; to: 0 0.08 ${-8.2 - i * 0.6}; dir: alternate; loop: true; dur: ${3200 + i * 300}; easing: easeInOutSine" ${HIDE}></a-plane>`
    o += `<a-circle radius="3.2" position="14 7 -55" material="shader: flat; color: #FFD27A" ${HIDE}></a-circle><a-circle radius="5" position="14 7 -55.1" material="shader: flat; color: #FFB86B; opacity: 0.35; transparent: true" ${HIDE}></a-circle>`
    const palms = [[-6, -5], [-8, 2], [7, -4], [9, 3], [-12, -9], [12, -10], [-4, 7], [5, 8]]
    palms.forEach(([x, z], i) => {
      const lean = (i % 2 ? 1 : -1) * (6 + r() * 6)
      let leaves = ''
      for (let k = 0; k < 7; k++) leaves += `<a-cone radius-bottom="0.35" radius-top="0.02" height="2.4" position="0 0 0" rotation="${f(60 + r() * 20)} ${k * 51} 0" color="${k % 2 ? '#3E9B5E' : '#2F8550'}"></a-cone>`
      o += `<a-entity position="${x} 0 ${z}" rotation="0 0 ${f(lean)}" ${HIDE}><a-cylinder radius="0.16" radius-top="0.1" height="4.6" position="0 2.3 0" color="#8B6B47"></a-cylinder><a-entity position="0 4.6 0" animation="property: rotation; to: 0 0 4; dir: alternate; loop: true; dur: 2800; easing: easeInOutSine">${leaves}<a-sphere radius="0.18" position="0.2 -0.2 0" color="#6B4F2E"></a-sphere></a-entity></a-entity>`
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
    o += `<a-circle rotation="-90 0 0" radius="9" position="0 0.04 -17" material="color: #4E9ED9; opacity: 0.9; transparent: true; metalness: 0.4; roughness: 0.1" animation="property: material.opacity; from: 0.8; to: 0.95; dir: alternate; loop: true; dur: 3000" ${HIDE}></a-circle>`
    for (let i = 0; i < 70; i++) { const [x, z] = ring(r, 6, 34); if (clearPath(x, z) && Math.hypot(x, z + 17) > 10) o += pine(x, z, 2.4 + r() * 3.5, 0.8 + r() * 0.6, '#2C5E46', '#3A7357') }
    for (let i = 0; i < 16; i++) { const [x, z] = ring(r, 3, 20); if (clearPath(x, z)) o += rock(x, z, 0.3 + r() * 0.8, '#9AA5AE') }
    o += cloud(-14, 15, -30, 2, 60000) + cloud(10, 18, -38, 2.4, 70000) + cloud(-4, 20, -50, 2.8, 80000)
    o += bird(0, 14, -24, 14, 34000) + bird(-6, 16, -30, 10, 30000)
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
    o += `<a-circle rotation="-90 0 0" radius="4" position="6.5 0.04 -8" material="color: #3F86B8; opacity: 0.9; transparent: true; metalness: 0.3; roughness: 0.15" ${HIDE}></a-circle>`
    ;['#FF8C42', '#FFFFFF', '#F25F5C'].forEach((c, i) => {
      o += `<a-entity position="6.5 0.12 -8" animation="property: rotation; to: 0 ${i % 2 ? -360 : 360} 0; loop: true; dur: ${14000 + i * 4000}; easing: linear" ${HIDE}><a-sphere radius="0.18" position="${f(1.4 + i * 0.7)} 0 0" scale="2.2 0.6 0.9" color="${c}"></a-sphere></a-entity>`
    })
    const sakura = [[-9, -2], [9, -1], [-11, -14], [12, -15], [0, -20], [-14, 4], [14, 5]]
    sakura.forEach(([x, z]) => {
      let blossoms = ''
      for (let k = 0; k < 6; k++) blossoms += `<a-sphere radius="${f(0.7 + r() * 0.5)}" position="${f(r() * 2 - 1)} ${f(2.4 + r() * 1.2)} ${f(r() * 2 - 1)}" color="${k % 2 ? '#F7B7CC' : '#F9CADA'}"></a-sphere>`
      o += `<a-entity position="${x} 0 ${z}" ${HIDE}><a-cylinder radius="0.18" height="2.6" position="0 1.3 0" rotation="0 0 6" color="#5B4034"></a-cylinder>${blossoms}</a-entity>`
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
