// Respuestas sin IA que sí siguen lo que la persona dice: escucha reflexiva.
// Toma la frase, la devuelve en segunda persona ("estoy cansada" → "estás cansada"),
// detecta el tema y responde con una pregunta distinta cada vez, sin repetir lo dicho antes.
import { norm } from './intents'

const SWAP = [
  [/\byo\b/g, 'tú'], [/\bme\b/g, 'te'], [/\bmi\b/g, 'tu'], [/\bmis\b/g, 'tus'], [/\bmio\b/g, 'tuyo'], [/\bmia\b/g, 'tuya'], [/\bconmigo\b/g, 'contigo'],
  [/\bestoy\b/g, 'estás'], [/\bsoy\b/g, 'eres'], [/\btengo\b/g, 'tienes'], [/\bsiento\b/g, 'sientes'], [/\bquiero\b/g, 'quieres'], [/\bpuedo\b/g, 'puedes'],
  [/\bnecesito\b/g, 'necesitas'], [/\bpienso\b/g, 'piensas'], [/\bcreo\b/g, 'crees'], [/\bse\b(?= que)/g, 'sabes'], [/\bhice\b/g, 'hiciste'], [/\bfui\b/g, 'fuiste'],
  [/\bvoy\b/g, 'vas'], [/\bsaco\b/g, 'sacas'], [/\bdigo\b/g, 'dices'], [/\bsalgo\b/g, 'sales'], [/\bvivo\b/g, 'vives'], [/\bestudio\b/g, 'estudias'],
  [/\btrabajo\b/g, 'trabajas'], [/\bllego\b/g, 'llegas'], [/\bjuego\b/g, 'juegas'], [/\bhablo\b/g, 'hablas'], [/\bextraño\b/g, 'extrañas'], [/\bsé\b/g, 'sabes'], [/\bno sé\b/g, 'no sabes'], [/\bhago\b/g, 'haces'], [/\bodio\b/g, 'odias'], [/\bextrano\b/g, 'extrañas'], [/\bpaso\b/g, 'pasó'], [/\bduermo\b/g, 'duermes'], [/\bentiendo\b/g, 'entiendes']
]
function toSecondPerson(t) {
  let s = ` ${t} `
  SWAP.forEach(([re, rep]) => { s = s.replace(re, rep) })
  return s.trim()
}

