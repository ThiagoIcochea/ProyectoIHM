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
  return (n * n * d.height * 2.2 + micro) * ramp + micro * 0.3
}
