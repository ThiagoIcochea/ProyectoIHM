// Lógica del acompañamiento: IA de Groq si hay clave; respuestas básicas si no.
import { useState, useCallback } from 'react'
import { getState, setState, uid, useStore } from './store'
import { chatComplete, hasKey, SYSTEM_PROMPT, explainError } from './groq'
import { detectCrisis, CRISIS_REPLY } from './crisis'
import { EMOTIONS } from './emotions'
import { norm } from './intents'
import { reflectReply, replyActions } from './reflect'
import { toast } from '../components/Toast'

// ---------- Respuestas sin IA: por tema, sin repetirse y con una acción concreta ----------
const pick = (arr, avoid = []) => {
  const fresh = arr.filter((x) => !avoid.includes(x))
  const pool = fresh.length ? fresh : arr
  return pool[Math.floor(Math.random() * pool.length)]
}

const TOPICS = [
  { id: 'saludo', re: /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/, replies: ['¡Hola! Qué bueno que estés aquí. ¿Cómo va tu día?', 'Hola. Este es un espacio tranquilo para ti. ¿Qué te gustaría contarme hoy?', 'Hola, te escucho. ¿Cómo te sientes en este momento?'] },
  { id: 'gracias', re: /\b(gracias|grax|te agradezco)\b/, replies: ['Gracias a ti por confiar. Aquí estaré cuando lo necesites.', 'De nada. Si quieres, puedes anotar en tu diario algo que te haya ayudado hoy.', 'Me alegra acompañarte. ¿Hay algo más que te esté dando vueltas?'] },
  { id: 'examenes', re: /\b(examen\w*|prueba\w*|parcial\w*|final\w*|notas?|tareas?|estudi\w*|colegio|universidad|clases?|profe\w*|jalar|jale)\b/, replies: ['Los exámenes pueden sentirse como una montaña. Dividirlo ayuda: ¿qué curso o tema te preocupa más ahora mismo?', 'Es normal sentir presión con los estudios, pero tu valor no depende de una nota. ¿Cuánto tiempo tienes antes de la evaluación?', 'Cuando la mente está saturada cuesta concentrarse. Un minuto de respiración antes de estudiar puede ayudarte a ordenarte. ¿Lo probamos?'], actions: ['respirar'] },
  { id: 'familia', re: /\b(familia|mama|papa|mamá|papá|padres|hermano\w*|hermana\w*|casa|tio|tia|abuel\w*)\b/, replies: ['Los problemas en casa pesan mucho porque es donde esperamos sentirnos seguros. ¿Qué pasó?', 'Suena difícil. ¿Hay alguien en tu familia con quien sientas que sí puedes hablar?', 'Gracias por contármelo. Cuando las emociones bajen un poco, puede servir escribir lo que te gustaría decirles. ¿Quieres intentarlo en tu diario?'], actions: ['diario'] },
  { id: 'amigos', re: /\b(amig\w*|grupo|me dejaron de lado|me ignoran|pelea\w*|discuti\w*)\b/, replies: ['Sentirse fuera del grupo duele de verdad. ¿Desde cuándo te sientes así con ellos?', 'Las peleas con amigos pueden dar vueltas en la cabeza todo el día. ¿Qué crees que necesitas ahora: entender qué pasó o calmarte primero?', 'Tiene sentido que te afecte; esas personas te importan. ¿Quieres contarme qué pasó?'] },
  { id: 'pareja', re: /\b(enamorad\w*|novi[oa]|pareja|ex|terminamos|me termino|me gusta alguien|crush)\b/, replies: ['Las rupturas y los desamores pueden doler muchísimo. ¿Cómo lo estás llevando estos días?', 'Lo que sientes es válido, aunque otros digan que “ya pasará”. ¿Qué es lo que más extrañas o te preocupa?', 'Gracias por contármelo. ¿Tienes a alguien cerca con quien desahogarte?'] },
  { id: 'bullying', re: /\b(bullying|acoso|me molestan|se burlan|me pegan|me insultan|ciberacoso)\b/, replies: ['Nadie merece que lo traten así, y no es tu culpa. ¿Hay un adulto de confianza o tutor al que puedas contarle?', 'Lo que describes es acoso y es importante que no lo cargues solo. En Pausa segura tienes un mensaje listo para pedir ayuda a un adulto.'], actions: ['sos'] },
  { id: 'dormir', re: /\b(dormir|duermo|insomnio|desvel\w*|no puedo dormir|pesadillas?|cansad\w*|agotad\w*)\b/, replies: ['Cuando la mente no se apaga cuesta mucho dormir. Una respiración lenta 4-4 puede ayudar al cuerpo a bajar el ritmo. ¿La hacemos?', 'El cansancio lo hace todo más difícil. ¿Hay algo que te esté dando vueltas en la cabeza por las noches?', 'Escribir antes de dormir lo que te preocupa ayuda a “sacarlo” de la cabeza. ¿Quieres probar con tu diario?'], actions: ['respirar', 'diario'] },
  { id: 'soledad', re: /\b(sol[oa]|soledad|nadie me (entiende|quiere|escucha)|aislad\w*|no tengo amigos)\b/, replies: ['Sentirse solo es muy pesado. Me alegra que me lo cuentes; aquí te escucho. ¿Desde cuándo te sientes así?', 'Aunque ahora no lo parezca, hay personas que querrían saber cómo estás. ¿Hay alguien, aunque sea una, con quien te sientas un poco más cómodo?'], actions: ['sos'] },
  { id: 'autoestima', re: /\b(no sirvo|soy un fracaso|me odio|soy fe[oa]|no valgo|inutil|todo me sale mal)\b/, replies: ['Esa voz que te dice eso suele ser muy dura, más de lo que le dirías a un amigo. ¿Qué le dirías tú a alguien que quieres si se sintiera así?', 'Lo que sientes es real, pero no define quién eres. ¿Qué pasó hoy que te hizo sentir así?'] },
  { id: 'ansiedad', re: /\b(ansie\w*|nervios\w*|preocupad\w*|estres\w*|panico|me late (rapido|fuerte)|no puedo respirar|agobi\w*)\b/, replies: ['Suena a que hay mucha presión ahora. Si quieres, hagamos juntos un minuto de respiración 4-4. ¿Qué es lo que más te preocupa?', 'Cuando la ansiedad sube, el cuerpo se acelera. Probemos algo: nombra tres cosas que puedes ver a tu alrededor. ¿Cuáles son?', 'Estás a salvo en este momento. Respira lento conmigo: inhala contando hasta cuatro, sostén y exhala. ¿Qué la disparó hoy?'], actions: ['respirar'] },
  { id: 'tristeza', re: /\b(triste\w*|tristeza|llor\w*|bajon|deprimid\w*|desanimad\w*|mal)\b/, replies: ['Siento que estés pasando por esto. No tienes que resolverlo todo hoy. ¿Quieres contarme qué pasó?', 'Está bien sentirse así. A veces ayuda ponerle nombre: ¿es más tristeza, cansancio o decepción?', 'Gracias por compartirlo. ¿Hubo algo hoy, aunque sea pequeño, que te hiciera sentir un poco mejor?'], actions: ['diario'] },
  { id: 'enojo', re: /\b(enoj\w*|rabia|molest\w*|colera|furi\w*|odio)\b/, replies: ['El enojo nos avisa que algo nos importa o que se cruzó un límite. ¿Qué lo provocó?', 'Antes de responder a alguien cuando estás así, una pausa de un minuto ayuda. ¿Quieres respirar conmigo primero?'], actions: ['respirar'] },
  { id: 'bien', re: /\b(bien|feliz|content\w*|tranquil\w*|alegr\w*|mejor|calma|esperanza|relajad\w*)\b/, replies: ['¡Qué bueno leerte así! ¿Qué te ayudó hoy? Anotarlo puede servirte en un día difícil.', 'Me alegra mucho. ¿Quieres guardar este momento en tu diario?'], actions: ['diario'] },
  { id: 'quien', re: /\b(eres (un )?(psicolog\w*|humano|persona|doctor|real|bot|ia)|quien eres|que eres)\b/, replies: ['Soy un asistente automático, no un psicólogo ni una persona. Puedo escucharte y sugerirte herramientas, y en SOS tienes la Línea 113, opción 5, con profesionales.'], actions: ['sos'] },
  { id: 'consejo', re: /\b(que hago|que debo hacer|ayudame|ayuda|no se que hacer|algun consejo)\b/, replies: ['Vamos paso a paso. Cuéntame un poco más: ¿qué es lo que más te preocupa ahora mismo?', 'Podemos verlo juntos. Primero, ¿te ayudaría calmarte un minuto o prefieres contarme qué está pasando?'], actions: ['respirar', 'sos'] }
]
const GENERIC = [
  'Te leo. ¿Qué parte de eso es la que más te pesa?',
  'Gracias por contarme. ¿Desde cuándo te sientes así?',
  'Entiendo. Si tuvieras que ponerle un nombre a lo que sientes, ¿cuál sería?',
  'Estoy aquí contigo. ¿Qué necesitarías en este momento: desahogarte, calmarte o pensar qué hacer?',
  '¿Y eso cómo te ha afectado en tu día a día?',
  'Tiene sentido que te sientas así. Cuéntame un poco más, sin apuro.'
]

export function fallbackReply(text) {
  return { content: reflectReply(text), actions: replyActions(text) }
}

const ACTION_HINT = /\b(respir\w*)\b/i
function actionsFor(reply) {
  const a = []
  if (ACTION_HINT.test(reply)) a.push('respirar')
  if (/\bdiario\b/i.test(reply)) a.push('diario')
  if (/\b(113|sos|pausa segura|adulto de confianza)\b/i.test(reply)) a.push('sos')
  return a
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
          const content = await chatComplete([{ role: 'system', content: SYSTEM_PROMPT + (ctx ? `\n${ctx}` : '') }, ...history])
          reply = { content, actions: actionsFor(content), ai: true }
        } catch (e) {
          toast(explainError(e), { tone: 'warn', duration: 6000 })
          reply = fallbackReply(text, st.chat)
        }
      } else {
        await new Promise((r) => setTimeout(r, 450))
        reply = fallbackReply(text, getState().chat)
      }
      setBusy(false)
      push({ role: 'assistant', ...reply })
      onReply?.(reply.content, { spoken })
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
