// Estado global mínimo, persistido en localStorage del propio navegador.
// Cada cuenta local guarda sus datos en su propia clave; el modo invitado usa 'escucha.v1'.
// Nada sale del dispositivo salvo los mensajes que se envían a la IA (Groq) si el usuario la configuró.
import { useSyncExternalStore } from 'react'

export const SESSION_KEY = 'escucha.session'
export const dataKey = (id) => (!id || id === 'guest' ? 'escucha.v1' : `escucha.v1.${id}`)
function readSession() {
  try { return localStorage.getItem(SESSION_KEY) || 'guest' } catch { return 'guest' }
}
let session = readSession()
let KEY = dataKey(session)

const defaults = {
  onboarded: false,
  coachDone: false,
  alias: '',
  theme: 'system', // system | light | dark
  textScale: 100, // 100 | 130 | 160 | 200
  highContrast: false,
  reduceMotion: false,
  tts: true, // leer respuestas en voz alta
  captions: true, // subtítulos de lo que se escucha
  handsFree: false,
  avatar: null,
  wakeWord: false,
  groqKey: '',
  checkins: [], // {id, date, emotions[], intensity, note}
  journal: [], // {id, date, mood, text}
  chat: [], // {id, role, content, date, crisis?}
  iot: {
    lamp: { on: false, mode: 'calma', level: 70 },
    speaker: { on: false, sound: 'lluvia', volume: 50 },
    diffuser: { on: false, level: 2 },
    band: { source: 'sim', bpm: 78, stress: 0 },
    automation: true
  }
}

function load(key = KEY) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...defaults }
    const saved = JSON.parse(raw)
    return { ...defaults, ...saved, iot: { ...defaults.iot, ...(saved.iot || {}) } }
  } catch {
    return { ...defaults }
  }
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* modo privado o almacenamiento bloqueado: la app sigue funcionando en memoria */
  }
}

export function getState() {
  return state
}

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  persist()
  listeners.forEach((l) => l())
}

export function setIot(device, patch) {
  setState((s) => ({ iot: { ...s.iot, [device]: typeof patch === 'boolean' ? patch : { ...s.iot[device], ...patch } } }))
}

export function resetAll(keep = {}) {
  state = { ...defaults, ...keep }
  persist()
  listeners.forEach((l) => l())
}

export const getSession = () => session

// Cambia de cuenta: guarda la actual, carga la nueva y avisa a la interfaz
export function switchSession(id, { carry } = {}) {
  persist()
  session = id || 'guest'
  KEY = dataKey(session)
  try { localStorage.setItem(SESSION_KEY, session) } catch { /* sin almacenamiento */ }
  const loaded = load()
  state = carry ? { ...loaded, ...carry } : loaded
  persist()
  listeners.forEach((l) => l())
}

export function snapshot() {
  return state
}
export function defaultState() {
  return { ...defaults }
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
