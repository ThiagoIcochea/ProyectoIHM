import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { MODALITIES } from '../lib/modalities'

export default function Explore() {
  return (
    <>
      <div className="page-head">
        <h1>Siete formas de usar Escucha</h1>
        <p>Cada experiencia resuelve el mismo problema, encontrar calma y ayuda a tiempo, con una tecnología distinta. Todas funcionan desde una laptop o un móvil, y algunas aprovechan un visor, un reloj o una pulsera si los tienes.</p>
      </div>
      <div className="grid">
        {MODALITIES.map(({ n, to, icon: Icon, name, short, devices, tech }) => (
          <Link key={to} to={to} className="card card-link mod-card">
            <div className="row">
              <span className="ico-tile"><Icon size={22} /></span>
              <div style={{ flex: 1 }}>
                <span className="muted small tnum">{n} de 7 · {tech}</span>
                <h3>{name}</h3>
              </div>
              <ChevronRight size={18} className="muted" aria-hidden="true" />
            </div>
            <p>{short}</p>
            <div className="tags">
              {devices.map((d) => (
                <span key={d} className="tag">{d}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
