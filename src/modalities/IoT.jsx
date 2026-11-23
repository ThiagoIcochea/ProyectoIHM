import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, Speaker, Droplets, HeartPulse, Bluetooth, Zap, Power, Wind, Tv, Cast, Copy, Share2, Unplug, Smartphone, ChevronRight } from 'lucide-react'
import { useHub, startHub, stopHub, broadcastState, broadcastBreath, ROLES } from '../lib/hub'
import { canChooseOutput, chooseOutput, setOutput } from '../lib/sound'
import { getState, setIot, setState, useStore } from '../lib/store'
import { playAmbient, stopAmbient, setAmbientVolume, SOUNDS } from '../lib/sound'
import { useVoice, useVoiceCommands } from '../lib/voice'
import { Segmented, HowTo, VoiceHints, Sheet } from '../components/ui'
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

  // ---------- Más dispositivos: TV, parlantes y luces extra sincronizados ----------
  const hub = useHub()
  const [outs, setOuts] = useState([])
  const [outName, setOutName] = useState('')
  useEffect(() => {
    if (hub.status === 'host') broadcastState({ lamp, speaker, diffuser, band: { bpm: band.bpm } })
  }, [hub.status, lamp, speaker, diffuser, band.bpm, Object.keys(hub.devices).length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [linkRole, setLinkRole] = useState(null)
  const devicesOf = (role) => Object.values(hub.devices).filter((d) => d.role === role)
  const hubCount = (role) => devicesOf(role).length
  const openLink = (role) => { setLinkRole(role); if (hub.status !== 'host') startHub() }
  function RoleTag({ role, fallback, live }) {
    const n = hubCount(role)
    return <span className={`tag ${n ? 'tag-live' : live ? 'tag-live' : 'tag-sim'}`}>{n ? `${n} vinculado${n > 1 ? 's' : ''}` : fallback}</span>
  }
  function LinkBox({ title, options }) {
    return (
      <div className="link-box">
        <span className="label small">{title}</span>
        {options.map((o) => {
          const I = o.icon
          return (
            <button key={o.label} type="button" className="link-opt" onClick={o.role ? () => openLink(o.role) : o.onClick}>
              <I size={18} aria-hidden="true" />
              <span><b>{o.label}</b><br /><span className="muted small">{o.hint}</span></span>
              <ChevronRight size={16} className="muted" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    )
  }
  const joinUrl = (role) => `${location.origin}${location.pathname}#/conectar?codigo=${hub.code}${role ? `&rol=${role}` : ''}`
  const castToTv = async () => {
    try {
      const code = hub.code || (await startHub())
      if (!code) return
      const req = new window.PresentationRequest([`${location.origin}${location.pathname}#/conectar?codigo=${code}&rol=tv`])
      await req.start()
      toast('Transmitiendo a la TV')
    } catch (e) {
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') toast('No se encontró una TV compatible (Chromecast o Android TV en la misma red).', { tone: 'warn', duration: 5000 })
    }
  }
  const shareLink = async (role) => {
    const url = joinUrl(role)
    try {
      if (navigator.share) await navigator.share({ title: 'Escucha · Hogar conectado', text: `Código: ${hub.code}`, url })
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado') }
    } catch { /* cancelado */ }
  }
  const pickOutput = async () => {
    try {
      const r = await chooseOutput()
      if (typeof r === 'string') setOutName(r)
      else setOuts(r)
    } catch { toast('No se pudo cambiar la salida de audio.', { tone: 'warn' }) }
  }

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
        broadcastBreath('start')
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

      <div className="grid iot-grid">
        <section className="card device" aria-labelledby="d-band">
          <div className="row between">
            <div className="row"><span className="ico-tile danger"><HeartPulse size={22} /></span><div><h3 id="d-band">Reloj o pulsera</h3><span className={`tag ${band.source === 'ble' ? 'tag-live' : 'tag-sim'}`}>{band.source === 'ble' ? `Vinculado · ${bleName || 'Bluetooth'}` : 'Simulado'}</span></div></div>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <HeartPulse className="beat" size={28} style={{ '--beat': `${60 / band.bpm}s` }} aria-hidden="true" />
            <span className="bpm" aria-live="polite">{band.bpm}</span><span className="muted">lpm</span>
          </div>
          <Spark data={history} />
          {band.source === 'sim' && (
            <div className="field">
              <label className="label" htmlFor="stress">Simular estrés: {band.stress}%</label>
              <input id="stress" type="range" min="0" max="100" value={band.stress} onChange={(e) => setIot('band', { stress: Number(e.target.value) })} />
            </div>
          )}
          <LinkBox title="Vincular" options={[
            { icon: Bluetooth, label: 'Reloj o pulsera por Bluetooth', hint: 'Pulso, oxígeno y batería si el equipo los comparte; avisos en la muñeca.', onClick: () => navigate('/dispositivos') }
          ]} />
        </section>

        <section className="card device" aria-labelledby="d-lamp">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Lightbulb size={22} /></span><div><h3 id="d-lamp">Luces inteligentes</h3><RoleTag role="luz" fallback="Simulada" /></div></div>
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
          <LinkBox title="Vincular" role="luz" options={[
            { icon: Smartphone, label: 'Teléfono o tablet como luz', hint: 'Su pantalla ilumina la habitación con el color y brillo de la escena.', role: 'luz' },
            { icon: Bluetooth, label: 'Foco Bluetooth', hint: 'Se vincula y explora; el control de color depende del fabricante.', onClick: () => navigate('/dispositivos') }
          ]} />
        </section>

        <section className="card device" aria-labelledby="d-spk">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Speaker size={22} /></span><div><h3 id="d-spk">Parlantes</h3><RoleTag role="parlante" fallback="Sonido real en este equipo" live /></div></div>
            <button type="button" role="switch" aria-checked={speaker.on} aria-label="Parlante" className="switch" onClick={() => setIot('speaker', { on: !speaker.on })} />
          </div>
          <Segmented label="Sonido" value={speaker.sound} onChange={(x) => setIot('speaker', { sound: x, on: true })} options={Object.entries(SOUNDS).map(([value, label]) => ({ value, label }))} />
          <div className="field">
            <label className="label" htmlFor="vol">Volumen: {speaker.volume}%</label>
            <input id="vol" type="range" min="0" max="100" value={speaker.volume} onChange={(e) => setIot('speaker', { volume: Number(e.target.value) })} />
          </div>
          <LinkBox title="Vincular" role="parlante" options={[
            ...(canChooseOutput ? [{ icon: Bluetooth, label: 'Parlante Bluetooth o TV por HDMI', hint: outName ? `Sonando por: ${outName}` : 'Empareja el parlante en tu sistema y elígelo aquí.', onClick: pickOutput }] : []),
            { icon: Smartphone, label: 'Otro teléfono o laptop como parlante', hint: 'Reproduce el mismo sonido, sincronizado con este panel.', role: 'parlante' }
          ]} />
          {outs.length > 0 && (
            <select className="select" style={{ minHeight: 40 }} defaultValue="" onChange={(e) => setOutput(e.target.value).then(() => setOutName(e.target.selectedOptions[0].text)).catch(() => {})}>
              <option value="" disabled>Elige una salida de audio</option>
              {outs.map((o) => <option key={o.deviceId} value={o.deviceId}>{o.label || 'Salida de audio'}</option>)}
            </select>
          )}
        </section>

        <section className="card device" aria-labelledby="d-tv">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Tv size={22} /></span><div><h3 id="d-tv">Televisor</h3><RoleTag role="tv" fallback="Sin conectar" /></div></div>
          </div>
          <div className="tv-mini" style={{ '--glow': lampOn ? lampColor : '#2F86D6' }} aria-hidden="true"><span /></div>
          <p className="muted small">La TV muestra la respiración guiada en grande, con la luz de la escena, el reloj y el pulso.</p>
          <div className="row-wrap">
            <button className="btn btn-sm" disabled={!hubCount('tv')} onClick={() => { broadcastBreath('start'); toast('Respiración enviada a la TV') }}><Wind size={16} /> Respirar en la TV</button>
            <button className="btn btn-sm btn-ghost" disabled={!hubCount('tv')} onClick={() => broadcastBreath('stop')}>Detener</button>
          </div>
          <LinkBox title="Vincular" role="tv" options={[
            ...('PresentationRequest' in window ? [{ icon: Cast, label: 'Chromecast o Android TV', hint: 'Desde Chrome, en la misma red Wi‑Fi.', onClick: castToTv }] : []),
            { icon: Tv, label: 'Smart TV con navegador', hint: 'Abre el enlace en la TV (o escribe el código) y queda sincronizada.', role: 'tv' }
          ]} />
        </section>

        <section className="card device" aria-labelledby="d-dif">
          <div className="row between">
            <div className="row"><span className="ico-tile"><Droplets size={22} /></span><div><h3 id="d-dif">Difusor de aroma</h3><span className="tag tag-sim">Simulado</span></div></div>
            <button type="button" role="switch" aria-checked={diffuser.on} aria-label="Difusor" className="switch" onClick={() => setIot('diffuser', { on: !diffuser.on })} />
          </div>
          <Segmented label="Intensidad" value={diffuser.level} onChange={(x) => setIot('diffuser', { level: x, on: true })} options={[{ value: 1, label: 'Suave' }, { value: 2, label: 'Media' }, { value: 3, label: 'Alta' }]} />
          <p className="muted small">{diffuser.on ? `Encendido · intensidad ${['', 'suave', 'media', 'alta'][diffuser.level]}` : 'Apagado'}</p>
          <LinkBox title="Vincular" options={[
            { icon: Bluetooth, label: 'Difusor Bluetooth', hint: 'Se vincula y explora. La mayoría de difusores Wi‑Fi o con enchufe inteligente solo se manejan desde su propia app.', onClick: () => navigate('/dispositivos') }
          ]} />
        </section>
      </div>

      <Sheet open={!!linkRole} onClose={() => setLinkRole(null)} title={linkRole ? `Vincular: ${ROLES[linkRole]}` : ''}>
        {linkRole && (
          <div className="stack">
            {hub.status !== 'host' ? (
              <p className="muted">{hub.status === 'connecting' ? 'Creando código…' : 'Preparando…'}</p>
            ) : (
              <>
                <p className="muted">En el otro dispositivo abre este enlace, o entra a <b>{location.host}{location.pathname}#/conectar</b> y escribe el código.</p>
                <div className="card tnum" style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 750, letterSpacing: '0.2em' }}>{hub.code}</div>
                <div className="row-wrap">
                  <button className="btn btn-primary" onClick={() => shareLink(linkRole)}><Share2 size={18} /> Compartir enlace</button>
                  <button className="btn" onClick={() => navigator.clipboard?.writeText(joinUrl(linkRole)).then(() => toast('Enlace copiado'))}><Copy size={18} /> Copiar enlace</button>
                </div>
                <div className="row-wrap">
                  {devicesOf(linkRole).length === 0 ? <span className="muted small">Esperando dispositivos…</span> : devicesOf(linkRole).map((d) => <span key={d.id} className="tag tag-live">{d.name}</span>)}
                </div>
              </>
            )}
            {hub.error && <div className="notice warn" role="alert">{hub.error}</div>}
            {hub.status === 'host' && <button className="btn btn-ghost" onClick={() => { stopHub(); setLinkRole(null) }}><Unplug size={18} /> Desconectar todos los dispositivos</button>}
          </div>
        )}
      </Sheet>

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
            'El parlante suena de verdad en tu dispositivo. La lámpara y el difusor están simulados: en producción se conectarían por MQTT o Matter.',
            'TV y parlantes extra: toca “Conectar dispositivos” y abre el enlace en la Smart TV, otra laptop o un teléfono. La TV muestra la respiración y la luz de la escena; los parlantes reproducen el mismo sonido; un teléfono en modo Luz ilumina la habitación con el color de la lámpara.',
            '“Sonido por otro parlante” envía el audio a un parlante Bluetooth o a la TV por HDMI (Chrome, Edge o Firefox).'
          ]}
        />
      </div>
      <VoiceHints items={['escena calma', 'enciende la lámpara', 'pon olas', 'apaga todo', 'simula estrés', 'mi pulso']} />
    </div>
  )
}
