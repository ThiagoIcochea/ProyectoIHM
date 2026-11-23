// Estado global mínimo, persistido en localStorage del propio navegador.
// Nada sale del dispositivo salvo los mensajes que se envían a la IA (Groq) si el usuario configuró su clave.
import { useSyncExternalStore } from 'react'

const KEY = 'escucha.v1'

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

function load() {
  try {
    const raw = localStorage.getItem(KEY)
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

export function resetAll() {
  state = { ...defaults }
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
