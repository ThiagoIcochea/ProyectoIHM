import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bluetooth, BluetoothOff, HeartPulse, BatteryMedium, Thermometer, Activity, Droplet, Vibrate, BellRing, Send, Watch, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useBle, connect, disconnect, buzz, sendWatchText, notify, supportsBLE, CAPS } from '../lib/ble'
import { useVoiceCommands } from '../lib/voice'
import { Notice, Segmented, HowTo, VoiceHints } from '../components/ui'
import { toast } from '../components/Toast'

function Vital({ icon: Icon, label, value, unit, tone }) {
  return (
    <div className="card stack-sm" style={{ padding: 14 }}>
      <span className="row" style={{ gap: 8 }}><span className={`ico-tile ${tone || ''}`} style={{ width: 36, height: 36 }}><Icon size={18} /></span><span className="muted small">{label}</span></span>
      <span className="tnum" style={{ fontSize: '1.8rem', fontWeight: 750, letterSpacing: '-0.02em' }}>{value ?? '—'}<span className="muted small" style={{ fontWeight: 600 }}> {value != null ? unit : ''}</span></span>
    </div>
  )
}

export default function Devices() {
  const b = useBle()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('Respira conmigo')
  const [every, setEvery] = useState(0)
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const timer = useRef(null)

  const doConnect = async () => {
    setBusy(true)
    try {
      const r = await connect()
      toast(r.caps.length ? `Conectado: ${r.name}` : `${r.name} se conectó, pero no comparte datos estándar.`, { tone: r.caps.length ? 'info' : 'warn', duration: 5000 })
    } catch (e) {
      if (e?.name !== 'NotFoundError') toast(e.message || 'No se pudo conectar.', { tone: 'warn', duration: 5000 })
    }
    setBusy(false)
  }

  const run = async (fn, ok) => {
    try {
      await fn()
      if (ok) toast(ok)
    } catch (e) {
      toast(e.message, { tone: 'warn', duration: 5000 })
    }
    if ('Notification' in window) setPerm(Notification.permission)
  }

  // Recordatorios de respiración mientras Escucha está abierta
  useEffect(() => {
    clearInterval(timer.current)
    if (!every) return
    timer.current = setInterval(() => {
      notify('Escucha · pausa', 'Tómate un minuto para respirar.', './#/respirar').catch(() => {})
      if (b.caps.includes('immediate_alert')) buzz(1).catch(() => {})
    }, every * 60000)
    return () => clearInterval(timer.current)
  }, [every, b.caps])

  useVoiceCommands(
    'devices',
    [
      { re: /\b(conecta\w*|vincula\w*|empareja\w*)\b/, label: 'conectar reloj', run: doConnect },
      { re: /\b(desconecta\w*)\b/, label: 'desconectar', run: disconnect },
      { re: /\b(vibra\w*|haz vibrar)\b/, label: 'haz vibrar el reloj', run: () => run(() => buzz(2), 'Alerta enviada') },
      { re: /\b(notifica\w*|avisa\w*)\b/, label: 'enviar notificación', run: () => run(() => notify('Escucha', msg), 'Notificación enviada') }
    ],
    [msg, b.caps]
  )

  const has = (c) => b.caps.includes(c)
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="mod-head">
        <div className="stack-sm" style={{ maxWidth: 600 }}>
          <h1>Mis dispositivos</h1>
          <p className="muted">Vincula tu reloj o pulsera por Bluetooth para ver tus signos vitales en Escucha y recibir avisos en la muñeca.</p>
        </div>
        {b.connected ? (
          <button className="btn" onClick={disconnect}><BluetoothOff size={18} /> Desconectar</button>
        ) : (
          <button className="btn btn-primary" onClick={doConnect} disabled={busy || !supportsBLE}><Bluetooth size={18} /> {busy ? 'Buscando…' : 'Vincular reloj'}</button>
        )}
      </div>

      {!supportsBLE && (
        <Notice tone="warn" icon={AlertTriangle}>
          Este navegador no permite Bluetooth web. Funciona en Chrome o Edge para Android, Windows, macOS y ChromeOS. En iPhone no está disponible en Safari. Aun así puedes recibir avisos en tu reloj con las notificaciones de abajo.
        </Notice>
      )}

      <section className="card stack">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="row"><span className="ico-tile"><Watch size={22} /></span><div><h2>{b.device ? b.name : 'Ningún reloj vinculado'}</h2>
            <span className={`tag ${b.connected ? 'tag-live' : ''}`}>{b.connected ? 'Conectado' : b.device ? 'Desconectado' : 'Sin vincular'}</span></div></div>
          {b.info && Object.keys(b.info).length > 0 && <span className="muted small">{Object.entries(b.info).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>}
        </div>
        {b.device && (
          <div className="stack-sm">
            <span className="label">Lo que comparte este dispositivo</span>
            <div className="row-wrap">
              {Object.entries(CAPS).map(([k, l]) => (
                <span key={k} className={`tag ${has(k) ? 'tag-live' : ''}`} style={has(k) ? undefined : { opacity: 0.55 }}>{has(k) && <CheckCircle2 size={12} />} {l}</span>
              ))}
            </div>
            {b.connected && b.caps.length === 0 && (
              <p className="muted small">Este equipo no publica servicios estándar de salud. Es normal en Apple Watch, muchos Galaxy Watch y Mi Band: sus datos solo los lee la app oficial del fabricante. Usa las notificaciones del teléfono.</p>
            )}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))' }}>
          <Vital icon={HeartPulse} label="Pulso" value={b.vitals.bpm} unit="lpm" tone="danger" />
          <Vital icon={Droplet} label="Oxígeno" value={b.vitals.spo2} unit="%" />
          <Vital icon={Thermometer} label="Temperatura" value={b.vitals.temp} unit="°C" />
          <Vital icon={Activity} label="Presión" value={b.vitals.sys ? `${b.vitals.sys}/${b.vitals.dia}` : null} unit="mmHg" />
          <Vital icon={BatteryMedium} label="Batería" value={b.vitals.battery} unit="%" tone="success" />
        </div>
        {b.vitals.bpm != null && <p className="muted small">El pulso también alimenta el reloj de Escucha y la automatización del <Link to="/m/iot">Hogar IoT</Link>.</p>}
      </section>

      <section className="card stack">
        <div className="row"><span className="ico-tile"><BellRing size={22} /></span><h2>Avisos en tu muñeca</h2></div>
        <div className="field">
          <label className="label" htmlFor="watch-msg">Mensaje</label>
          <input id="watch-msg" className="input" value={msg} maxLength={60} onChange={(e) => setMsg(e.target.value)} />
        </div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={() => run(() => notify('Escucha', msg, './#/respirar'), 'Notificación enviada')}><BellRing size={18} /> Notificar al teléfono y reloj</button>
          <button className="btn" disabled={!has('alert_notification')} onClick={() => run(() => sendWatchText(msg), 'Enviado al reloj')}><Send size={18} /> Enviar por Bluetooth</button>
          <button className="btn" disabled={!has('immediate_alert')} onClick={() => run(() => buzz(2), 'El reloj debería vibrar')}><Vibrate size={18} /> Hacer vibrar</button>
        </div>
        <p className="muted small">
          Permiso de notificaciones: <b>{perm === 'granted' ? 'concedido' : perm === 'denied' ? 'bloqueado (cámbialo en los ajustes del navegador)' : perm === 'unsupported' ? 'no disponible' : 'pendiente'}</b>.
          Si tu reloj está emparejado con el teléfono (Wear OS, Galaxy, Apple Watch, Mi Band…), refleja estas notificaciones. En iPhone solo funcionan si agregas Escucha a la pantalla de inicio.
        </p>
        <div className="field">
          <span className="label">Recordatorio para respirar</span>
          <Segmented label="Recordatorio" value={every} onChange={setEvery} options={[{ value: 0, label: 'Apagado' }, { value: 30, label: 'Cada 30 min' }, { value: 60, label: 'Cada hora' }, { value: 120, label: 'Cada 2 h' }]} />
          <span className="muted small">Funciona mientras Escucha esté abierta. Para avisos con la app cerrada se necesitaría un servidor de notificaciones push.</span>
        </div>
      </section>

      {b.log.length > 0 && (
        <section className="card stack-sm">
          <h3>Actividad</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {b.log.map((l, i) => <li key={i}><span className="muted tnum">{l.at.toLocaleTimeString('es-PE')}</span> · {l.t}</li>)}
          </ul>
        </section>
      )}

      <HowTo
        items={[
          'Toca “Vincular reloj” y elige tu equipo en la lista del navegador. Mantén el reloj cerca y con Bluetooth activo.',
          'Lecturas compatibles: servicios estándar Bluetooth de frecuencia cardiaca, batería, temperatura, presión, oxímetro, alertas y notificaciones. Bandas de pecho como la Polar H10 los publican; algunos relojes también, si tienen una opción para transmitir la frecuencia cardiaca.',
          'Si el reloj ya está conectado al teléfono por su app oficial, puede que no aparezca: desconéctalo de esa app o activa su modo de transmisión.',
          'No pudimos probar con relojes reales: los datos dependen de lo que cada fabricante comparta.'
        ]}
      />
      <VoiceHints items={['vincular reloj', 'haz vibrar el reloj', 'enviar notificación', 'desconectar']} />
    </div>
  )
}
