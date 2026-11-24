// Salas de autoayuda compartidas por código, punto a punto (WebRTC con PeerJS).
// Por defecto cada persona está en su sala personal. Quien crea la sala es el anfitrión: reenvía los mensajes
// y elige el escenario para todos. No hay chat escrito: presencia, personaje, orientación del dispositivo,
// gestos predefinidos, respiración sincronizada y voz (opcional, con el micrófono o un auricular Bluetooth).
import { useSyncExternalStore } from 'react'
import { getState } from './store'
import { makePeer, randCode, explainPeerError } from './peer'
import { normalizeAvatar } from '../modalities/avatars'

const PREFIX = 'escucha-sala-'
const MAX = 6
export const REACTIONS = {
  acompano: 'Te acompaño',
  respira: 'Respira conmigo',
  gracias: 'Gracias',
  aqui: 'Estoy aquí'
}

let st = { status: 'solo', code: '', me: null, members: {}, error: '', lastBreath: null, scene: null, talking: false, micError: '' }
const ls = new Set()
const set = (p) => {
  st = { ...st, ...p }
  ls.forEach((l) => l())
}
export const useRoom = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => st, () => st)
export const getRoom = () => st

let peer = null
let conns = [] // anfitrión: invitados; invitado: [anfitrión]
let breathHandler = null
export const onRemoteBreath = (fn) => (breathHandler = fn)

// La sala sobrevive a recargar la página: se guarda el código y el rol en esta pestaña
const SAVE_KEY = 'escucha.sala'
const save = (v) => { try { v ? sessionStorage.setItem(SAVE_KEY, JSON.stringify(v)) : sessionStorage.removeItem(SAVE_KEY) } catch { /* nada */ } }
const saved = () => { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null') } catch { return null } }
const lastSeen = {}
let leaving = false
let heartbeat = null
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function startHeartbeat() {
  clearInterval(heartbeat)
  heartbeat = setInterval(() => {
    broadcast({ t: 'ping', id: st.me?.id })
    const now = Date.now()
    if (st.status === 'host') {
      // Quien no da señales en 10 s (por ejemplo, recargó la página) sale de la sala
      Object.keys(st.members).forEach((id) => {
        if (now - (lastSeen[id] || now) > 10000) dropMember(id)
      })
    } else if (st.status === 'member' && now - (lastSeen.host || now) > 12000) {
      reconnectAsMember()
    }
  }, 3000)
}
function dropMember(id) {
  const members = { ...st.members }
  if (!members[id]) return
  delete members[id]
  set({ members })
  dropAudio(id)
  conns.filter((c) => c.peer === id).forEach((c) => { conns = conns.filter((x) => x !== c); try { c.close() } catch { /* nada */ } })
  const r = { t: 'roster', members: roster() }
  conns.forEach((c) => c.open && c.send(r))
}
if (typeof window !== 'undefined') {
  // Aviso inmediato al cerrar o recargar para que nadie vea un avatar "fantasma"
  window.addEventListener('pagehide', () => {
    try { conns.forEach((c) => c.open && c.send({ t: 'bye', id: st.me?.id })) } catch { /* nada */ }
  })
}

const clean = (s, n = 24) => String(s || '').replace(/[<>"]/g, '').slice(0, n)
function meInfo(id, idx = 0) {
  const alias = clean(getState().alias)
  return { id, name: alias || `Persona ${idx + 1}`, avatar: normalizeAvatar(getState().avatar || {}) }
}

function handle(msg, from) {
  if (!msg || typeof msg !== 'object') return
  if (msg.id) lastSeen[msg.id] = Date.now()
  if (st.status === 'member') lastSeen.host = Date.now()
  if (msg.t === 'ping') {
    if (st.status === 'host' && from) return
    return
  }
  const members = { ...st.members }
  const known = members[msg.id]
  switch (msg.t) {
    case 'roster': {
      const m = {}
      msg.members.forEach((x) => { if (x.id !== st.me?.id) m[x.id] = { ...(members[x.id] || {}), ...x, avatar: normalizeAvatar(x.avatar) } })
      const mine = msg.members.find((x) => x.id === st.me?.id)
      set({ members: m, me: mine ? { ...st.me, slot: mine.slot } : st.me })
      syncCalls()
      return
    }
    case 'pose':
      if (known) { members[msg.id] = { ...known, q: msg.q, breath: msg.b }; set({ members }) }
      break
    case 'react':
      if (known) { members[msg.id] = { ...known, react: msg.k, reactAt: Date.now() }; set({ members }) }
      break
    case 'avatar':
      if (known) { members[msg.id] = { ...known, avatar: normalizeAvatar(msg.avatar), name: clean(msg.name) || known.name }; set({ members }) }
      break
    case 'talk':
      if (known) { members[msg.id] = { ...known, talking: !!msg.on }; set({ members }) }
      break
    case 'breath':
      set({ lastBreath: { action: msg.action, by: msg.id, at: Date.now() } })
      breathHandler?.(msg.action)
      break
    case 'scene':
      // Solo vale el escenario que envía el anfitrión
      if (st.status === 'member') set({ scene: { kind: msg.kind, arScene: msg.arScene, at: Date.now() } })
      break
    case 'bye':
      if (st.status === 'host') { dropMember(msg.id); return }
      delete members[msg.id]
      set({ members })
      dropAudio(msg.id)
      break
    default:
  }
  if (st.status === 'host' && from && msg.t !== 'scene') conns.forEach((c) => c !== from && c.open && c.send(msg))
}

function roster() {
  return [st.me, ...Object.values(st.members).map(({ id, name, avatar, talking, slot }) => ({ id, name, avatar, talking, slot }))]
}
// Lugar fijo en el círculo compartido (0 = anfitrión). Así todos ven a cada persona en el mismo sitio
// y cuando alguien mira a otra persona, esa persona ve que la están mirando.
function freeSlot() {
  const used = new Set(Object.values(st.members).map((m) => m.slot))
  for (let i = 1; i < 6; i++) if (!used.has(i)) return i
  return 5
}

function listenCalls() {
  // Todos contestan las llamadas de voz solo para escuchar; quien habla abre sus propias llamadas
  peer.on('call', (call) => {
    call.answer()
    call.on('stream', (stream) => playAudio(call.peer, stream))
    call.on('close', () => dropAudio(call.peer))
  })
}

export async function createRoom(fixedCode) {
  await leaveRoom()
  set({ status: 'connecting', error: '' })
  for (let attempt = 0; attempt < (fixedCode ? 8 : 3); attempt++) {
    const code = fixedCode || randCode()
    try {
      peer = await makePeer(PREFIX + code)
      set({ status: 'host', code, me: { ...meInfo(peer.id, 0), slot: 0 }, members: {}, scene: null })
      save({ code, role: 'host' })
      listenCalls()
      startHeartbeat()
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (conns.length >= MAX - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return }
          conns.push(conn)
        })
        conn.on('data', (msg) => {
          lastSeen[conn.peer] = Date.now()
          if (msg?.t === 'hello') {
            // Si alguien vuelve tras recargar, se quita su conexión anterior
            conns.filter((c) => c !== conn && c.peer === conn.peer).forEach((c) => c.close())
            const idx = conns.indexOf(conn) + 1
            const prevSlot = st.members[conn.peer]?.slot
            const info = { id: conn.peer, name: clean(msg.name) || `Persona ${idx + 1}`, avatar: normalizeAvatar(msg.avatar), slot: prevSlot ?? freeSlot() }
            set({ members: { ...st.members, [conn.peer]: info } })
            const r = { t: 'roster', members: roster() }
            conns.forEach((c) => c.open && c.send(r))
            if (lastScene) conn.send(lastScene)
            syncCalls()
            return
          }
          handle({ ...msg, id: conn.peer }, conn)
        })
        conn.on('close', () => {
          conns = conns.filter((c) => c !== conn)
          const members = { ...st.members }
          delete members[conn.peer]
          set({ members })
          dropAudio(conn.peer)
          const r = { t: 'roster', members: roster() }
          conns.forEach((c) => c.open && c.send(r))
        })
      })
      peer.on('disconnected', () => peer?.reconnect?.())
      return code
    } catch (e) {
      peer?.destroy?.()
      peer = null
      if (e?.type !== 'unavailable-id') {
        set({ status: 'solo', error: explainPeerError(e) })
        save(null)
        throw e
      }
      // Tras recargar, el servidor tarda unos segundos en liberar el código anterior
      if (fixedCode) await wait(3000)
    }
  }
  set({ status: 'solo', error: fixedCode ? 'No se pudo recuperar la sala. Crea una nueva.' : 'No se pudo crear la sala. Inténtalo otra vez.' })
  save(null)
}

