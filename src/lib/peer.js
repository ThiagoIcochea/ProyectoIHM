// Conexión PeerJS compartida por las salas y por el hogar conectado.
export async function makePeer(id) {
  const { Peer } = await import('peerjs')
  const host = import.meta.env.VITE_PEER_HOST
  const opts = host
    ? { host, port: Number(import.meta.env.VITE_PEER_PORT || 443), path: import.meta.env.VITE_PEER_PATH || '/', secure: import.meta.env.VITE_PEER_SECURE !== 'false' }
    : {}
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, opts) : new Peer(opts)
    const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { type: 'timeout' })), 15000)
    p.on('open', () => { clearTimeout(timer); resolve(p) })
    p.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

export const randCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join('')
}

export function explainPeerError(e) {
  const t = e?.type
  if (t === 'peer-unavailable') return 'No existe ese código o ya se cerró.'
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'No se pudo conectar con el servidor de enlace. Revisa tu internet.'
  if (t === 'browser-incompatible') return 'Este navegador no permite conexiones directas entre dispositivos.'
  if (t === 'timeout' || e?.message === 'timeout') return 'La conexión tardó demasiado. Puede que tu red bloquee conexiones directas.'
  return 'No se pudo conectar.'
}
