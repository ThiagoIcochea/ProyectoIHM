// Detección simple de señales de riesgo. No diagnostica: solo prioriza mostrar ayuda humana.
// Fuentes de las líneas: gob.pe (Línea 113 opción 5, MINSA) y directorios públicos de La Voz Amiga.

const normalize = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const PATTERNS = [
  /quiero morir/,
  /me quiero morir/,
  /suicid/,
  /matarme/,
  /quitarme la vida/,
  /hacerme dano/,
  /lastimarme/,
  /cortarme/,
  /no quiero vivir/,
  /no quiero seguir/,
  /desaparecer para siempre/,
  /mejor sin mi/,
  /acabar con todo/
]

export function detectCrisis(text = '') {
  const t = normalize(text)
  return PATTERNS.some((p) => p.test(t))
}

export const HELPLINES = [
  {
    id: '113',
    name: 'Línea 113, opción 5',
    detail: 'Salud mental del MINSA. Gratuita, las 24 horas.',
    tel: '113',
    primary: true
  },
  {
    id: 'wa113',
    name: 'Línea 113 por WhatsApp',
    detail: 'Escribe al 955 557 000 si prefieres no llamar.',
    href: 'https://wa.me/51955557000'
  },
  {
    id: 'vozamiga',
    name: 'La Voz Amiga',
    detail: '0800-4-1212 · Voluntarios que escuchan, 24 horas.',
    tel: '080041212'
  },
  { id: '106', name: 'SAMU 106', detail: 'Urgencias médicas.', tel: '106' },
  { id: '105', name: 'Policía 105', detail: 'Si estás en peligro ahora.', tel: '105' }
]

export const CRISIS_REPLY =
  'Gracias por contármelo. Lo que sientes importa y no tienes que pasarlo a solas. ' +
  'Ahora mismo lo más útil es hablar con una persona: puedes llamar gratis a la Línea 113, opción 5, a cualquier hora, ' +
  'o contarle a un adulto de confianza que esté cerca. ¿Hay alguien contigo en este momento?'
