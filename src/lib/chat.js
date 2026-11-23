// Lógica del acompañamiento: IA de Groq si hay clave; respuestas básicas si no.
import { useState, useCallback } from 'react'
import { getState, setState, uid, useStore } from './store'
import { chatComplete, hasKey, SYSTEM_PROMPT, explainError } from './groq'
import { detectCrisis, CRISIS_REPLY } from './crisis'
import { EMOTIONS } from './emotions'
import { norm } from './intents'
import { toast } from '../components/Toast'

function fallbackReply(text) {
  const t = norm(text)
  const e = EMOTIONS.find((x) => x.re.test(t))
  if (e?.id === 'ansiedad') return 'Suena a que hay mucha presión ahora. Si quieres, hagamos juntos un minuto de respiración 4-4: inhala, sostén y exhala contando hasta cuatro. ¿Qué es lo que más te preocupa?'
  if (e?.id === 'tristeza') return 'Siento que estés pasando por esto. Está bien sentirse así, y no tienes que resolverlo todo hoy. ¿Quieres contarme qué pasó, o prefieres escribirlo en tu diario?'
  if (e?.id === 'enojo') return 'El enojo nos avisa que algo nos importa. Antes de responder a alguien, una pausa de un minuto puede ayudarte. ¿Qué lo provocó?'
  if (e?.id === 'calma' || e?.id === 'esperanza') return 'Qué bueno leerte así. ¿Qué te ayudó hoy? Anotarlo en tu diario puede servirte en un día más difícil.'
  if (e?.id === 'confusion') return 'A veces todo se mezcla y cuesta ordenarlo. Vamos de a poco: ¿qué es lo primero que se te viene a la mente?'
  if (/\b(eres (un )?(psicolog|humano|persona|doctor))\b/.test(t)) return 'No, soy un asistente automático y no reemplazo a un profesional. Si quieres hablar con una persona, en SOS tienes a la Línea 113, opción 5, gratuita.'
  return 'Te leo. Gracias por contármelo. ¿Cómo te hace sentir eso? Si quieres, también podemos respirar un minuto o escribirlo en tu diario.'
}

export const SUGGESTIONS = ['Me siento con ansiedad por los exámenes', 'Tuve una pelea con mi familia', 'No puedo dormir', '¿Eres un psicólogo?']

export function useChat({ onReply } = {}) {
  const messages = useStore((s) => s.chat)
  const [busy, setBusy] = useState(false)
  const [crisis, setCrisis] = useState(false)

  const push = (m) => setState((s) => ({ chat: [...s.chat, { id: uid(), date: new Date().toISOString(), ...m }].slice(-120) }))

  const send = useCallback(
    async (raw, { spoken = false } = {}) => {
      const text = (raw || '').trim()
      if (!text || busy) return
      push({ role: 'user', content: text })

      if (detectCrisis(text)) {
        setCrisis(true)
        push({ role: 'assistant', content: CRISIS_REPLY, crisis: true })
        onReply?.(CRISIS_REPLY, { spoken, crisis: true })
        return
      }

      setBusy(true)
      let reply
      if (hasKey()) {
        const st = getState()
        const lastCheck = st.checkins[0]
        const ctx = lastCheck
          ? `Contexto: último check-in de la persona: ${lastCheck.emotions.join(', ')}, intensidad ${lastCheck.intensity}/5.`
          : ''
        const history = st.chat.slice(-12).map(({ role, content }) => ({ role, content }))
        try {
          reply = await chatComplete([{ role: 'system', content: SYSTEM_PROMPT + (ctx ? `\n${ctx}` : '') }, ...history])
        } catch (e) {
          toast(explainError(e), { tone: 'warn', duration: 4500 })
          reply = fallbackReply(text)
        }
      } else {
        await new Promise((r) => setTimeout(r, 450))
        reply = fallbackReply(text)
      }
      setBusy(false)
      push({ role: 'assistant', content: reply })
      onReply?.(reply, { spoken })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, onReply]
  )

  const clear = () => {
    setState({ chat: [] })
    setCrisis(false)
  }

  return { messages, busy, crisis, setCrisis, send, clear }
}
