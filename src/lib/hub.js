// Hogar conectado: otros dispositivos (teléfonos, tablets, laptops, Smart TV) se unen con un código
// y actúan como parlante, pantalla de TV o luz, sincronizados con el panel IoT.
import { useSyncExternalStore } from 'react'
import { makePeer, randCode, explainPeerError } from './peer'

const PREFIX = 'escucha-hogar-'
export const ROLES = { tv: 'Pantalla / TV', parlante: 'Parlante', luz: 'Luz' }

let st = { status: 'off', code: '', devices: {}, error: '', state: null, breath: null }
const ls = new Set()
const set = (p) => { st = { ...st, ...p }; ls.forEach((l) => l()) }
export const useHub = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => st, () => st)

let peer = null
let conns = []
let lastState = null

// ---------- Panel (anfitrión) ----------
export async function startHub() {
  if (st.status === 'host') return st.code
  set({ status: 'connecting', error: '' })
  for (let i = 0; i < 3; i++) {
    const code = randCode()
    try {
      peer = await makePeer(PREFIX + code)
      set({ status: 'host', code, devices: {} })
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          conns.push(conn)
          if (lastState) conn.send({ t: 'state', state: lastState })
        })
        conn.on('data', (m) => {
          if (m?.t === 'hello') set({ devices: { ...st.devices, [conn.peer]: { id: conn.peer, role: m.role, name: String(m.name || '').slice(0, 30) } } })
        })
        conn.on('close', () => {
          conns = conns.filter((c) => c !== conn)
          const d = { ...st.devices }
          delete d[conn.peer]
          set({ devices: d })
        })
      })
      peer.on('disconnected', () => peer?.reconnect?.())
      return code
    } catch (e) {
      peer?.destroy?.()
      peer = null
      if (e?.type !== 'unavailable-id') { set({ status: 'off', error: explainPeerError(e) }); return null }
    }
  }
  set({ status: 'off', error: 'No se pudo crear el código.' })
  return null
}

export function stopHub() {
  conns.forEach((c) => c.close())
  conns = []
  peer?.destroy()
  peer = null
  set({ status: 'off', code: '', devices: {} })
}

export function broadcastState(state) {
  lastState = state
  conns.forEach((c) => c.open && c.send({ t: 'state', state }))
}
export function broadcastBreath(action) {
  conns.forEach((c) => c.open && c.send({ t: 'breath', action, at: Date.now() }))
}

// ---------- Dispositivo que se une ----------
export async function joinHub(raw, role, name) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 6) return set({ error: 'El código tiene 6 letras o números.' })
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
    conn.send({ t: 'hello', role, name })
    set({ status: 'joined', code })
    conn.on('data', (m) => {
      if (m?.t === 'state') set({ state: m.state })
      if (m?.t === 'breath') set({ breath: { action: m.action, at: Date.now() } })
    })
    conn.on('close', () => set({ status: 'off', error: 'El panel se desconectó.' }))
  } catch (e) {
    peer?.destroy?.()
    peer = null
    set({ status: 'off', error: explainPeerError(e) })
  }
}
export function leaveHub() {
  stopHub()
}
