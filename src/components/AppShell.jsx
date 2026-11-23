import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { House, MessageCircle, Wind, Compass, UserRound, BookOpen, Smile, ArrowLeft, LifeBuoy, Bluetooth, LogIn } from 'lucide-react'
import { useAccount } from '../lib/auth'
import VoiceDock from './VoiceDock'
import { MODALITIES } from '../lib/modalities'

export function Logo({ size = 18 }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6 14c0-4 2.6-7 6.4-7 2.9 0 5 1.9 5 4.6 0 2.3-1.6 3.7-3.4 3.7-1.3 0-2.1-.8-2.1-1.8 0-.9.7-1.6 1.6-1.6" />
        <circle cx="8" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

const MAIN_NAV = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/respirar', label: 'Calma', icon: Wind },
  { to: '/explorar', label: 'Explorar', icon: Compass },
  { to: '/perfil', label: 'Perfil', icon: UserRound }
]

const TITLES = {
  '/': 'Inicio',
  '/explorar': 'Explorar',
  '/checkin': 'Cómo me siento',
  '/chat': 'Chat',
  '/respirar': 'Respiración',
  '/diario': 'Diario emocional',
  '/ayuda': 'Pausa segura',
  '/perfil': 'Perfil',
  '/perfil/eliminar': 'Eliminar cuenta',
  '/dispositivos': 'Mis dispositivos'
}

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mod = MODALITIES.find((m) => m.to === pathname)
  const title = mod ? mod.name : TITLES[pathname] || 'Escucha'
  const isRoot = MAIN_NAV.some((n) => n.to === pathname)
  const bleed = pathname === '/m/inmersivo' || pathname === '/m/mapa'
  const acc = useAccount()

  return (
    <div className="shell">
      <a href="#main" className="sr-only">Saltar al contenido</a>
      <nav className="rail" aria-label="Navegación principal">
        <Link to="/" className="brand">
          <Logo /> Escucha
        </Link>
        {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
            <Icon size={20} aria-hidden="true" /> {label}
          </NavLink>
        ))}
        <NavLink to="/checkin" className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
          <Smile size={20} aria-hidden="true" /> Cómo me siento
        </NavLink>
        <NavLink to="/diario" className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
          <BookOpen size={20} aria-hidden="true" /> Diario
        </NavLink>
        <NavLink to="/dispositivos" className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
          <Bluetooth size={20} aria-hidden="true" /> Mis dispositivos
        </NavLink>
        <div className="rail-sep" />
        <p className="rail-label">Experiencias</p>
        {MODALITIES.map(({ to, name, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
            <Icon size={20} aria-hidden="true" /> {name}
          </NavLink>
        ))}
      </nav>

      <div style={{ minWidth: 0 }}>
        <header className="header">
          {isRoot ? (
            <Link to="/" className="brand" aria-label="Escucha, inicio">
              <Logo />
              <span>Escucha</span>
            </Link>
          ) : (
            <>
              <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Volver">
                <ArrowLeft size={22} />
              </button>
              <span className="header-title">{title}</span>
            </>
          )}
          <span className="spacer" />
          {acc ? (
            <Link to="/perfil" className="tag" style={{ textDecoration: 'none', minHeight: 32 }} aria-label={`Sesión iniciada como ${acc.display}`}>
              <UserRound size={14} aria-hidden="true" /> <span className="hide-sm">{acc.display}</span>
            </Link>
          ) : (
            <Link to="/cuenta" className="btn btn-ghost btn-sm" style={{ minHeight: 40 }} aria-label="Ingresar o crear cuenta">
              <LogIn size={16} aria-hidden="true" /> <span className="hide-sm">Ingresar</span>
            </Link>
          )}
          <Link to="/ayuda" className="sos-btn" data-coach="sos" aria-label="SOS, pedir ayuda ahora">
            <LifeBuoy size={18} aria-hidden="true" /> SOS
          </Link>
        </header>

        <main id="main" className={`main${bleed ? ' bleed' : ''}`} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-ico">
              <Icon size={22} aria-hidden="true" />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      <VoiceDock />
    </div>
  )
}
