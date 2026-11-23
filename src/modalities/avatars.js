// Personajes personalizables para las salas: cuerpo, piel, peinado, color de pelo, ropa y accesorio.
// Se dibujan con primitivas 3D (A-Frame) y con un retrato SVG para el editor.

export const SKINS = ['#F3D9C2', '#E4B993', '#C99068', '#9E6B47', '#6F4930']
export const HAIR_COLORS = ['#1E1612', '#4A2F20', '#8A5A35', '#D9B06A', '#B4462F', '#9AA3AD']
export const OUTFITS = ['#0966BF', '#1F7A4D', '#B4462F', '#8A5BD6', '#E0A43A', '#2B3A45', '#E86F9A']
export const HAIRS = { corto: 'Corto', largo: 'Largo', rizado: 'Rizado', recogido: 'Recogido', rapado: 'Rapado' }
export const ACCESSORIES = { ninguno: 'Ninguno', lentes: 'Lentes', gorro: 'Gorro', audifonos: 'Audífonos' }

export const DEFAULT_AVATAR = { body: 'mujer', skin: SKINS[1], hair: 'largo', hairColor: HAIR_COLORS[1], outfit: OUTFITS[0], accessory: 'ninguno' }

export function normalizeAvatar(a = {}) {
  const v = { ...DEFAULT_AVATAR, ...a }
  if (!['mujer', 'hombre'].includes(v.body)) v.body = 'mujer'
  if (!HAIRS[v.hair]) v.hair = 'corto'
  if (!ACCESSORIES[v.accessory]) v.accessory = 'ninguno'
  const hex = /^#[0-9a-f]{6}$/i
  ;['skin', 'hairColor', 'outfit'].forEach((k) => { if (!hex.test(v[k])) v[k] = DEFAULT_AVATAR[k] })
  return v
}

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * f))))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

function hairHTML(a) {
  const c = `color: ${a.hairColor}; roughness: 0.85`
  const cap = `<a-sphere radius="0.205" theta-length="80" position="0 0.012 0.008" material="${c}"></a-sphere>`
  switch (a.hair) {
    case 'largo':
      return `${cap}<a-cylinder radius="0.19" radius-top="0.2" height="0.42" position="0 -0.16 0.06" theta-start="-110" theta-length="220" open-ended="true" material="${c}; side: double"></a-cylinder>`
    case 'rizado': {
      let o = ''
      for (let i = 0; i < 14; i++) {
        const a1 = (i / 14) * Math.PI * 2
        o += `<a-sphere radius="0.075" position="${(Math.cos(a1) * 0.16).toFixed(3)} ${(0.1 + Math.sin(i * 1.7) * 0.03).toFixed(3)} ${(Math.sin(a1) * 0.16 + 0.02).toFixed(3)}" material="${c}"></a-sphere>`
      }
      return o + `<a-sphere radius="0.17" position="0 0.11 0.02" material="${c}"></a-sphere>`
    }
    case 'recogido':
      return `${cap}<a-sphere radius="0.09" position="0 0.14 0.17" material="${c}"></a-sphere>`
    case 'rapado':
      return `<a-sphere radius="0.198" theta-length="75" position="0 0.004 0.004" material="color: ${a.hairColor}; opacity: 0.75; transparent: true; roughness: 1"></a-sphere>`
    default:
      return `${cap}<a-sphere radius="0.185" scale="1.05 0.9 1" position="0 0.0 0.055" material="${c}"></a-sphere>`
  }
}

function accessoryHTML(a) {
  if (a.accessory === 'lentes') {
    return `<a-torus radius="0.045" radius-tubular="0.006" position="-0.07 0.02 -0.19" material="color: #1B1B1B"></a-torus><a-torus radius="0.045" radius-tubular="0.006" position="0.07 0.02 -0.19" material="color: #1B1B1B"></a-torus><a-box width="0.05" height="0.008" depth="0.008" position="0 0.025 -0.195" material="color: #1B1B1B"></a-box>`
  }
  if (a.accessory === 'gorro') {
    return `<a-sphere radius="0.215" theta-length="70" position="0 0.03 0" material="color: ${shade(a.outfit, 0.8)}; roughness: 0.95"></a-sphere><a-torus radius="0.2" radius-tubular="0.03" rotation="90 0 0" position="0 0.08 0" material="color: ${shade(a.outfit, 0.65)}"></a-torus><a-sphere radius="0.05" position="0 0.24 0" material="color: #F4F4F4"></a-sphere>`
  }
  if (a.accessory === 'audifonos') {
    return `<a-torus radius="0.21" radius-tubular="0.015" arc="180" rotation="0 0 0" position="0 0.02 0" material="color: #2B2B2B"></a-torus><a-cylinder radius="0.06" height="0.05" rotation="0 0 90" position="-0.21 0 0" material="color: #2B2B2B"></a-cylinder><a-cylinder radius="0.06" height="0.05" rotation="0 0 90" position="0.21 0 0" material="color: #2B2B2B"></a-cylinder>`
  }
  return ''
}