export async function joinRoom(raw, { quiet = false } = {}) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 6) return set({ error: 'El código tiene 6 letras o números.' })
  await leaveRoom({ keepSaved: true })
  set({ status: quiet ? 'reconnecting' : 'connecting', error: '' })
  try {
    peer = await makePeer()
    const conn = peer.connect(PREFIX + code, { reliable: true })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { type: 'timeout' })), 15000)
      conn.on('open', () => { clearTimeout(timer); resolve() })
      peer.on('error', (e) => { clearTimeout(timer); reject(e) })
    })
    conns = [conn]
    listenCalls()
    const me = meInfo(peer.id, 1)
    set({ status: 'member', code, me, members: {}, scene: null })
    save({ code, role: 'member' })
    lastSeen.host = Date.now()
    startHeartbeat()
    conn.send({ t: 'hello', name: me.name, avatar: me.avatar })
    conn.on('data', (msg) => {
      if (msg?.t === 'full') {
        set({ error: 'La sala está llena (máximo 6 personas).' })
        leaveRoom()
        return
      }
      handle(msg)
    })
    conn.on('close', () => { if (st.status === 'member' && !leaving) reconnectAsMember() })
    return true
  } catch (e) {
    peer?.destroy?.()
    peer = null
    if (!quiet) { set({ status: 'solo', error: explainPeerError(e) }); save(null) }
    return false
  }
}

