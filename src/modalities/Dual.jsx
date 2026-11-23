import { useEffect, useState } from 'react'
import { Columns2, Smartphone } from 'lucide-react'
import { ChatPanel } from '../screens/Chat'
import { BreathPanel } from '../screens/Breathe'
import { JournalPanel } from '../screens/Journal'
import { Segmented, HowTo, VoiceHints } from '../components/ui'
import { useVoiceCommands } from '../lib/voice'
import { MODALITIES } from '../lib/modalities'

// Detecta un plegable real (Viewport Segments API / Device Posture) o permite simularlo.
function useFoldable() {
  const [segments, setSegments] = useState(1)
  useEffect(() => {
    const read = () => {
      const segs = window.viewport?.segments || window.visualViewport?.segments
      if (Array.isArray(segs)) return setSegments(segs.length)
      const mq = matchMedia('(horizontal-viewport-segments: 2)')
      setSegments(mq.matches ? 2 : 1)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return segments
}

export default function Dual() {
  const meta = MODALITIES[1]
  const segments = useFoldable()
  const [sim, setSim] = useState(false)
  const [tool, setTool] = useState('breathe')
  const [wide, setWide] = useState(() => matchMedia('(min-width: 760px)').matches)
  const [mobileTab, setMobileTab] = useState('chat')

  useEffect(() => {
    const mq = matchMedia('(min-width: 760px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const real = segments > 1
  const split = real || sim || wide

  useVoiceCommands(
    'dual',
    [
      { re: /\b(simula\w*|desplieg\w*|abre el plegable)\b/, label: 'desplegar', run: () => setSim(true), say: 'Plegable desplegado.' },
      { re: /\b(pliega\w*|cierra el plegable)\b/, label: 'plegar', run: () => setSim(false) },
      { re: /\b(herramienta|panel)\s+(diario|respiracion|respirar)\b/, label: 'panel diario', run: (m) => setTool(m[2] === 'diario' ? 'journal' : 'breathe') }
    ],
    []
  )

  const toolPane = (
    <>
      <div className="dual-tabs">
        <Segmented label="Herramienta" value={tool} onChange={setTool} options={[{ value: 'breathe', label: 'Respirar' }, { value: 'journal', label: 'Diario' }]} />
      </div>
      <div className="pane">{tool === 'breathe' ? <BreathPanel compact id="dual-breathe" /> : <JournalPanel compact id="dual-journal" />}</div>
    </>
  )

  return (
    <div className="stack">
      <div className="mod-head">
        <div className="stack-sm" style={{ maxWidth: 620 }}>
          <span className="muted small">2 de 7 · {meta.tech}</span>
          <h1>{meta.name}</h1>
          <p className="muted">Conversa en una mitad y usa una herramienta en la otra, sin perder el hilo. En un teléfono normal cambias con pestañas.</p>
        </div>
        <div className="row-wrap">
          <span className={`tag ${real ? 'tag-live' : ''}`}>{real ? 'Plegable detectado: 2 pantallas' : 'Una pantalla'}</span>
          <button className="btn btn-sm" aria-pressed={sim} onClick={() => setSim(!sim)}>
            {sim ? <Smartphone size={16} /> : <Columns2 size={16} />} {sim ? 'Plegar' : 'Simular plegable'}
          </button>
        </div>
      </div>

      {split ? (
        <div className={`dual split ${real ? 'auto' : ''}`} style={{ '--hinge': sim || real ? '14px' : '1px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dual-tabs"><b style={{ padding: '8px 6px' }}>Chat</b></div>
            <div className="pane"><ChatPanel compact id="dual-chat" /></div>
          </div>
          <div className="hinge" aria-hidden="true" style={!(sim || real) ? { background: 'var(--border)' } : undefined} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{toolPane}</div>
        </div>
      ) : (
        <div className="dual">
          <div className="dual-tabs">
            <Segmented label="Vista" value={mobileTab} onChange={setMobileTab} options={[{ value: 'chat', label: 'Chat' }, { value: 'tool', label: 'Herramientas' }]} />
          </div>
          {mobileTab === 'chat' ? <div className="pane"><ChatPanel compact id="dual-chat" /></div> : toolPane}
        </div>
      )}

      <HowTo
        items={[
          'Plegable real (Galaxy Fold, Surface Duo, Pixel Fold) con Chrome: abre la página con el teléfono desplegado y cada mitad usa su propia pantalla.',
          'iPhone o Android normal: verás pestañas Chat y Herramientas. Gíralo en horizontal o toca Simular plegable.',
          'Laptop: ya ves las dos mitades. En Chrome DevTools puedes emular “Surface Duo” o “Galaxy Z Fold”.'
        ]}
      />
      <VoiceHints items={['desplegar', 'panel diario', 'empezar', 'cualquier frase va al chat']} />
    </div>
  )
}