// Personaje completo (mirando hacia -z). La cabeza va en un grupo aparte para seguir la orientación del dispositivo.
export function avatarHTML(av, name = '') {
  const a = normalizeAvatar(av)
  const woman = a.body === 'mujer'
  const skin = `color: ${a.skin}; roughness: 0.6`
  const top = `color: ${a.outfit}; roughness: 0.7`
  const pants = `color: ${woman ? shade(a.outfit, 0.55) : '#2E3B4E'}; roughness: 0.8`
  const torso = woman
    ? `<a-cylinder radius="0.15" radius-top="0.16" height="0.36" position="0 0.98 0" material="${top}"></a-cylinder><a-cone radius-bottom="0.27" radius-top="0.15" height="0.34" position="0 0.66 0" material="${top}"></a-cone>`
    : `<a-cylinder radius="0.17" radius-top="0.23" height="0.5" position="0 0.92 0" material="${top}"></a-cylinder><a-cylinder radius="0.17" height="0.12" position="0 0.63 0" material="${pants}"></a-cylinder>`
  const shoulderX = woman ? 0.2 : 0.27
  return `
    <a-cylinder radius="0.065" height="0.55" position="-0.09 0.3 0" material="${woman ? skin : pants}"></a-cylinder>
    <a-cylinder radius="0.065" height="0.55" position="0.09 0.3 0" material="${woman ? skin : pants}"></a-cylinder>
    <a-box width="0.11" height="0.06" depth="0.2" position="-0.09 0.03 -0.03" material="color: #2B2B2B"></a-box>
    <a-box width="0.11" height="0.06" depth="0.2" position="0.09 0.03 -0.03" material="color: #2B2B2B"></a-box>
    ${torso}
    <a-sphere radius="0.07" position="-${shoulderX} 1.13 0" material="${top}"></a-sphere>
    <a-sphere radius="0.07" position="${shoulderX} 1.13 0" material="${top}"></a-sphere>
    <a-cylinder radius="0.05" height="0.5" position="-${shoulderX + 0.02} 0.88 0" rotation="0 0 -6" material="${top}"></a-cylinder>
    <a-cylinder radius="0.05" height="0.5" position="${shoulderX + 0.02} 0.88 0" rotation="0 0 6" material="${top}"></a-cylinder>
    <a-sphere radius="0.055" position="-${shoulderX + 0.05} 0.6 0" material="${skin}"></a-sphere>
    <a-sphere radius="0.055" position="${shoulderX + 0.05} 0.6 0" material="${skin}"></a-sphere>
    <a-cylinder radius="0.055" height="0.12" position="0 1.2 0" material="${skin}"></a-cylinder>
    <a-entity class="head" position="0 1.42 0" avatar-head>
      <a-sphere radius="0.19" scale="1 1.08 1" material="${skin}"></a-sphere>
      <a-sphere radius="0.028" position="-0.065 0.025 -0.168" material="color: #1B1B1B; roughness: 0.2"></a-sphere>
      <a-sphere radius="0.028" position="0.065 0.025 -0.168" material="color: #1B1B1B; roughness: 0.2"></a-sphere>
      <a-sphere radius="0.008" position="-0.058 0.035 -0.193" material="shader: flat; color: #FFFFFF"></a-sphere>
      <a-sphere radius="0.008" position="0.072 0.035 -0.193" material="shader: flat; color: #FFFFFF"></a-sphere>
      <a-sphere radius="0.022" position="0 -0.02 -0.19" material="color: ${shade(a.skin, 0.92)}"></a-sphere>
      <a-torus class="mouth" radius="0.04" radius-tubular="0.007" arc="180" rotation="0 0 180" position="0 -0.06 -0.175" material="color: #8A3B32"></a-torus>
      ${woman ? `<a-sphere radius="0.03" position="-0.11 -0.03 -0.15" material="color: #F2A3A3; opacity: 0.45; transparent: true"></a-sphere><a-sphere radius="0.03" position="0.11 -0.03 -0.15" material="color: #F2A3A3; opacity: 0.45; transparent: true"></a-sphere>` : ''}
      ${hairHTML(a)}
      ${accessoryHTML(a)}
    </a-entity>
    <a-ring class="talk" radius-inner="0.32" radius-outer="0.36" rotation="-90 0 0" position="0 0.02 0" visible="false" material="shader: flat; color: #6FD3A0" animation="property: scale; from: 1 1 1; to: 1.2 1.2 1.2; dir: alternate; loop: true; dur: 500"></a-ring>
    <a-text class="name" value="${String(name).replace(/["<>]/g, '')}" align="center" width="2.2" color="#FFFFFF" position="0 1.85 0" rotation="0 180 0"></a-text>
    <a-text class="bubble" value="" align="center" width="2.4" color="${a.outfit}" position="0 2.05 0" rotation="0 180 0"></a-text>`
}

