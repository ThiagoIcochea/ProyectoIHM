// Cliente mínimo para la API de Groq (compatible con OpenAI).
// La clave NUNCA se guarda en el repositorio: el usuario la pega en Perfil → Inteligencia artificial
// (se guarda solo en su navegador) o la define en un .env local como VITE_GROQ_API_KEY.
import { getState } from './store'

const DIRECT = 'https://api.groq.com/openai/v1'
const DEVICE_KEY = 'escucha.groq'
const PROXY_KEY = 'escucha.groqProxy'
const ls = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }

// Proxy opcional (por ejemplo, el Cloudflare Worker de /proxy): guarda la clave en el servidor y no en el navegador
export function getProxy() {
  return (ls(PROXY_KEY) || import.meta.env.VITE_GROQ_PROXY || '').trim().replace(/\/$/, '')
}
export function setProxy(url) {
  try { url ? localStorage.setItem(PROXY_KEY, url.trim()) : localStorage.removeItem(PROXY_KEY) } catch { /* nada */ }
}
const base = () => getProxy() || DIRECT
export const CHAT_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
export const FAST_MODEL = 'llama-3.1-8b-instant'
export const STT_MODEL = 'whisper-large-v3-turbo'

export function getKey() {
  return (getState().groqKey || ls(DEVICE_KEY) || import.meta.env.VITE_GROQ_API_KEY || '').trim()
}
// La clave es del dispositivo (sirve para todas las cuentas de este navegador)
export function setDeviceKey(k) {
  try { k ? localStorage.setItem(DEVICE_KEY, k) : localStorage.removeItem(DEVICE_KEY) } catch { /* nada */ }
}
export const hasKey = () => !!getProxy() || getKey().length > 10
export const aiSource = () => (getProxy() ? 'proxy' : getState().groqKey || ls(DEVICE_KEY) ? 'clave' : import.meta.env.VITE_GROQ_API_KEY ? 'despliegue' : null)
const authHeaders = () => {
  const key = getKey()
  if (getProxy()) return key ? { Authorization: `Bearer ${key}` } : {}
  if (!key) throw new Error('NO_KEY')
  return { Authorization: `Bearer ${key}` }
}

export const SYSTEM_PROMPT = `Eres "Escucha", un asistente de acompañamiento emocional para adolescentes y jóvenes de 12 a 21 años en Perú.
Reglas:
- Responde en español de Perú, cálido, breve (2 a 4 oraciones), sin juicios y sin diagnósticos.
- No eres psicólogo ni profesional de salud. Si te lo preguntan, dilo con claridad.
- Valida la emoción, haz como máximo una pregunta abierta y sugiere, si encaja, una herramienta de la app: respiración guiada (1 minuto), diario emocional, pausa segura o hablar con un adulto de confianza.
- Si hay señales de riesgo (autolesión, suicidio, violencia, abuso), prioriza la seguridad: anima a contactar ya a un adulto de confianza o a la Línea 113 opción 5 (gratuita, 24 horas). Nunca des métodos ni detalles de autolesión.
- No pidas datos personales (nombre real, dirección, colegio).
- No uses emojis.
- Responde a lo que la persona acaba de decir, con sus propios detalles. No repitas literalmente su mensaje ni tus respuestas anteriores; si ya preguntaste algo, avanza a otra pregunta.`

async function post(path, body, signal) {
  const res = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`HTTP_${res.status}`)
    err.detail = txt
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function chatComplete(messages, { json = false, models = CHAT_MODELS, maxTokens = 400, signal } = {}) {
  let lastErr
  for (const model of models) {
    try {
      const body = { model, messages, temperature: json ? 0 : 0.7, max_tokens: maxTokens }
      if (json) body.response_format = { type: 'json_object' }
      const data = await post('/chat/completions', body, signal)
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (text) return text
    } catch (e) {
      lastErr = e
      if (e.message === 'NO_KEY' || e.status === 401 || e.name === 'AbortError') throw e
    }
  }
  throw lastErr || new Error('EMPTY')
}

export async function transcribe(blob) {
  const headers = authHeaders()
  const fd = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  fd.append('file', blob, `voz.${ext}`)
  fd.append('model', STT_MODEL)
  fd.append('language', 'es')
  fd.append('response_format', 'json')
  const res = await fetch(`${base()}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: fd
  })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const data = await res.json()
  return (data.text || '').trim()
}

export async function testKey() {
  const t = await chatComplete([{ role: 'user', content: 'Responde solo: ok' }], { models: [FAST_MODEL], maxTokens: 5 })
  return !!t
}

export function explainError(e) {
  if (!e) return 'Ocurrió un error.'
  if (e.message === 'NO_KEY') return 'Falta la clave de Groq. Agrégala en Perfil → Inteligencia artificial.'
  if (e.status === 401) return 'La clave de Groq no es válida. Revísala en Perfil.'
  if (e.status === 429) return 'La IA recibió muchas solicitudes. Espera unos segundos e inténtalo otra vez.'
  if (e.name === 'TypeError')
    return getProxy()
      ? 'No se pudo conectar con el proxy de IA. Revisa la dirección en Perfil.'
      : 'El navegador no pudo conectarse con Groq (sin internet o conexión bloqueada por el navegador). Si persiste, configura un proxy en Perfil → Inteligencia artificial.'
  return 'La IA no respondió. Usaré respuestas básicas mientras tanto.'
}

// Visión: describe una imagen y devuelve JSON (para crear personajes a partir de una foto o dibujo)
export const VISION_MODELS = ['qwen/qwen3.8-27b', 'meta-llama/llama-4-scout-17b-16e-instruct']
export async function visionJSON(prompt, dataUrl) {
  let lastErr
  for (const model of VISION_MODELS) {
    for (const json of [true, false]) {
      try {
        const body = {
          model,
          temperature: 0.2,
          max_tokens: 400,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }]
        }
        if (json) body.response_format = { type: 'json_object' }
        const data = await post('/chat/completions', body)
        const text = (data?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
        const m = text.match(/\{[\s\S]*\}/)
        if (m) return JSON.parse(m[0])
      } catch (e) {
        lastErr = e
        if (e.message === 'NO_KEY' || e.status === 401) throw e
      }
    }
  }
  throw lastErr || new Error('EMPTY')
}
