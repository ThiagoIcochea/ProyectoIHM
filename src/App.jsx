import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore } from './lib/store'
import { VoiceProvider } from './lib/voice'
import AppShell from './components/AppShell'
import { Toaster } from './components/Toast'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Explore from './screens/Explore'
import Checkin from './screens/Checkin'
import Chat from './screens/Chat'
import Breathe from './screens/Breathe'
import Journal from './screens/Journal'
import Help from './screens/Help'
import Profile from './screens/Profile'
import Account from './screens/Account'
import DeleteAccount from './screens/DeleteAccount'
import Devices from './screens/Devices'
import Connect from './screens/Connect'
import { purgeExpired } from './lib/auth'
import Watch from './modalities/Watch'
import Dual from './modalities/Dual'
import VoiceMode from './modalities/VoiceMode'
import IoT from './modalities/IoT'

// Las modalidades pesadas se cargan solo cuando se abren
const Immersive = lazy(() => import('./modalities/Immersive'))
const Map3D = lazy(() => import('./modalities/Map3D'))
const Gestures = lazy(() => import('./modalities/Gestures'))

purgeExpired()

function useA11yAttributes() {
  const { theme, textScale, highContrast, reduceMotion } = useStore()
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    root.style.fontSize = `${textScale}%`
    root.toggleAttribute('data-contrast', highContrast)
    if (highContrast) root.setAttribute('data-contrast', 'high')
    if (reduceMotion) root.setAttribute('data-motion', 'reduce')
    else root.removeAttribute('data-motion')
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0B151D' : '#F0F8FD'))
  }, [theme, textScale, highContrast, reduceMotion])
}

function Loading() {
  return (
    <div className="card" role="status" style={{ margin: 16 }}>
      Cargando…
    </div>
  )
}

export default function App() {
  useA11yAttributes()
  const onboarded = useStore((s) => s.onboarded)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <VoiceProvider>
      {!onboarded && location.pathname !== '/bienvenida' && location.pathname !== '/cuenta' && location.pathname !== '/conectar' ? (
        <Navigate to="/bienvenida" replace />
      ) : (
        <Routes>
          <Route path="/bienvenida" element={<Onboarding />} />
          <Route path="/cuenta" element={<Account />} />
          <Route path="/conectar" element={<Connect />} />
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="explorar" element={<Explore />} />
            <Route path="checkin" element={<Checkin />} />
            <Route path="chat" element={<Chat />} />
            <Route path="respirar" element={<Breathe />} />
            <Route path="diario" element={<Journal />} />
            <Route path="ayuda" element={<Help />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="perfil/eliminar" element={<DeleteAccount />} />
            <Route path="dispositivos" element={<Devices />} />
            <Route path="m/reloj" element={<Watch />} />
            <Route path="m/plegable" element={<Dual />} />
            <Route path="m/voz" element={<VoiceMode />} />
            <Route path="m/iot" element={<IoT />} />
            <Route path="m/inmersivo" element={<Suspense fallback={<Loading />}><Immersive /></Suspense>} />
            <Route path="m/mapa" element={<Suspense fallback={<Loading />}><Map3D /></Suspense>} />
            <Route path="m/gestos" element={<Suspense fallback={<Loading />}><Gestures /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      <Toaster />
    </VoiceProvider>
  )
}