// Retrato frontal para el editor (SVG, sin 3D)
export function avatarSVG(av) {
  const a = normalizeAvatar(av)
  const woman = a.body === 'mujer'
  const hair = {
    largo: `<path d="M38 52 Q36 22 60 20 Q84 22 82 52 L84 92 Q72 84 70 60 L50 60 Q48 84 36 92 Z" fill="${a.hairColor}"/>`,
    corto: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${a.hairColor}"/>`,
    rizado: `<g fill="${a.hairColor}">${[30, 42, 54, 66, 78, 90].map((x, i) => `<circle cx="${x - 0}" cy="${i % 2 ? 26 : 30}" r="11"/>`).join('')}<circle cx="34" cy="44" r="9"/><circle cx="86" cy="44" r="9"/></g>`,
    recogido: `<path d="M38 50 Q38 22 60 21 Q82 22 82 50 Q78 34 60 33 Q42 34 38 50 Z" fill="${a.hairColor}"/><circle cx="60" cy="16" r="10" fill="${a.hairColor}"/>`,
    rapado: `<path d="M39 46 Q40 23 60 22 Q80 23 81 46 Q76 32 60 31 Q44 32 39 46 Z" fill="${a.hairColor}" opacity="0.6"/>`
  }[a.hair]
  const acc = {
    ninguno: '',
    lentes: '<g fill="none" stroke="#1B1B1B" stroke-width="2.5"><circle cx="51" cy="50" r="7"/><circle cx="69" cy="50" r="7"/><path d="M58 50 H62"/></g>',
    gorro: `<path d="M36 40 Q38 12 60 12 Q82 12 84 40 Z" fill="${shade(a.outfit, 0.8)}"/><rect x="34" y="36" width="52" height="8" rx="4" fill="${shade(a.outfit, 0.65)}"/><circle cx="60" cy="10" r="5" fill="#F4F4F4"/>`,
    audifonos: '<path d="M36 50 Q36 16 60 16 Q84 16 84 50" fill="none" stroke="#2B2B2B" stroke-width="4"/><rect x="31" y="44" width="9" height="16" rx="4" fill="#2B2B2B"/><rect x="80" y="44" width="9" height="16" rx="4" fill="#2B2B2B"/>'
  }[a.accessory]
  const body = woman
    ? `<path d="M40 86 Q60 78 80 86 L92 120 H28 Z" fill="${a.outfit}"/>`
    : `<path d="M32 90 Q60 78 88 90 L92 120 H28 Z" fill="${a.outfit}"/>`
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista previa del personaje">
    <rect width="120" height="120" rx="24" fill="var(--tint)"/>
    ${a.hair === 'largo' ? hair : ''}
    ${body}
    <rect x="54" y="68" width="12" height="14" fill="${a.skin}"/>
    <ellipse cx="60" cy="50" rx="21" ry="24" fill="${a.skin}"/>
    <circle cx="52" cy="50" r="2.6" fill="#1B1B1B"/><circle cx="68" cy="50" r="2.6" fill="#1B1B1B"/>
    <path d="M53 62 Q60 67 67 62" fill="none" stroke="#8A3B32" stroke-width="2" stroke-linecap="round"/>
    ${woman ? '<circle cx="47" cy="58" r="3.5" fill="#F2A3A3" opacity="0.5"/><circle cx="73" cy="58" r="3.5" fill="#F2A3A3" opacity="0.5"/>' : ''}
    ${a.hair !== 'largo' ? hair : '<path d="M39 48 Q40 24 60 23 Q80 24 81 48 Q76 34 60 33 Q44 34 39 48 Z" fill="' + a.hairColor + '"/>'}
    ${acc}
  </svg>`
}
