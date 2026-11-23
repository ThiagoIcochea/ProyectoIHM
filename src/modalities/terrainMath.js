// Altura del terreno compartida: la usa el componente "terrain" y también los mundos para apoyar árboles y rocas en el suelo.
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.13 + vnoise(x * 8.7, y * 8.7) * 0.05
const smooth = (x, a, b) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const terrainNoise = (x, z, d) => fbm(x * (d.scale ?? 0.035) + 10, z * (d.scale ?? 0.035) + 10)
export function terrainHeight(x, z, d) {
  if (!d) return 0
  const ramp = smooth(Math.hypot(x, z), d.flat, d.flat * 3.2)
  const n = terrainNoise(x, z, d)
  const micro = (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.08
  let h = (n * n * d.height * 2.2 + micro) * ramp + micro * 0.3
  // Cauce o lecho: el terreno baja bajo el agua y sube suave en la orilla
  for (const zn of ZONES[d.world] || []) {
    if (!zn.water) continue
    const dist = zoneDistance(zn, x, z)
    if (dist < 3) h = -0.35 + (h + 0.35) * smooth(dist, -0.4, 3)
  }
  return h
}

// Zonas de agua (se hunde el terreno y no se colocan árboles ni rocas) y zonas libres (fogata)
const D25 = (25 * Math.PI) / 180
export const ZONES = {
  bosque: [{ kind: 'line', x: 7, z: -6, dx: Math.sin(D25), dz: Math.cos(D25), half: 1.4, water: true }],
  playa: [{ kind: 'sea', zMax: -8.6, water: true }],
  montana: [{ kind: 'circle', x: 0, z: -17, r: 9.2, water: true }],
  jardin: [{ kind: 'circle', x: 6.5, z: -8, r: 4.2, water: true }],
  fogata: [{ kind: 'circle', x: -4.6, z: -6.4, r: 3.2, water: false }]
}
export function zoneDistance(zone, x, z) {
  if (zone.kind === 'circle') return Math.hypot(x - zone.x, z - zone.z) - zone.r
  if (zone.kind === 'sea') return z - zone.zMax
  // distancia a una recta infinita
  const px = x - zone.x
  const pz = z - zone.z
  return Math.abs(px * zone.dz - pz * zone.dx) - zone.half
}
export function blocked(world, x, z, margin = 1.2) {
  return (ZONES[world] || []).some((zn) => zoneDistance(zn, x, z) < margin)
}
