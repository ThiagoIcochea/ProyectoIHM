// Sonido ambiental generado en el navegador (Web Audio), sin archivos externos.
let ctx
let current = null

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(c, seconds = 4) {
  const len = c.sampleRate * seconds
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02 // ruido "marrón", más suave
    d[i] = last * 3.5
  }
  return buf
}

export const SOUNDS = { lluvia: 'Lluvia', olas: 'Olas', bosque: 'Bosque', fogata: 'Fogata' }

// Chasquidos de leña: impulsos cortos aleatorios sobre un fondo grave
function crackleBuffer(c, seconds = 6) {
  const len = c.sampleRate * seconds
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = last * 2.2
  }
  const pops = Math.round(seconds * 14)
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(Math.random() * (len - 2000))
    const amp = 0.2 + Math.random() * 0.8
    const dur = 80 + Math.floor(Math.random() * 600)
    for (let k = 0; k < dur; k++) d[at + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / (dur / 5))
  }
  return buf
}

export function playAmbient(kind = 'lluvia', volume = 0.5) {
  stopAmbient()
  const c = ac()
  const src = c.createBufferSource()
  src.buffer = kind === 'fogata' ? crackleBuffer(c) : noiseBuffer(c)
  src.loop = true
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  const master = c.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(volume, c.currentTime + 1.2)
  const nodes = [src]

  if (kind === 'lluvia') {
    filter.type = 'highpass'
    filter.frequency.value = 900
    gain.gain.value = 0.55
  } else if (kind === 'olas') {
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = 0.09
    lfoGain.gain.value = 0.45
    gain.gain.value = 0.5
    lfo.connect(lfoGain).connect(gain.gain)
    lfo.start()
    nodes.push(lfo)
  } else if (kind === 'fogata') {
    filter.type = 'lowpass'
    filter.frequency.value = 3800
    gain.gain.value = 0.6
  } else {
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.4
    gain.gain.value = 0.35
  }
  src.connect(filter).connect(gain).connect(master).connect(c.destination)
  src.start()
  current = { nodes, master }
  return current
}

export function setAmbientVolume(v) {
  if (current && ctx) current.master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.2)
}

export function stopAmbient() {
  if (!current || !ctx) return
  const { nodes, master } = current
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
  setTimeout(() => nodes.forEach((n) => { try { n.stop() } catch { /* ya detenido */ } }), 500)
  current = null
}

export const isAmbientPlaying = () => !!current

export function chime(freq = 528, dur = 0.6, vol = 0.12) {
  try {
    const c = ac()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, c.currentTime)
    g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g).connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur + 0.05)
  } catch { /* audio no disponible */ }
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern) } catch { /* sin vibración */ }
}

// Elegir por dónde sale el sonido (parlante Bluetooth, TV por HDMI…). Chrome/Edge 110+ y Firefox.
export const canChooseOutput = typeof window !== 'undefined' && (('setSinkId' in (window.AudioContext?.prototype || {})) || !!navigator.mediaDevices?.selectAudioOutput)
export async function chooseOutput() {
  const c = ac()
  if (navigator.mediaDevices?.selectAudioOutput) {
    const dev = await navigator.mediaDevices.selectAudioOutput()
    if (c.setSinkId) await c.setSinkId(dev.deviceId)
    return dev.label
  }
  // Chrome no tiene selector: pedimos permiso de micrófono para ver los nombres de las salidas
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()) } catch { /* sin nombres */ }
  const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput')
  return outs
}
export async function setOutput(deviceId) {
  const c = ac()
  if (c.setSinkId) await c.setSinkId(deviceId)
}
