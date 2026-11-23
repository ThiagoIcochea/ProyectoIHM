// Cliente mínimo para la API de Groq (compatible con OpenAI).
// La clave NUNCA se guarda en el repositorio: el usuario la pega en Perfil → Inteligencia artificial
// (se guarda solo en su navegador) o la define en un .env local como VITE_GROQ_API_KEY.
import { getState } from './store'

const BASE = 'https://api.groq.com/openai/v1'
export const CHAT_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
export const FAST_MODEL = 'llama-3.1-8b-instant'
export const STT_MODEL = 'whisper-large-v3-turbo'

export function getKey() {
  return (getState().groqKey || import.meta.env.VITE_GROQ_API_KEY || '').trim()
}
export const hasKey = () => getKey().length > 10

export const SYSTEM_PROMPT = `Eres "Escucha", un asistente de acompañamiento emocional para adolescentes y jóvenes de 12 a 21 años en Perú.
Reglas:
- Responde en español de Perú, cálido, breve (2 a 4 oraciones), sin juicios y sin diagnósticos.
- No eres psicólogo ni profesional de salud. Si te lo preguntan, dilo con claridad.
- Valida la emoción, haz como máximo una pregunta abierta y sugiere, si encaja, una herramienta de la app: respiración guiada (1 minuto), diario emocional, pausa segura o hablar con un adulto de confianza.
- Si hay señales de riesgo (autolesión, suicidio, violencia, abuso), prioriza la seguridad: anima a contactar ya a un adulto de confianza o a la Línea 113 opción 5 (gratuita, 24 horas). Nunca des métodos ni detalles de autolesión.
- No pidas datos personales (nombre real, dirección, colegio).
- No uses emojis.`

async function post(path, body, signal) {
  const key = getKey()
  if (!key) throw new Error('NO_KEY')
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
  const key = getKey()
  if (!key) throw new Error('NO_KEY')
  const fd = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  fd.append('file', blob, `voz.${ext}`)
  fd.append('model', STT_MODEL)
  fd.append('language', 'es')
  fd.append('response_format', 'json')
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
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
  if (e.name === 'TypeError') return 'No hay conexión con la IA. Revisa tu internet.'
  return 'La IA no respondió. Usaré respuestas básicas mientras tanto.'
}
