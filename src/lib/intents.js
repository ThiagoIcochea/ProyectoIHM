// Gramática de voz local (rápida, sin red). Si no reconoce la frase y hay clave de Groq,
// se pide a un modelo pequeño que clasifique la intención en JSON.
import { chatComplete, FAST_MODEL, hasKey } from './groq'

export const norm = (t = '') =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const DESTINATIONS = [
  { to: '/', label: 'Inicio', re: /\b(inicio|home|principal|pantalla principal)\b/ },
  { to: '/chat', label: 'Chat', re: /\b(chat|conversar|conversacion|asistente)\b/ },
  { to: '/respirar', label: 'Respiración', re: /\b(respir\w*|calma|calmarme|relaj\w*)\b/ },
  { to: '/diario', label: 'Diario', re: /\b(diario|bitacora|mis notas)\b/ },
  { to: '/checkin', label: 'Cómo me siento', re: /\b(como me siento|emocion\w*|estado de animo|check ?in|registrar emocion)\b/ },
  { to: '/ayuda', label: 'Ayuda y SOS', re: /\b(sos|emergencia|linea de ayuda|ayuda urgente|pausa segura|conexiones de ayuda)\b/ },
  { to: '/perfil', label: 'Perfil', re: /\b(perfil|ajustes|configuracion|accesibilidad)\b/ },
  { to: '/explorar', label: 'Explorar', re: /\b(explorar|modalidades|experiencias)\b/ },
  { to: '/m/reloj', label: 'Reloj', re: /\b(reloj|smartwatch|watch|wearable)\b/ },
  { to: '/m/plegable', label: 'Plegable', re: /\b(plegable|doble pantalla|dual|dos pantallas)\b/ },
  { to: '/m/voz', label: 'Modo voz', re: /\b(modo voz|solo voz|conversacion por voz|asistente de voz)\b/ },
  { to: '/m/iot', label: 'Hogar IoT', re: /\b(iot|hogar|mi casa|dispositivos|domotica|lampara|parlante|difusor|pulsera)\b/ },
  { to: '/m/inmersivo', label: 'Santuario VR', re: /\b(realidad virtual|realidad aumentada|vr|ar|inmersiv\w*|santuario|quest|vision pro)\b/ },
  { to: '/m/mapa', label: 'Mapa 3D', re: /\b(mapa|centros? de salud|hospital\w*|cerca de mi|donde ir)\b/ },
  { to: '/m/gestos', label: 'Gestos', re: /\b(gestos?|camara|con las manos)\b/ }
]

const NAV_VERB = /\b(ir a|ve a|vamos a|abre|abrir|abreme|llevame a|lleva me a|muestrame|mostrar|quiero ir a|entra a|entrar a|pasa a|cambia a|navega a)\b/

export function parseGlobal(raw) {
  const t = norm(raw)
  if (!t) return null

  if (/^(atras|volver|regresa\w*|vuelve|anterior)( por favor)?$/.test(t) || /\b(ir atras|pagina anterior)\b/.test(t)) return { type: 'back' }
  if (/\b(que puedo decir|comandos( de voz)?|ayuda de voz|como te uso)\b/.test(t)) return { type: 'help' }
  if (/\b(callate|silencio|deja de hablar|ya no hables|para de hablar)\b/.test(t)) return { type: 'silence' }
  if (/\b(deja de escuchar|apaga (el )?microfono|desactiva (la )?voz|terminar voz|adios escucha)\b/.test(t)) return { type: 'stop' }
  if (/\b(lee|leer|leeme|lea) (la |esta )?(pantalla|pagina)\b|\bque dice (la pantalla|aqui)\b/.test(t)) return { type: 'read' }
  if (/\b(modo|tema) oscuro\b|\bactiva (el )?oscuro\b/.test(t)) return { type: 'setting', key: 'theme', value: 'dark', say: 'Tema oscuro activado.' }
  if (/\b(modo|tema) claro\b/.test(t)) return { type: 'setting', key: 'theme', value: 'light', say: 'Tema claro activado.' }
  if (/\b(alto contraste)\b/.test(t)) return { type: 'toggle', key: 'highContrast', say: 'Cambié el alto contraste.' }
  if (/\b(aumenta|agranda|sube|mas grande)\b.*\b(texto|letra|letras)\b|\b(texto|letra) mas grande\b/.test(t)) return { type: 'textScale', dir: 1 }
  if (/\b(reduce|disminuye|achica|baja|mas pequen\w*)\b.*\b(texto|letra|letras)\b|\b(texto|letra) mas pequen\w*\b/.test(t)) return { type: 'textScale', dir: -1 }
  if (/\b(manos libres)\b/.test(t)) return { type: 'toggle', key: 'handsFree', say: 'Cambié el modo manos libres.' }

  // Crisis/SOS sin verbo de navegación
  if (/\b(necesito ayuda|ayudame|auxilio|sos|emergencia)\b/.test(t) && t.split(' ').length <= 5) return { type: 'navigate', to: '/ayuda', label: 'Ayuda y SOS' }

  const hasVerb = NAV_VERB.test(t)
  const short = t.split(' ').length <= 4
  if (hasVerb || short) {
    for (const d of DESTINATIONS) if (d.re.test(t)) return { type: 'navigate', to: d.to, label: d.label }
  }
  return null
}

// Comandos propios de cada pantalla (registrados con useVoiceCommands)
export function matchLocal(raw, commands = []) {
  const t = norm(raw)
  for (const c of commands) {
    const m = t.match(c.re)
    if (m) return { cmd: c, match: m, text: t }
  }
  return null
}

const AI_INTENT_PROMPT = `Clasifica la orden de voz de un usuario de la app "Escucha". Devuelve SOLO JSON.
Destinos válidos: ${DESTINATIONS.map((d) => d.to).join(', ')}.
Formato: {"intent":"navigate","to":"/respirar"} | {"intent":"back"} | {"intent":"chat","message":"texto"} | {"intent":"local","command":"<una de las órdenes locales>"} | {"intent":"none"}
Usa "chat" cuando la persona cuenta algo personal o pregunta algo que no es una orden.`

export async function classifyWithAI(raw, localLabels = []) {
  if (!hasKey()) return null
  try {
    const content = await chatComplete(
      [
        { role: 'system', content: AI_INTENT_PROMPT + (localLabels.length ? `\nÓrdenes locales en esta pantalla: ${localLabels.join(' | ')}` : '') },
        { role: 'user', content: raw }
      ],
      { json: true, models: [FAST_MODEL], maxTokens: 80 }
    )
    return JSON.parse(content)
  } catch {
    return null
  }
}