// Fragmento corto y significativo para reflejar (sin muletillas)
function fragment(raw) {
  // Se conservan las tildes para que el reflejo se lea natural
  let t = String(raw).toLowerCase().replace(/[¿?¡!.,;:"]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(bueno|pues|o sea|osea|mira|la verdad|es que|hola|oye|ay)\s+/g, '')
  t = t.split(/\b(pero|porque|y entonces)\b/)[0].trim()
  const words = t.split(' ').filter(Boolean)
  if (words.length < 3) return ''
  return toSecondPerson(words.slice(0, 14).join(' '))
}

const TOPICS = [
  { id: 'riesgo_suave', re: /\b(no aguanto|ya no puedo|me rindo|estoy harto|estoy harta)\b/, q: ['Suena a que llegaste al límite. ¿Hay alguien cerca con quien puedas estar ahora?', '¿Qué es lo que más te está desbordando en este momento?'] },
  { id: 'familia', re: /\b(familia|mama|papa|padres|herman\w*|casa|tio|tia|abuel\w*|padrastro|madrastra)\b/, q: ['¿Qué pasó en casa?', '¿Qué te gustaría que ellos entendieran de ti?', '¿Hay alguien en tu familia con quien te sientas más cómodo?', '¿Cómo reaccionaste tú en ese momento?'] },
  { id: 'estudios', re: /\b(examen\w*|prueba\w*|parcial\w*|notas?|tareas?|estudi\w*|colegio|universidad|curso\w*|profe\w*|jal\w*)\b/, q: ['¿Qué curso o tema te preocupa más?', '¿Qué parte depende de ti y cuál no?', 'Si lo dividieras en un paso pequeño para hoy, ¿cuál sería?', '¿Cómo te sueles preparar cuando te va bien?'] },
  { id: 'amigos', re: /\b(amig\w*|grupo|compañer\w*|me ignoran|me dejaron|pelea\w*|discuti\w*)\b/, q: ['¿Qué es lo que más te duele de esa situación?', '¿Qué necesitarías de esa amistad ahora?', '¿Qué le dirías si pudieras hablarle con calma?'] },
  { id: 'pareja', re: /\b(enamorad\w*|novi[oa]|pareja|ex|terminamos|me termino|crush|me gusta)\b/, q: ['¿Cómo lo estás llevando estos días?', '¿Qué es lo que más extrañas o lo que más te duele?', '¿Qué te ayudaría a cuidarte mientras pasa?'] },
  { id: 'acoso', re: /\b(bullying|acoso|me molestan|se burlan|me pegan|me insultan|ciberacoso)\b/, q: ['Eso no es tu culpa. ¿Hay un adulto o tutor al que puedas contárselo?', '¿Desde cuándo pasa? En Pausa segura tienes un mensaje listo para pedir ayuda.'] },
  { id: 'sueno', re: /\b(dormir|duermo|insomnio|desvel\w*|pesadilla\w*|cansad\w*|agotad\w*)\b/, q: ['¿Qué te da vueltas en la cabeza por las noches?', '¿Desde cuándo duermes así?', '¿Probamos un minuto de respiración lenta antes de dormir?'] },
  { id: 'soledad', re: /\b(sol[oa]|soledad|nadie me|aislad\w*|no tengo amigos|invisible)\b/, q: ['¿En qué momentos lo sientes más?', '¿Hay alguna persona, aunque sea una, con quien te sientas un poco acompañado?', '¿Qué te gustaría que pasara para sentirte menos solo?'] },
  { id: 'autoestima', re: /\b(no sirvo|fracas\w*|me odio|fe[oa]|no valgo|inutil|todo me sale mal|tont[oa])\b/, q: ['¿Le dirías lo mismo a un amigo que estuviera así?', '¿Qué pasó hoy que te hizo pensar eso de ti?', 'Nombra una cosa, aunque sea pequeña, que hiciste bien esta semana.'] },
  { id: 'ansiedad', re: /\b(ansie\w*|nervios\w*|preocup\w*|estres\w*|panico|miedo|agobi\w*|me late)\b/, q: ['¿Qué es lo que más te preocupa ahora mismo?', 'Probemos algo: nombra tres cosas que puedes ver a tu alrededor.', '¿En qué parte del cuerpo lo sientes?', '¿Qué te ha ayudado otras veces a calmarte?'] },
  { id: 'tristeza', re: /\b(triste\w*|llor\w*|bajon|deprimid\w*|desanimad\w*|vacio|mal)\b/, q: ['¿Desde cuándo te sientes así?', '¿Es más tristeza, cansancio o decepción?', '¿Hubo algo hoy que lo hiciera más fuerte?'] },
  { id: 'enojo', re: /\b(enoj\w*|rabia|molest\w*|colera|furi\w*|odio)\b/, q: ['¿Qué fue lo que más te molestó?', '¿Qué límite sientes que cruzaron?', '¿Qué te gustaría hacer con ese enojo sin que te haga daño?'] },
  { id: 'bien', re: /\b(bien|feliz|content\w*|tranquil\w*|alegr\w*|mejor|calma|emocionad\w*)\b/, q: ['¿Qué ayudó a que hoy fuera así?', '¿Con quién te gustaría compartirlo?', '¿Qué quieres recordar de este momento?'] }
]
const ACKS = ['Te entiendo.', 'Gracias por contármelo.', 'Tiene sentido.', 'Te escucho.', 'Eso suena importante.', 'Ya veo.']
const GENERIC_Q = ['¿Qué parte de eso te pesa más?', '¿Y cómo te hace sentir?', '¿Qué pasó después?', '¿Qué necesitarías ahora mismo?', '¿Qué crees que podrías hacer al respecto?', 'Cuéntame un poco más.']

const state = { usedQ: new Set(), lastAck: '', lastTopic: '', turns: 0 }
const pick = (arr, used) => {
  const fresh = arr.filter((x) => !used.has(x))
  const choice = (fresh.length ? fresh : arr)[Math.floor(Math.random() * (fresh.length || arr.length))]
  used.add(choice)
  if (used.size > 40) used.clear()
  return choice
}

export function reflectReply(raw, { voice = 'asistente' } = {}) {
  const t = norm(raw)
  state.turns++
  // Respuestas cortas: se apoyan en el tema anterior
  if (/^(si|sí|claro|ya|ok|okay|aja)$/.test(t)) return pick(['Bien. ¿Qué te gustaría contar primero?', 'Perfecto, te escucho. ¿Por dónde empezamos?', 'Vamos con calma. ¿Qué es lo primero que se te viene a la mente?'], state.usedQ)
  if (/^(no|nada|no se|nose|no lo se|ni idea)$/.test(t)) return pick(['Está bien no saberlo. ¿Te ayudaría respirar un minuto conmigo primero?', 'No pasa nada. A veces ayuda empezar por cómo está tu cuerpo: ¿cómo lo sientes ahora?', 'Podemos quedarnos un momento en silencio. Cuando quieras, dime una sola palabra de cómo estás.'], state.usedQ)
  if (/^(gracias|muchas gracias|grax)\b/.test(t)) return pick(['Gracias a ti por confiar. Aquí sigo.', 'Con gusto. ¿Hay algo más que te esté dando vueltas?'], state.usedQ)
  if (/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey)\b/.test(t) && t.split(' ').length <= 4) return pick([voice === 'wayra' ? '¡Hola! Aquí estoy, entre mis rocas. ¿Qué tienes en mente?' : 'Hola, qué bueno que estés aquí. ¿Cómo va tu día?', 'Hola. ¿Cómo te sientes en este momento?'], state.usedQ)
  if (/\b(quien eres|que eres|eres (un )?(robot|bot|ia|humano|persona|psicolog\w*))\b/.test(t)) return voice === 'wayra' ? 'Soy Wayra, una viscacha que ayuda a pensar. No soy psicóloga; si necesitas a una persona, en SOS está la Línea 113, opción 5.' : 'Soy un asistente automático, no una persona ni un psicólogo. Puedo escucharte y sugerirte herramientas; en SOS tienes la Línea 113, opción 5.'
  if (/\b(que hago|que puedo hacer|que debo hacer|no se que hacer|ayudame|algun consejo|que me recomiendas)\b/.test(t)) {
    return pick(['Pensémoslo juntos. ¿Qué opciones ves tú, aunque parezcan pequeñas?', 'Antes de decidir, ¿qué es lo que más te importa que salga bien?', 'Un paso a la vez: ¿qué podrías hacer en los próximos diez minutos para sentirte un poco mejor?'], state.usedQ)
  }

  const topic = TOPICS.find((x) => x.re.test(t))
  const frag = fragment(raw)
  let ack = ACKS.filter((a) => a !== state.lastAck)[Math.floor(Math.random() * (ACKS.length - 1))]
  state.lastAck = ack
  const reflection = frag && Math.random() > 0.25 ? (Math.random() > 0.5 ? `Dices que ${frag}.` : `Entonces ${frag}.`) : ''
  const q = pick(topic ? topic.q : GENERIC_Q, state.usedQ)
  state.lastTopic = topic?.id || ''
  const pre = voice === 'wayra' && Math.random() > 0.7 ? 'Mmm, déjame pensarlo como el viento en la puna. ' : ''
  return `${pre}${reflection ? `${ack} ${reflection}` : ack} ${q}`.replace(/\s+/g, ' ').trim()
}

export const replyActions = (text) => {
  const t = norm(text)
  const a = []
  if (/\b(ansie|nervios|estres|panico|dormir|enoj|rabia|respir)/.test(t)) a.push('respirar')
  if (/\b(triste|familia|pelea|escribir|diario)/.test(t)) a.push('diario')
  if (/\b(bullying|acoso|me pegan|no aguanto|ya no puedo)/.test(t)) a.push('sos')
  return a
}
