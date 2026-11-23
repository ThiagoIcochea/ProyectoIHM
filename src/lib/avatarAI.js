// Crear un personaje a partir de una imagen (foto o dibujo).
// Con IA (Groq, modelo con visión) se reconocen peinado, accesorios, ropa y colores.
// Sin IA se toman los colores de la imagen (pelo, piel y ropa) y se mantiene lo demás.
import { hasKey, visionJSON } from './groq'
import { normalizeAvatar, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH, PANTS, HAIRS, TOPS, ACCESSORIES, FACIAL, EXPRESSIONS, BUILDS } from '../modalities/avatars'

export async function fileToDataUrl(file, max = 512) {
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = URL.createObjectURL(file)
  })
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(img.src)
  return { dataUrl: c.toDataURL('image/jpeg', 0.85), canvas: c }
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const nearest = (color, palette) => {
  const c = Array.isArray(color) ? color : rgb(color)
  let best = palette[0]
  let bd = Infinity
  for (const p of palette) {
    const q = rgb(p)
    const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2
    if (d < bd) { bd = d; best = p }
  }
  return best
}
function avgRegion(canvas, x0, y0, x1, y1) {
  const g = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const d = g.getImageData(Math.round(x0 * w), Math.round(y0 * h), Math.max(1, Math.round((x1 - x0) * w)), Math.max(1, Math.round((y1 - y0) * h))).data
  let r = 0, gg = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ }
  return [r / n, gg / n, b / n]
}

function localGuess(canvas, current) {
  // Supone un retrato centrado: pelo arriba, cara al centro, ropa abajo
  const hair = avgRegion(canvas, 0.38, 0.06, 0.62, 0.16)
  const skin = avgRegion(canvas, 0.42, 0.32, 0.58, 0.44)
  const cloth = avgRegion(canvas, 0.3, 0.78, 0.7, 0.95)
  return normalizeAvatar({ ...current, hairColor: nearest(hair, HAIR_COLORS), skin: nearest(skin, SKINS), outfit: nearest(cloth, CLOTH) })
}

const PROMPT = `Mira la imagen (foto o dibujo de una persona o personaje) y describe su apariencia para crear un avatar de caricatura.
Devuelve SOLO un JSON con estas claves y valores permitidos:
"body": ${Object.keys({ mujer: 1, hombre: 1 }).join('|')}
"build": ${Object.keys(BUILDS).join('|')}
"skin": color hex aproximado de la piel
"hairColor": color hex aproximado del pelo
"eyes": color hex aproximado de los ojos (si no se ve, "#3B2416")
"hair": ${Object.keys(HAIRS).join('|')}
"facial": ${Object.keys(FACIAL).join('|')}
"expression": ${Object.keys(EXPRESSIONS).join('|')}
"top": ${Object.keys(TOPS).join('|')}
"outfit": color hex de la prenda superior
"pants": color hex del pantalón (si no se ve, "#2E3B4E")
"accessories": lista con 0 a 4 de: ${Object.keys(ACCESSORIES).join(', ')}
No identifiques a la persona ni describas nada más.`

export async function avatarFromImage(file, current) {
  const { dataUrl, canvas } = await fileToDataUrl(file)
  if (hasKey()) {
    try {
      const r = await visionJSON(PROMPT, dataUrl)
      const av = normalizeAvatar({
        ...current,
        ...r,
        skin: r.skin ? nearest(r.skin, SKINS) : current.skin,
        hairColor: r.hairColor ? nearest(r.hairColor, HAIR_COLORS) : current.hairColor,
        eyes: r.eyes ? nearest(r.eyes, EYE_COLORS) : current.eyes,
        outfit: r.outfit ? nearest(r.outfit, CLOTH) : current.outfit,
        pants: r.pants ? nearest(r.pants, PANTS) : current.pants,
        accessories: Array.isArray(r.accessories) ? r.accessories : current.accessories
      })
      return { avatar: av, ai: true, preview: dataUrl }
    } catch { /* se usa el modo básico */ }
  }
  return { avatar: localGuess(canvas, current), ai: false, preview: dataUrl }
}
