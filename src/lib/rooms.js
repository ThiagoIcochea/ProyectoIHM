// Salas de autoayuda compartidas por código, punto a punto (WebRTC con PeerJS).
// Por defecto cada persona está en su sala personal. Quien crea la sala hace de anfitrión y reenvía los mensajes.
// No hay chat libre: solo presencia, orientación del dispositivo (para el avatar), reacciones predefinidas y respiración sincronizada.
import { useSyncExternalStore } from 'react'
import { getState } from './store'
import { makePeer, randCode, explainPeerError } from './peer'

const PREFIX = 'escucha-sala-'
const MAX = 6
const COLORS = ['#4EA3EF', '#6FD3A0', '#F3C06B', '#FF8A80', '#B9A6F5', '#7CC0F8']
export const REACTIONS = {
  acompano: 'Te acompaño',
  respira: 'Respira conmigo',
  gracias: 'Gracias',
  aqui: 'Estoy aquí'
}

let st = { status: 'solo', code: '', me: null, members: {}, error: '', lastBreath: null }
const ls = new Set()
const set = (p) => {
  st = { ...st, ...p }
  ls.forEach((l) => l())
}
export const useRoom = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => st, () => st)
export const getRoom = () => st

let peer = null
let conns = [] // anfitrión: conexiones de invitados; invitado: [conexión al anfitrión]
let breathHandler = null
export const onRemoteBreath = (fn) => (breathHandler = fn)

function meInfo(id, idx = 0) {
  const alias = (getState().alias || '').trim()
  return { id, name: alias || `Persona ${idx + 1}`, color: COLORS[idx % COLORS.length] }
}

function handle(msg, from) {
  if (!msg || typeof msg !== 'object') return
  const members = { ...st.members }
  if (msg.t === 'roster') {
    const m = {}
    msg.members.forEach((x) => { if (x.id !== st.me?.id) m[x.id] = { ...(members[x.id] || {}), ...x } })
    return set({ members: m })
  }
  if (msg.t === 'pose' && members[msg.id]) {
    members[msg.id] = { ...members[msg.id], q: msg.q, breath: msg.b }
    set({ members })
  }
  if (msg.t === 'react' && members[msg.id]) {
    members[msg.id] = { ...members[msg.id], react: msg.k, reactAt: Date.now() }
    set({ members })
  }
  if (msg.t === 'breath') {
    set({ lastBreath: { action: msg.action, by: msg.id, at: Date.now() } })
    breathHandler?.(msg.action)
  }
  if (msg.t === 'bye') {
    delete members[msg.id]
    set({ members })
  }
  // El anfitrión reenvía a los demás
  if (st.status === 'host' && from) conns.forEach((c) => c !== from && c.open && c.send(msg))
}

function roster() {
  return [st.me, ...Object.values(st.members).map(({ id, name, color }) => ({ id, name, color }))]
}

export async function createRoom() {
  await leaveRoom()
  set({ status: 'connecting', error: '' })
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randCode()
    try {
      peer = await makePeer(PREFIX + code)
      const me = meInfo(peer.id, 0)
      set({ status: 'host', code, me, members: {} })
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (conns.length >= MAX - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return }
          conns.push(conn)
        })
        conn.on('data', (msg) => {
          if (msg?.t === 'hello') {
            const idx = conns.indexOf(conn) + 1
            const info = { id: conn.peer, name: String(msg.name || '').slice(0, 24) || `Persona ${idx + 1}`, color: COLORS[idx % COLORS.length] }
            set({ members: { ...st.members, [conn.peer]: info } })
            const r = { t: 'roster', members: roster() }
            conns.forEach((c) => c.open && c.send(r))
            return
          }
          handle({ ...msg, id: conn.peer }, conn)
        })
        conn.on('close', () => {
          conns = conns.filter((c) => c !== conn)
          const members = { ...st.members }
          delete members[conn.peer]
          set({ members })
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
        set({ status: 'solo', error: explain(e) })
        throw e
      }
    }
  }
  set({ status: 'solo', error: 'No se pudo crear la sala. Inténtalo otra vez.' })
}

export async function joinRoom(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 6) {
    set({ error: 'El código tiene 6 letras o números.' })
    return
  }
  await leaveRoom()
  set({ status: 'connecting', error: '' })
  try {
    peer = await makePeer()
    const conn = peer.connect(PREFIX + code, { reliable: true })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { type: 'timeout' })), 15000)
      conn.on('open', () => { clearTimeout(timer); resolve() })
      peer.on('error', (e) => { clearTimeout(timer); reject(e) })
    })
    conns = [conn]
    const me = meInfo(peer.id, 1)
    set({ status: 'member', code, me, members: {} })
    conn.send({ t: 'hello', name: me.name })
    conn.on('data', (msg) => {
      if (msg?.t === 'full') {
        set({ error: 'La sala está llena (máximo 6 personas).' })
        leaveRoom()
        return
      }
      if (msg?.t === 'roster') {
        const mine = msg.members.find((x) => x.id === peer?.id)
        if (mine) set({ me: { ...st.me, ...mine } })
      }
      handle(msg)
    })
    conn.on('close', () => {
      if (st.status === 'member') {
        set({ status: 'solo', code: '', members: {}, error: 'La sala se cerró.' })
        peer?.destroy()
        peer = null
        conns = []
      }
    })
  } catch (e) {
    peer?.destroy?.()
    peer = null
    set({ status: 'solo', error: explain(e) })
  }
}

export async function leaveRoom() {
  if (!peer) return set({ status: 'solo', code: '', members: {} })
  try { conns.forEach((c) => c.open && c.send({ t: 'bye', id: st.me?.id })) } catch { /* nada */ }
  await new Promise((r) => setTimeout(r, 120))
  conns.forEach((c) => c.close())
  conns = []
  peer.destroy()
  peer = null
  set({ status: 'solo', code: '', members: {} })
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

const explain = explainPeerError
