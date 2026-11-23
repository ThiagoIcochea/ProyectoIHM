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
  { to: '/cuenta', label: 'Iniciar sesión', re: /\b(iniciar sesion|inicia sesion|login|loguear\w*|crear (una )?cuenta|registr\w*)\b/ },
  { to: '/perfil/eliminar', label: 'Eliminar cuenta', re: /\b(eliminar|borrar|cerrar) (mi )?cuenta\b/ },
  { to: '/dispositivos', label: 'Mis dispositivos', re: /\b(mis dispositivos|bluetooth|vincular|conectar (mi )?reloj|emparejar)\b/ },
  { to: '/explorar', label: 'Explorar', re: /\b(explorar|modalidades|experiencias)\b/ },
  { to: '/m/reloj', label: 'Reloj', re: /\b(reloj|smartwatch|watch|wearable)\b/ },
  { to: '/m/plegable', label: 'Plegable', re: /\b(plegable|doble pantalla|dual|dos pantallas)\b/ },
  { to: '/m/voz', label: 'Modo voz', re: /\b(modo voz|solo voz|conversacion por voz|asistente de voz)\b/ },
  { to: '/m/iot', label: 'Hogar IoT', re: /\b(iot|hogar|mi casa|dispositivos|domotica|lampara|parlante|difusor|pulsera)\b/ },
  { to: '/m/inmersivo', label: 'Santuario VR', re: /\b(realidad virtual|realidad aumentada|vr|ar|inmersiv\w*|santuario|quest|vision pro)\b/ },
  { to: '/m/mapa', label: 'Mapa 3D', re: /\b(mapa|centros? de salud|hospital\w*|cerca de mi|donde ir)\b/ },
  { to: '/m/gestos', label: 'Gestos', re: /\b(gestos?|camara|con las manos)\b/ }
]

const NAV_VERB = /\b(ir a|ir al|ve a|ve al|vamos a|vamos al|abre|abrir|abreme|abrime|llevame|lleva me|muestrame|muestra|mostrar|ensename|quiero ir|quiero ver|quiero usar|quiero abrir|quiero entrar|quiero|necesito|puedes abrir|puedes ir|podrias|me gustaria|entra a|entra al|entrar a|entrar al|pasa a|pasame a|cambia a|navega a|ponme|pon|activa|usa|usar|ver)\b/

// Palabras clave para tolerar errores del reconocimiento ("respiracion" → "respiración", "relo" → "reloj")
const KEYWORDS = {
  '/respirar': ['respiracion', 'respirar', 'respira', 'calma'],
  '/chat': ['chat', 'asistente', 'conversar'],
  '/diario': ['diario', 'bitacora'],
  '/perfil': ['perfil', 'ajustes', 'configuracion', 'accesibilidad'],
  '/explorar': ['explorar', 'experiencias', 'modalidades'],
  '/ayuda': ['emergencia', 'ayuda'],
  '/m/reloj': ['reloj', 'smartwatch'],
  '/m/plegable': ['plegable', 'pantallas'],
  '/m/iot': ['hogar', 'lampara', 'domotica', 'dispositivos'],
  '/m/inmersivo': ['virtual', 'santuario', 'inmersivo', 'aumentada'],
  '/m/mapa': ['mapa', 'hospital', 'centros'],
  '/m/gestos': ['gestos', 'camara'],
  '/dispositivos': ['bluetooth', 'vincular', 'emparejar']
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
function fuzzyDestination(t) {
  const words = t.split(' ').filter((w) => w.length >= 4)
  for (const [to, keys] of Object.entries(KEYWORDS)) {
    for (const w of words) for (const k of keys) if (lev(w, k) <= (k.length >= 8 ? 2 : 1)) return DESTINATIONS.find((d) => d.to === to)
  }
  return null
}

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
  const words = t.split(' ').length
  // Frases personales largas no son órdenes: van al chat
  const personal = /\b(me siento|estoy|me paso|tengo miedo|no puedo|me duele|mi (mama|papa|familia|amig\w*))\b/.test(t) && !hasVerb
  if (personal && words > 3) return null
  if (hasVerb || words <= 4) {
    for (const d of DESTINATIONS) if (d.re.test(t)) return { type: 'navigate', to: d.to, label: d.label }
  }
  if ((hasVerb && words <= 8) || words <= 3) {
    const d = fuzzyDestination(t)
    if (d) return { type: 'navigate', to: d.to, label: d.label }
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