// Si el anfitrión recarga la página, los invitados reintentan unirse al mismo código durante ~30 s
let reconnecting = false
async function reconnectAsMember() {
  if (reconnecting) return
  reconnecting = true
  const code = st.code
  stopTalking()
  set({ status: 'reconnecting', members: {} })
  for (let i = 0; i < 10 && reconnecting; i++) {
    await wait(3000)
    if (await joinRoom(code, { quiet: true })) { reconnecting = false; return }
  }
  reconnecting = false
  save(null)
  set({ status: 'solo', code: '', members: {}, error: 'Se perdió la conexión con la sala.' })
}

// Al abrir la pantalla tras recargar: vuelve a la sala en la que estabas
export async function resumeRoom() {
  const s0 = saved()
  if (!s0 || st.status !== 'solo') return
  if (s0.role === 'host') await createRoom(s0.code).catch(() => {})
  else await joinRoom(s0.code, { quiet: true }).then((ok) => { if (!ok) reconnectAsMember() })
}

export async function leaveRoom({ keepSaved = false } = {}) {
  if (!keepSaved) { save(null); reconnecting = false }
  clearInterval(heartbeat)
  leaving = true
  stopTalking()
  Object.keys(audios).forEach(dropAudio)
  lastScene = null
  if (!peer) { leaving = false; return set({ status: keepSaved ? st.status : 'solo', code: keepSaved ? st.code : '', members: {}, scene: null }) }
  try { conns.forEach((c) => c.open && c.send({ t: 'bye', id: st.me?.id })) } catch { /* nada */ }
  await new Promise((r) => setTimeout(r, 120))
  conns.forEach((c) => c.close())
  conns = []
  peer.destroy()
  peer = null
  leaving = false
  set({ status: 'solo', code: '', members: {}, scene: null })
}

function broadcast(msg) {
  conns.forEach((c) => c.open && c.send(msg))
}

let lastPose = ''
export function sendPose(q, breathing) {
  if (st.status !== 'host' && st.status !== 'member') return
  const r = q.map((v) => Math.round(v * 1000) / 1000)
  const key = r.join(',') + breathing
  if (key === lastPose) return
  lastPose = key
  broadcast({ t: 'pose', id: st.me.id, q: r, b: breathing })
}
export function sendReaction(k) {
  if (!REACTIONS[k] || !st.me) return
  broadcast({ t: 'react', id: st.me.id, k })
}
export function sendBreath(action) {
  if (!st.me) return
  broadcast({ t: 'breath', id: st.me.id, action })
}
export function sendAvatar(avatar) {
  if (!st.me) return
  const a = normalizeAvatar(avatar)
  set({ me: { ...st.me, avatar: a } })
  broadcast({ t: 'avatar', id: st.me.id, avatar: a, name: st.me.name })
}

// El anfitrión cambia el escenario para todos
let lastScene = null
export function sendScene(kind, arScene) {
  if (st.status !== 'host') return
  lastScene = { t: 'scene', kind, arScene }
  broadcast(lastScene)
}

// ---------- Voz en la sala ----------
let localStream = null
let outCalls = {}
const audios = {}
let sinkId = ''

function playAudio(id, stream) {
  let el = audios[id]
  if (!el) {
    el = document.createElement('audio')
    el.autoplay = true
    el.playsInline = true
    el.style.display = 'none'
    document.body.appendChild(el)
    audios[id] = el
  }
  el.srcObject = stream
  if (sinkId && el.setSinkId) el.setSinkId(sinkId).catch(() => {})
  el.play?.().catch(() => {})
}
function dropAudio(id) {
  const el = audios[id]
  if (el) { el.srcObject = null; el.remove(); delete audios[id] }
}

function syncCalls() {
  if (!localStream || !peer) return
  Object.keys(st.members).forEach((id) => {
    if (outCalls[id]) return
    try { outCalls[id] = peer.call(id, localStream) } catch { /* sin conexión */ }
  })
}

export async function startTalking(deviceId) {
  if (!peer || !st.me) return
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    outCalls = {}
    syncCalls()
    set({ talking: true, micError: '' })
    broadcast({ t: 'talk', id: st.me.id, on: true })
  } catch {
    set({ micError: 'No se pudo usar el micrófono. Revisa el permiso del navegador.' })
  }
}
export function stopTalking() {
  Object.values(outCalls).forEach((c) => c?.close?.())
  outCalls = {}
  localStream?.getTracks().forEach((t) => t.stop())
  localStream = null
  if (st.talking && st.me) broadcast({ t: 'talk', id: st.me.id, on: false })
  set({ talking: false })
}
// Salida de voz: auriculares o parlante Bluetooth, TV por HDMI…
export function setVoiceOutput(id) {
  sinkId = id
  Object.values(audios).forEach((el) => el.setSinkId?.(id).catch(() => {}))
}
export async function listAudioDevices() {
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()) } catch { /* sin nombres */ }
  const all = await navigator.mediaDevices.enumerateDevices()
  return { inputs: all.filter((d) => d.kind === 'audioinput'), outputs: all.filter((d) => d.kind === 'audiooutput') }
}
