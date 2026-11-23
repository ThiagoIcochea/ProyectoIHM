import { Link, useNavigate } from 'react-router-dom'
import { Wind, MessageCircle, BookOpen, ChevronRight, Mic } from 'lucide-react'
import { setState, useStore } from '../lib/store'
import { EMOTIONS, emotionById } from '../lib/emotions'
import { MODALITIES } from '../lib/modalities'
import Coach from '../components/Coach'
import { useVoice } from '../lib/voice'

const COACH = [
  { target: '[data-coach="sos"]', title: 'Ayuda inmediata', text: 'Si te sientes en peligro o muy mal, toca SOS. Siempre está aquí arriba.' },
  { target: '[data-coach="mic"]', title: 'Navega con tu voz', text: 'Toca el micrófono o pulsa la tecla V. Di “abre respiración”, “ir al chat” o “qué puedo decir”. Con Manos libres te escucha todo el tiempo.' },
  { target: '[data-coach="mods"]', title: 'Siete formas de usar Escucha', text: 'Reloj, plegable, voz, hogar IoT, realidad virtual, mapa 3D y gestos. Todas se pueden probar desde esta laptop o tu móvil.' }
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Home() {
  const { alias, checkins, coachDone } = useStore()
  const navigate = useNavigate()
  const v = useVoice()
  const last = checkins[0]

  return (
    <>
      <section className="hero" aria-labelledby="hero-t">
        <div className="stack">
          <div className="stack-sm">
            <p className="muted">{greeting()}{alias ? `, ${alias}` : ''}</p>
            <h1 id="hero-t">¿Cómo te sientes hoy?</h1>
          </div>
          <div className="row-wrap" role="group" aria-label="Elige una emoción para empezar">
            {EMOTIONS.map((e) => (
              <button key={e.id} className="chip" onClick={() => navigate(`/checkin?e=${e.id}`)}>
                <span className="dot" style={{ color: e.color }} aria-hidden="true" /> {e.label}
              </button>
            ))}
          </div>
          {last && (
            <p className="muted small">
              Último registro: {last.emotions.map((id) => emotionById(id)?.label).join(', ')} ·{' '}
              {new Date(last.date).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>
        <button className="hero-illus" onClick={v.toggleListening} style={{ border: 0, cursor: 'pointer', color: 'var(--primary)' }} aria-label="Hablar con Escucha">
          <svg viewBox="0 0 320 200" width="100%" height="100%" aria-hidden="true">
            <circle cx="160" cy="100" r="74" fill="var(--surface)" opacity="0.8" />
            <circle cx="160" cy="100" r="50" fill="var(--primary)" opacity="0.15" />
            <circle cx="160" cy="100" r="30" fill="var(--primary)" />
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <rect key={k} x={52 + k * 10} y={100 - [10, 22, 34, 18, 28, 14, 8][k] / 2} width="5" height={[10, 22, 34, 18, 28, 14, 8][k]} rx="2.5" fill="var(--primary)" opacity="0.55" />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <rect key={`r${k}`} x={232 + k * 10} y={100 - [8, 14, 28, 18, 34, 22, 10][k] / 2} width="5" height={[8, 14, 28, 18, 34, 22, 10][k]} rx="2.5" fill="var(--primary)" opacity="0.55" />
            ))}
          </svg>
          <span style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', fontWeight: 650, color: 'var(--ink)' }}>
            <Mic size={18} /> Toca y cuéntame
          </span>
        </button>
      </section>

      <div className="section-title"><h2>Para este momento</h2></div>
      <div className="quick">
        <Link to="/respirar" className="card card-link">
          <span className="ico-tile"><Wind size={22} /></span>
          <span className="stack-sm" style={{ gap: 2 }}><h3>Respirar 1 minuto</h3><span className="muted small">Inhala, sostén y exhala 4 segundos</span></span>
        </Link>
        <Link to="/chat" className="card card-link">
          <span className="ico-tile"><MessageCircle size={22} /></span>
          <span className="stack-sm" style={{ gap: 2 }}><h3>Hablar con Escucha</h3><span className="muted small">Asistente con IA, sin juicios</span></span>
        </Link>
        <Link to="/diario" className="card card-link">
          <span className="ico-tile"><BookOpen size={22} /></span>
          <span className="stack-sm" style={{ gap: 2 }}><h3>Escribir en mi diario</h3><span className="muted small">Por teclado o dictando</span></span>
        </Link>
      </div>

      <div className="section-title" data-coach="mods">
        <h2>Experiencias</h2>
        <Link to="/explorar" className="small" style={{ fontWeight: 650 }}>Ver todas</Link>
      </div>
      <div className="grid">
        {MODALITIES.map(({ to, icon: Icon, name, short }) => (
          <Link key={to} to={to} className="card card-link mod-card">
            <div className="row">
              <span className="ico-tile"><Icon size={22} /></span>
              <h3 style={{ flex: 1 }}>{name}</h3>
              <ChevronRight size={18} className="muted" aria-hidden="true" />
            </div>
            <p>{short}</p>
          </Link>
        ))}
      </div>

      {!coachDone && <Coach steps={COACH} onDone={() => setState({ coachDone: true })} />}
    </>
  )
}
