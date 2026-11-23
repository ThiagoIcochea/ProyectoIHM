// Conexión con relojes y pulseras por Web Bluetooth usando servicios GATT estándar del Bluetooth SIG.
// Muchos relojes comerciales (Apple Watch, la mayoría de Galaxy Watch, Mi Band) NO publican estos servicios
// a terceros; con ellos la vía que sí funciona son las notificaciones del teléfono (ver notify()).
import { useSyncExternalStore } from 'react'
import { setIot } from './store'

export const supportsBLE = typeof navigator !== 'undefined' && 'bluetooth' in navigator

const SERVICES = {
  heart_rate: 'heart_rate',
  battery_service: 'battery_service',
  device_information: 'device_information',
  health_thermometer: 'health_thermometer',
  blood_pressure: 'blood_pressure',
  pulse_oximeter: 0x1822,
  immediate_alert: 'immediate_alert',
  alert_notification: 'alert_notification',
  current_time: 'current_time'
}

// Servicios propietarios frecuentes en relojes y pulseras (Xiaomi/Huami, IMILAB, Amazfit, genéricos chinos, Nordic UART).
// Web Bluetooth solo deja leer los servicios declarados aquí, por eso la lista es amplia.
const VENDOR = {
  0xfee0: 'Xiaomi / Huami (MiBand)',
  0xfee1: 'Xiaomi / Huami (autenticación)',
  0xfe95: 'Xiaomi (MiBeacon)',
  0xfee7: 'Pulseras genéricas (WeChat)',
  0xfff0: 'Genérico FFF0',
  0xffe0: 'Genérico FFE0',
  0xfeea: 'Genérico FEEA',
  0xfdab: 'Xiaomi (FDAB)',
  0x1814: 'Velocidad de carrera',
  0x181c: 'Datos del usuario',
  0x183e: 'Monitor de actividad física',
  0x1816: 'Velocidad de ciclismo',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART (datos propietarios)',
  '0000d0ff-3c17-d293-8e48-14fe2e4da212': 'Genérico D0FF'
}
const NAMES = {
  '180d': 'Frecuencia cardiaca', '180f': 'Batería', '180a': 'Información del equipo', '1809': 'Temperatura', '1810': 'Presión arterial',
  '1822': 'Oxímetro', '1802': 'Alerta inmediata', '1811': 'Notificaciones', '1805': 'Hora', '2a37': 'Medición de pulso', '2a19': 'Nivel de batería',
  '2a29': 'Fabricante', '2a24': 'Modelo', '2a26': 'Firmware', '2a06': 'Nivel de alerta', '2a46': 'Nueva alerta', '2a2b': 'Hora actual', '2a1c': 'Temperatura', '2a35': 'Presión', '2a5f': 'SpO₂ continuo'
}
const short = (uuid) => {
  const m = String(uuid).match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i)
  return m ? m[1].toLowerCase() : String(uuid).toLowerCase()
}
const labelFor = (uuid) => {
  const k = short(uuid)
  if (NAMES[k]) return NAMES[k]
  const v = Object.entries(VENDOR).find(([key]) => (typeof key === 'string' && key.includes('-') ? key === k : Number(key).toString(16) === k))
  return v ? v[1] : 'Desconocido'
}
const toHex = (dv) => Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength), (b) => b.toString(16).padStart(2, '0')).join(' ')
const toText = (dv) => {
  const t = new TextDecoder().decode(dv)
  return /^[\x20-\x7E\u00A0-\u024F]+$/.test(t) ? t : ''
}
const ALL_OPTIONAL = [...Object.values(SERVICES), ...Object.keys(VENDOR).map((k) => (k.includes('-') ? k : Number(k)))]
export const CAPS = {
  heart_rate: 'Frecuencia cardiaca',
  battery_service: 'Batería',
  device_information: 'Información del equipo',
  health_thermometer: 'Temperatura',
  blood_pressure: 'Presión arterial',
  pulse_oximeter: 'Oxígeno en sangre (SpO₂)',
  immediate_alert: 'Vibrar o sonar (alerta)',
  alert_notification: 'Recibir notificaciones',
  current_time: 'Hora'
}

