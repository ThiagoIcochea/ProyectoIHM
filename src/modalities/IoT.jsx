import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, Speaker, Droplets, HeartPulse, Bluetooth, Zap, Power, Wind } from 'lucide-react'
import { getState, setIot, setState, useStore } from '../lib/store'
import { playAmbient, stopAmbient, setAmbientVolume, SOUNDS } from '../lib/sound'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { Segmented, Switch, HowTo, VoiceHints } from '../components/ui'
import { toast } from '../components/Toast'
import { MODALITIES } from '../lib/modalities'

const LAMP = {
  calma: { label: 'Calma', color: '#7CC0F8' },
  calida: { label: 'Cálida', color: '#F3C06B' },
  foco: { label: 'Foco', color: '#F4F9FC' }
}
const supportsBLE = typeof navigator !== 'undefined' && 'bluetooth' in navigator

function Spark({ data }) {
  if (data.length < 2) return <svg className="spark" />
  const min = 50
  const max = 140
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / (max - min)) * 40}`).join(' ')
  const y100 = 40 - ((100 - min) / (max - min)) * 40
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="100" y1={y100} y2={y100} stroke="var(--danger)" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export default function IoT() {
  const meta = MODALITIES[3]
  const iot = useStore((s) => s.iot)
  const { lamp, speaker, diffuser, band, automation } = iot
  const v = useVoice()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [log, setLog] = useState([])
  const [bleName, setBleName] = useState('')
  const highSince = useRef(null)
  const cooldown = useRef(0)
  const bleRef = useRef(null)

  const addLog = (t) => setLog((l) => [{ t, at: new Date() }, ...l].slice(0, 8))

  // Pulsera simulada: paseo aleatorio alrededor de un pulso base que sube con el estrés
  useEffect(() => {
    if (band.source !== 'sim') return
    const t = setInterval(() => {
      const { bpm, stress } = getState().iot.band
      const target = 72 + stress * 0.5
      const next = Math.round(bpm + (target - bpm) * 0.25 + (Math.random() * 4 - 2))
      setIot('band', { bpm: Math.max(50, Math.min(160, next)) })
    }, 1000)
    return () => clearInterval(t)
  }, [band.source])

  useEffect(() => {
    setHistory((h) => [...h, band.bpm].slice(-60))
  }, [band.bpm])

  // Parlante real (Web Audio)
  useEffect(() => {
    if (speaker.on) playAmbient(speaker.sound, speaker.volume / 100)
    else stopAmbient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaker.on, speaker.sound])
  useEffect(() => setAmbientVolume(speaker.volume / 100), [speaker.volume])
  useEffect(() => () => stopAmbient(), [])

  const calmScene = (reason) => {
    setState((s) => ({
      iot: { ...s.iot, lamp: { ...s.iot.lamp, on: true, mode: 'calma', level: 55 }, speaker: { ...s.iot.speaker, on: true, sound: 'lluvia' }, diffuser: { ...s.iot.diffuser, on: true } }
    }))
    addLog(reason || 'Escena calma activada')
  }
  const allOff = () => {
    setState((s) => ({ iot: { ...s.iot, lamp: { ...s.iot.lamp, on: false }, speaker: { ...s.iot.speaker, on: false }, diffuser: { ...s.iot.diffuser, on: false } } }))
    addLog('Todo apagado')
  }

  // Automatización: si el pulso pasa de 100 durante 5 s, se activa la escena calma y se sugiere respirar
  useEffect(() => {
    if (!automation) return
    if (band.bpm > 100) {
      if (!highSince.current) highSince.current = Date.now()
      if (Date.now() - highSince.current > 5000 && Date.now() > cooldown.current) {
        cooldown.current = Date.now() + 60000
        calmScene(`Pulso alto (${band.bpm} lpm): escena calma automática`)
        toast(`Tu pulso está en ${band.bpm}. Activé la escena calma.`, { action: { label: 'Respirar', onClick: () => navigate('/respirar') }, duration: 7000 })
        v.speak('Noto tu pulso acelerado. Encendí una luz suave y sonido de lluvia. ¿Respiramos juntos un minuto?')
      }
    } else highSince.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band.bpm, automation])

  // Pulsera real por Bluetooth (perfil estándar Heart Rate 0x180D)
  const connectBLE = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      const server = await device.gatt.connect()
      const svc = await server.getPrimaryService('heart_rate')
      const ch = await svc.getCharacteristic('heart_rate_measurement')
      await ch.startNotifications()
      ch.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value
        const flags = d.getUint8(0)
        const bpm = flags & 1 ? d.getUint16(1, true) : d.getUint8(1)
        setIot('band', { bpm })
      })
      device.addEventListener('gattserverdisconnected', () => {
        setIot('band', { source: 'sim' })
        setBleName('')
        addLog('Pulsera desconectada')
      })
      bleRef.current = device
      setBleName(device.name || 'Pulsera')
      setIot('band', { source: 'ble' })
      addLog(`Conectado a ${device.name || 'pulsera'}`)
    } catch (e) {
      if (e?.name !== 'NotFoundError') toast('No se pudo conectar la pulsera.', { tone: 'warn' })
    }
  }
  const disconnectBLE = () => {
    bleRef.current?.gatt?.disconnect()
    setIot('band', { source: 'sim' })
  }

  useVoiceCommands(
    'iot',
    [
      { re: /\b(apaga\w*) (todo|todos)\b/, label: 'apaga todo', run: allOff, say: 'Apagué todo.' },
      { re: /\b(escena|modo) calma\b|\bcrea (un )?ambiente\b/, label: 'escena calma', run: () => calmScene(), say: 'Escena calma activada.' },
      { re: /\b(enciend\w*|prend\w*) (la )?(lampara|luz)\b/, label: 'enciende la lámpara', run: () => setIot('lamp', { on: true }), say: 'Lámpara encendida.' },
      { re: /\b(apag\w*) (la )?(lampara|luz)\b/, label: 'apaga la lámpara', run: () => setIot('lamp', { on: false }), say: 'Lámpara apagada.' },
      { re: /\b(luz|modo) (calida|foco)\b/, label: 'luz cálida', run: (m) => setIot('lamp', { on: true, mode: m[2] }) },
      { re: /\b(pon|reproduce|sonido de|ponme) (la )?(lluvia|olas|bosque)\b/, label: 'pon lluvia', run: (m) => setIot('speaker', { on: true, sound: m[3] }), say: (m) => `Reproduciendo ${m[3]}.` },
      { re: /\b(apag\w*|para|quita\w*) (el )?(parlante|sonido|musica)\b/, label: 'apaga el parlante', run: () => setIot('speaker', { on: false }) },
      { re: /\b(enciend\w*|prend\w*) (el )?difusor\b/, label: 'enciende el difusor', run: () => setIot('diffuser', { on: true }), say: 'Difusor encendido.' },
      { re: /\b(apag\w*) (el )?difusor\b/, label: 'apaga el difusor', run: () => setIot('diffuser', { on: false }) },
      { re: /\b(simula\w*) (estres|ansiedad)\b/, label: 'simula estrés', run: () => setIot('band', { stress: 90 }), say: 'Simulando estrés en la pulsera.' },
      { re: /\b(pulso|ritmo cardiaco|latidos)\b/, label: 'mi pulso', run: () => {}, say: () => `Tu pulso es de ${getState().iot.band.bpm} latidos por minuto.` }
    ],
    []
  )

  const lampColor = LAMP[lamp.mode].color
  const lampOn = lamp.on

  return (
    <div className="stack">
      <div className="mod-head">
        <div className="stack-sm" style={{ maxWidth: 640 }}>
          <span className="muted small">4 de 7 · {meta.tech}</span>
          <h1>{meta.name}</h1>
          <p className="muted">{meta.short}</p>
        </div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={() => calmScene()}><Wind size={18} /> Escena calma</button>
          <button className="btn" onClick={allOff}><Power size={18} /> Apagar todo</button>
        </div>
      </div>

      <div className="rule">
        <Zap size={18} color="var(--primary)" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 220 }}><b>Automatización:</b> si el pulso supera 100 lpm por 5 segundos, enciende la luz calma, el sonido de lluvia y el difusor, y te sugiere respirar.</span>
        <button type="button" role="switch" aria-checked={automation} aria-label="Automatización" className="switch" onClick={() => setIot('automation', !automation)} />
      </div>

      <div className="grid">
        <section className="card device" aria-labelledby="d-band">
          <div className="row between">
            <div className="row"><span className="ico-tile danger"><HeartPulse size={22} /></span><div><h3 id="d-band">Pulsera</h3><span className={`tag ${band.source === 'ble' ? 'tag-live' : 'tag-sim'}`}>{band.source === 'ble' ? `Real · ${bleName}` : 'Simulada'}</span></div></div>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <HeartPulse className="beat" size={28} style={{ '--beat': `${60 / band.bpm}s` }} aria-hidden="true" />
            <span className="bpm" aria-live="polite">{band.bpm}</span><span className="muted">lpm</span>
          </div>
          <Spark data={history} />
          {band.source === 'sim' ? (
            <div className="field">
              <label className="label" htmlFor="stress">Simular estrés: {band.stress}%</label>
              <input id="stress" type="range" min="0" max="100" value={band.stress} onChange={(e) => setIot('band', { stress: Number(e.target.value) })} />
            </div>
          ) : null}
          {supportsBLE ? (
            band.source === 'ble' ? (
              <button className="btn btn-sm" onClick={disconnectBLE}>Desconectar</button>
            ) : (
              <button className="btn btn-sm" onClick={connectBLE}><Bluetooth size={16} /> Conectar pulsera real</button>
            )
          ) : (
            <span className="muted small">Bluetooth web no disponible aquí (usa Chrome en Android o laptop).</span>
          )}
        </section>

        <section className="card device" aria-labelledby="d-lamp">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Lightbulb size={22} /></span><div><h3 id="d-lamp">Lámpara</h3><span className="tag tag-sim">Simulada</span></div></div>
            <button type="button" role="switch" aria-checked={lamp.on} aria-label="Lámpara" className="switch" onClick={() => setIot('lamp', { on: !lamp.on })} />
          </div>
          <div className="lamp-visual" style={lampOn ? { background: `color-mix(in srgb, ${lampColor} ${lamp.level / 2}%, var(--surface-2))` } : undefined}>
            <span className="lamp-bulb" style={lampOn ? { background: lampColor, boxShadow: `0 0 ${20 + lamp.level / 1.5}px ${lamp.level / 4}px ${lampColor}` } : undefined} />
          </div>
          <Segmented label="Color" value={lamp.mode} onChange={(m) => setIot('lamp', { mode: m, on: true })} options={Object.entries(LAMP).map(([value, o]) => ({ value, label: o.label }))} />
          <div className="field">
            <label className="label" htmlFor="lvl">Brillo: {lamp.level}%</label>
            <input id="lvl" type="range" min="10" max="100" value={lamp.level} onChange={(e) => setIot('lamp', { level: Number(e.target.value) })} />
          </div>
        </section>

        <section className="card device" aria-labelledby="d-spk">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Speaker size={22} /></span><div><h3 id="d-spk">Parlante</h3><span className="tag tag-live">Sonido real</span></div></div>
            <button type="button" role="switch" aria-checked={speaker.on} aria-label="Parlante" className="switch" onClick={() => setIot('speaker', { on: !speaker.on })} />
          </div>
          <Segmented label="Sonido" value={speaker.sound} onChange={(x) => setIot('speaker', { sound: x, on: true })} options={Object.entries(SOUNDS).map(([value, label]) => ({ value, label }))} />
          <div className="field">
            <label className="label" htmlFor="vol">Volumen: {speaker.volume}%</label>
            <input id="vol" type="range" min="0" max="100" value={speaker.volume} onChange={(e) => setIot('speaker', { volume: Number(e.target.value) })} />
          </div>
        </section>

        <section className="card device" aria-labelledby="d-dif">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Droplets size={22} /></span><div><h3 id="d-dif">Difusor de aroma</h3><span className="tag tag-sim">Simulado</span></div></div>
            <button type="button" role="switch" aria-checked={diffuser.on} aria-label="Difusor" className="switch" onClick={() => setIot('diffuser', { on: !diffuser.on })} />
          </div>
          <Segmented label="Intensidad" value={diffuser.level} onChange={(x) => setIot('diffuser', { level: x, on: true })} options={[{ value: 1, label: 'Suave' }, { value: 2, label: 'Media' }, { value: 3, label: 'Alta' }]} />
          <p className="muted small">{diffuser.on ? `Encendido · intensidad ${['', 'suave', 'media', 'alta'][diffuser.level]}` : 'Apagado'}</p>
        </section>
      </div>

      <div className="grid-2">
        <section className="card stack-sm">
          <h3>Actividad</h3>
          {log.length === 0 ? <p className="muted small">Aún no hay eventos. Sube el estrés de la pulsera para ver la automatización.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
              {log.map((l, i) => <li key={i}><span className="muted tnum">{l.at.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> · {l.t}</li>)}
            </ul>
          )}
        </section>
        <HowTo
          items={[
            'Laptop o móvil: mueve “Simular estrés” a más de 60 % y espera unos segundos; la automatización se dispara sola.',
            'Pulsera real: en Chrome (Android, Windows, macOS) toca “Conectar pulsera real” y elige una banda que use el perfil estándar de frecuencia cardiaca por Bluetooth (por ejemplo, una Polar H10).',
            'El parlante suena de verdad en tu dispositivo. La lámpara y el difusor están simulados: en producción se conectarían por MQTT o Matter.'
          ]}
        />
      </div>
      <VoiceHints items={['escena calma', 'enciende la lámpara', 'pon olas', 'apaga todo', 'simula estrés', 'mi pulso']} />
    </div>
  )
}
