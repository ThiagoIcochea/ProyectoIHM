// Wayra, la viscacha: compañera de la sala personal que ayuda a pensar con preguntas, sin dar sermones.
import { chatComplete, hasKey } from './groq'
import { detectCrisis, CRISIS_REPLY } from './crisis'
import { norm } from './intents'

const PROMPT = `Eres Wayra, una viscacha andina amable que acompaña a adolescentes y jóvenes en Perú dentro de un espacio de calma en realidad virtual.
Tu papel es ayudar a pensar, no aconsejar ni diagnosticar:
- Responde en español de Perú, cálido y sencillo, en 1 a 3 oraciones cortas (se leerán en voz alta).
- Refleja en tus palabras lo que la persona dijo y haz UNA pregunta abierta que la ayude a ordenar sus ideas (por ejemplo: qué es lo que más le pesa, qué está en sus manos, qué haría una persona que la quiere, cuál sería un paso pequeño).
- Si se queda en blanco, propón respirar juntos o nombrar tres cosas que ve.
- Puedes mencionar con ternura algo de los Andes (las rocas, el viento, el sol) muy de vez en cuando.
- No eres psicóloga. Si hay riesgo (autolesión, suicidio, violencia, abuso), pide hablar ya con un adulto de confianza o con la Línea 113 opción 5.
- Sin emojis, sin listas.`

const history = []

const FALLBACK = [
  { re: /\b(no se|confundid\w*|perdid\w*|no entiendo)\b/, a: ['Está bien no saberlo todavía. Si lo dividimos en partes, ¿cuál sería la primera pieza?', 'A veces la mente es como neblina en la puna. ¿Qué es lo único que sí tienes claro ahora?'] },
  { re: /\b(examen\w*|estudi\w*|colegio|universidad|tarea\w*|notas?)\b/, a: ['Suena a mucha presión con los estudios. ¿Qué parte depende de ti y cuál no?', 'Si tuvieras que elegir un solo paso pequeño para hoy, ¿cuál sería?'] },
  { re: /\b(familia|mama|papa|herman\w*|casa)\b/, a: ['Lo que pasa en casa pesa mucho. ¿Qué te gustaría que ellos entendieran de ti?', 'Si pudieras decirles una sola frase sin que se enojen, ¿cuál sería?'] },
  { re: /\b(amig\w*|pareja|enamorad\w*|grupo)\b/, a: ['Las personas que queremos también nos duelen a veces. ¿Qué necesitarías de esa relación ahora?', '¿Qué le dirías a un amigo que estuviera viviendo lo mismo?'] },
  { re: /\b(ansie\w*|nervios\w*|miedo|preocup\w*|estres\w*)\b/, a: ['Respiremos un momento, como el viento que baja de la montaña: inhala en cuatro, suelta en cuatro. ¿Qué es lo que más te preocupa?', 'Tu cuerpo está en alerta. ¿Qué podrías hacer en los próximos diez minutos para sentirte un poco más seguro?'] },
  { re: /\b(triste\w*|llor\w*|sol[oa]|vac[ií]o|mal)\b/, a: ['Gracias por contármelo. ¿Desde cuándo te sientes así?', 'Está bien estar triste. ¿Hay alguien con quien te sientas un poco más acompañado?'] },
  { re: /\b(bien|mejor|feliz|tranquil\w*|calma)\b/, a: ['¡Qué bonito escucharte así! ¿Qué ayudó a que hoy fuera un mejor día?', 'Guarda este momento como una piedrita en el bolsillo. ¿Qué te gustaría recordar de hoy?'] }
]
const GENERIC = ['Cuéntame un poco más. ¿Qué es lo que más te importa de eso?', 'Te escucho. Si lo miras desde lejos, como desde lo alto de una roca, ¿qué ves distinto?', '¿Y qué crees que necesitas ahora: entenderlo, soltarlo o hacer algo al respecto?']

let last = ''
function pick(arr) {
  const options = arr.filter((x) => x !== last)
  last = options[Math.floor(Math.random() * options.length)] || arr[0]
  return last
}

export const WAYRA_GREETING = 'Hola, soy Wayra. Vivo entre las rocas de los Andes y me gusta pensar despacio. ¿Qué tienes en mente hoy?'

export async function askWayra(text) {
  const t = (text || '').trim()
  if (!t) return pick(GENERIC)
  if (detectCrisis(t)) return CRISIS_REPLY
  history.push({ role: 'user', content: t })
  let reply
  if (hasKey()) {
    try {
      reply = await chatComplete([{ role: 'system', content: PROMPT }, ...history.slice(-10)], { maxTokens: 160 })
    } catch { /* sin IA: respuesta local */ }
  }
  if (!reply) {
    const n = norm(t)
    const hit = FALLBACK.find((f) => f.re.test(n))
    reply = pick(hit ? hit.a : GENERIC)
  }
  history.push({ role: 'assistant', content: reply })
  return reply
}
