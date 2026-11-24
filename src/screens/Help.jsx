import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserRound, GraduationCap, Phone, Share2, Copy, Map, MessageSquareText, Video, Wind } from 'lucide-react'
import Helplines from '../components/Helplines'
import { useVoiceCommands } from '../lib/voice'
import { Notice, VoiceHints } from '../components/ui'
import { toast } from '../components/Toast'

const TRUSTED_MSG = 'Hola, no me estoy sintiendo bien y me gustaría hablar contigo. ¿Puedes acompañarme un momento?'
const COUNSELOR_MSG = 'Hola, quisiera conversar con usted en privado sobre algo que me está afectando. ¿Cuándo podríamos hablar?'

async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return
    }
  } catch {
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast('Mensaje copiado. Pégalo en WhatsApp o donde prefieras.')
  } catch {
    toast('No pude copiar. Mantén presionado el texto para copiarlo.', { tone: 'warn' })
  }
}

export default function Help() {
  const [open, setOpen] = useState(null)

  useVoiceCommands(
    'help',
    [
      { re: /\b(llama\w*|marcar?)\b.*\b(113|linea|ciento trece)\b|\bllamar a la linea\b/, label: 'llamar a la línea 113', run: () => (window.location.href = 'tel:113'), say: 'Abriendo la llamada a la Línea 113. Marca la opción 5.' },
      { re: /\b(adulto|confianza|mama|papa|familia)\b/, label: 'adulto de confianza', run: () => setOpen('adult'), say: 'Te preparé un mensaje para un adulto de confianza.' },
      { re: /\b(orientador|psicolog\w*|tutor)\b/, label: 'orientador', run: () => setOpen('counselor') },
      { re: /\b(whatsapp|escribir a la linea)\b/, label: 'whatsapp', run: () => window.open('https://wa.me/51955557000', '_blank') }
    ],
    []
  )

  return (
    <div className="wide-cols">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Pausa segura</h1>
        <p>Si necesitas más apoyo, no estás a solas. Elige con quién quieres hablar.</p>
      </div>

      <Notice tone="danger" icon={Phone}>
        <b>Si estás en peligro ahora</b>, llama al <a href="tel:113">113, opción 5</a> (salud mental, gratis, 24 horas) o al <a href="tel:105">105</a> (Policía).
      </Notice>

      <div className="grid-2">
        <section className="card stack-sm">
          <div className="row"><span className="ico-tile"><UserRound size={22} /></span><h2>Adulto de confianza</h2></div>
          <p className="muted">Mamá, papá, un familiar o alguien que te haga sentir seguro. Te dejamos un mensaje listo para enviar.</p>
          {open === 'adult' && <p className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>{TRUSTED_MSG}</p>}
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={() => shareText(TRUSTED_MSG)}><Share2 size={18} /> Enviar mensaje</button>
            <button className="btn btn-ghost" onClick={() => setOpen(open === 'adult' ? null : 'adult')}>{open === 'adult' ? 'Ocultar' : 'Ver mensaje'}</button>
          </div>
        </section>
        <section className="card stack-sm">
          <div className="row"><span className="ico-tile"><GraduationCap size={22} /></span><h2>Orientador o psicólogo educativo</h2></div>
          <p className="muted">El equipo de tutoría de tu colegio o universidad puede escucharte en privado.</p>
          {open === 'counselor' && <p className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>{COUNSELOR_MSG}</p>}
          <div className="row-wrap">
            <button className="btn" onClick={() => shareText(COUNSELOR_MSG)}><Copy size={18} /> Copiar mensaje</button>
            <button className="btn btn-ghost" onClick={() => setOpen(open === 'counselor' ? null : 'counselor')}>{open === 'counselor' ? 'Ocultar' : 'Ver mensaje'}</button>
          </div>
        </section>
      </div>

      <section className="stack-sm">
        <h2>Línea especializada</h2>
        <Helplines />
      </section>

      <section className="stack-sm">
        <h2>Otras formas de recibir apoyo</h2>
        <div className="grid-2">
          <a className="card card-link row" href="https://wa.me/51955557000" target="_blank" rel="noreferrer">
            <span className="ico-tile"><MessageSquareText size={22} /></span>
            <span><b>Chat de texto con la Línea 113</b><br /><span className="muted small">Por WhatsApp, si prefieres escribir</span></span>
          </a>
          <div className="card row" aria-disabled="true" style={{ opacity: 0.7 }}>
            <span className="ico-tile"><Video size={22} /></span>
            <span><b>Videollamada con intérprete de señas</b><br /><span className="muted small">No disponible en este MVP: necesita un convenio con un servicio real.</span></span>
          </div>
          <Link className="card card-link row" to="/m/mapa">
            <span className="ico-tile"><Map size={22} /></span>
            <span><b>Centros de salud cerca de ti</b><br /><span className="muted small">Mapa 3D con datos de OpenStreetMap</span></span>
          </Link>
          <Link className="card card-link row" to="/respirar">
            <span className="ico-tile"><Wind size={22} /></span>
            <span><b>Calmarme primero</b><br /><span className="muted small">Un minuto de respiración guiada</span></span>
          </Link>
        </div>
      </section>
      <VoiceHints items={['llamar a la línea 113', 'adulto de confianza', 'whatsapp']} />
      <p className="muted small">Datos verificados en gob.pe (Línea 113, MINSA). Escucha no reemplaza la atención profesional.</p>
    </div>
  )
}