let st = { device: null, name: '', connected: false, caps: [], vitals: {}, info: {}, log: [], services: [], raw: {} }
const handles = {}
const ls = new Set()
const set = (patch) => {
  st = { ...st, ...patch }
  ls.forEach((l) => l())
}
const addLog = (t) => set({ log: [{ t, at: new Date() }, ...st.log].slice(0, 12) })
let chars = {}

export function useBle() {
  return useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => st, () => st)
}

// IEEE-11073 SFLOAT de 16 bits (presión arterial, SpO₂)
function sfloat(v) {
  let m = v & 0x0fff
  let e = v >> 12
  if (m >= 0x0800) m -= 0x1000
  if (e >= 0x8) e -= 0x10
  return m * Math.pow(10, e)
}
// IEEE-11073 FLOAT de 32 bits (temperatura)
function float32(dv, o) {
  let m = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16)
  if (m >= 0x800000) m -= 0x1000000
  const e = dv.getInt8(o + 3)
  return m * Math.pow(10, e)
}

async function tryService(server, key) {
  try { return await server.getPrimaryService(SERVICES[key]) } catch { return null }
}

export async function connect() {
  if (!supportsBLE) throw new Error('Este navegador no tiene Web Bluetooth. Usa Chrome o Edge en Android, Windows, macOS o ChromeOS.')
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ALL_OPTIONAL })
  set({ device, name: device.name || 'Dispositivo', connected: false, caps: [], vitals: {}, info: {} })
  device.addEventListener('gattserverdisconnected', () => {
    set({ connected: false })
    addLog('Desconectado')
    setIot('band', { source: 'sim' })
  })
  const server = await device.gatt.connect()
  chars = {}
  const caps = []
  const vitals = {}
  const info = {}

  const hr = await tryService(server, 'heart_rate')
  if (hr) {
    try {
      const c = await hr.getCharacteristic('heart_rate_measurement')
      await c.startNotifications()
      c.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value
        const bpm = d.getUint8(0) & 1 ? d.getUint16(1, true) : d.getUint8(1)
        set({ vitals: { ...st.vitals, bpm } })
        setIot('band', { bpm, source: 'ble' })
      })
      caps.push('heart_rate')
    } catch { /* sin notificaciones */ }
  }

  const bat = await tryService(server, 'battery_service')
  if (bat) {
    try {
      const c = await bat.getCharacteristic('battery_level')
      vitals.battery = (await c.readValue()).getUint8(0)
      caps.push('battery_service')
      try {
        await c.startNotifications()
        c.addEventListener('characteristicvaluechanged', (e) => set({ vitals: { ...st.vitals, battery: e.target.value.getUint8(0) } }))
      } catch { /* solo lectura */ }
    } catch { /* nada */ }
  }

  const di = await tryService(server, 'device_information')
  if (di) {
    const dec = new TextDecoder()
    for (const [k, ch] of [['fabricante', 'manufacturer_name_string'], ['modelo', 'model_number_string'], ['firmware', 'firmware_revision_string']]) {
      try { info[k] = dec.decode(await (await di.getCharacteristic(ch)).readValue()) } catch { /* no disponible */ }
    }
    if (Object.keys(info).length) caps.push('device_information')
  }

  const th = await tryService(server, 'health_thermometer')
  if (th) {
    try {
      const c = await th.getCharacteristic('temperature_measurement')
      await c.startNotifications()
      c.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value
        let t = float32(d, 1)
        if (d.getUint8(0) & 1) t = ((t - 32) * 5) / 9
        set({ vitals: { ...st.vitals, temp: Math.round(t * 10) / 10 } })
      })
      caps.push('health_thermometer')
    } catch { /* nada */ }
  }

  const bp = await tryService(server, 'blood_pressure')
  if (bp) {
    try {
      const c = await bp.getCharacteristic('blood_pressure_measurement')
      await c.startNotifications()
      c.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value
        set({ vitals: { ...st.vitals, sys: Math.round(sfloat(d.getUint16(1, true))), dia: Math.round(sfloat(d.getUint16(3, true))) } })
      })
      caps.push('blood_pressure')
    } catch { /* nada */ }
  }

  const ox = await tryService(server, 'pulse_oximeter')
  if (ox) {
    try {
      const c = await ox.getCharacteristic(0x2a5f) // PLX Continuous Measurement
      await c.startNotifications()
      c.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value
        set({ vitals: { ...st.vitals, spo2: Math.round(sfloat(d.getUint16(1, true))) } })
      })
      caps.push('pulse_oximeter')
    } catch { /* nada */ }
  }

  const ia = await tryService(server, 'immediate_alert')
  if (ia) {
    try { chars.alert = await ia.getCharacteristic('alert_level'); caps.push('immediate_alert') } catch { /* nada */ }
  }
  const an = await tryService(server, 'alert_notification')
  if (an) {
    try { chars.newAlert = await an.getCharacteristic('new_alert'); caps.push('alert_notification') } catch { /* nada */ }
  }
  const ct = await tryService(server, 'current_time')
  if (ct) caps.push('current_time')

  // Explorador: todos los servicios y características accesibles, incluidos los propietarios
  const services = []
  try {
    for (const svc of await server.getPrimaryServices()) {
      const entry = { uuid: svc.uuid, label: labelFor(svc.uuid), chars: [] }
      try {
        for (const ch of await svc.getCharacteristics()) {
          const key = `${svc.uuid}|${ch.uuid}`
          handles[key] = ch
          const p = ch.properties
          entry.chars.push({ key, uuid: ch.uuid, label: labelFor(ch.uuid), read: p.read, notify: p.notify || p.indicate, write: p.write || p.writeWithoutResponse })
        }
      } catch { /* servicio protegido */ }
      services.push(entry)
    }
  } catch { /* el equipo no deja enumerar */ }

  set({ connected: true, caps, vitals: { ...st.vitals, ...vitals }, info, services })
  addLog(`Conectado a ${st.name}: ${caps.length ? caps.map((c) => CAPS[c]).join(', ') : 'sin servicios estándar'}`)
  return st
}

export function disconnect() {
  st.device?.gatt?.disconnect()
}

// Hace vibrar/sonar el reloj (Immediate Alert: 0 nada, 1 suave, 2 fuerte)
export async function buzz(level = 2) {
  if (!chars.alert) throw new Error('Este reloj no permite alertas directas.')
  const write = chars.alert.writeValueWithoutResponse?.bind(chars.alert) || chars.alert.writeValue.bind(chars.alert)
  await write(new Uint8Array([level]))
  addLog('Alerta de vibración enviada')
}

// Notificación al reloj por Alert Notification Service (categoría 0x07 = mensaje instantáneo)
export async function sendWatchText(text) {
  if (!chars.newAlert) throw new Error('Este reloj no acepta notificaciones por Bluetooth estándar.')
  const body = new TextEncoder().encode(text.slice(0, 18))
  const msg = new Uint8Array(2 + body.length)
  msg[0] = 0x07
  msg[1] = 1
  msg.set(body, 2)
  await chars.newAlert.writeValue(msg)
  addLog(`Notificación enviada: “${text.slice(0, 18)}”`)
}

// Vía universal: notificación del sistema. Si el reloj está emparejado al teléfono, la refleja.
export async function notify(title, body, url) {
  if (!('Notification' in window)) throw new Error('Este navegador no permite notificaciones.')
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') throw new Error('No diste permiso para notificaciones.')
  }
  const opts = { body, icon: new URL('icon.svg', document.baseURI).href, vibrate: [200, 100, 200], tag: `escucha-${Date.now()}`, data: { url: url || './' } }
  const reg = await navigator.serviceWorker?.getRegistration?.()
  if (reg) await reg.showNotification(title, opts)
  else new Notification(title, opts)
  addLog(`Notificación del sistema: ${title}`)
}

// ---------- Explorador genérico (cualquier reloj) ----------
export async function readRaw(key) {
  const ch = handles[key]
  if (!ch) return
  const v = await ch.readValue()
  set({ raw: { ...st.raw, [key]: { hex: toHex(v), text: toText(v), at: new Date() } } })
}
export async function subscribeRaw(key) {
  const ch = handles[key]
  if (!ch) return
  ch.addEventListener('characteristicvaluechanged', (e) => {
    const v = e.target.value
    set({ raw: { ...st.raw, [key]: { hex: toHex(v), text: toText(v), at: new Date(), live: true } } })
  })
  await ch.startNotifications()
  addLog(`Escuchando ${labelFor(ch.uuid)} (${short(ch.uuid)})`)
}
