import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { LocateFixed, Plus, Minus, RotateCw, Navigation, Phone, RefreshCw, Box, Square } from 'lucide-react'
import { useVoiceCommands } from '../lib/voice'
import { useStore } from '../lib/store'

// Mapa base: OpenFreeMap (datos de OpenStreetMap, sin clave). Lugares: Overpass API (OSM). Nada es inventado.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const LIMA = { lat: -12.0464, lon: -77.0428 }
const OVERPASS = 'https://overpass-api.de/api/interpreter'

const TYPE = {
  hospital: 'Hospital',
  clinic: 'Centro de salud o clínica',
  doctors: 'Consultorio médico',
  psychologist: 'Psicología',
  psychotherapist: 'Psicoterapia',
  counselling: 'Consejería'
}

function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Salud mental primero: psicología, psicoterapia, consejería, psiquiatría y Centros de Salud Mental Comunitarios (CSMC)
const MENTAL_NAME = /salud mental|psicol|psiqui|psicoterap|csmc|consejer|bienestar emocional|mental health/i
const MENTAL_KIND = ['psychologist', 'psychotherapist', 'counselling']
export const MENTAL_COLOR = '#8A5BD6'

async function fetchPlaces({ lat, lon }, radius = 3000, mentalRadius = 8000) {
  const a = (r) => `(around:${r},${lat},${lon})`
  const q = `[out:json][timeout:25];(
    nwr["healthcare"~"^(psychologist|psychotherapist|counselling)$"]${a(mentalRadius)};
    nwr["healthcare:speciality"~"psychiatry|psychology|mental",i]${a(mentalRadius)};
    nwr["amenity"~"^(clinic|doctors|hospital|social_facility)$"]["name"~"salud mental|psicol|psiqui|CSMC|consejer",i]${a(mentalRadius)};
    nwr["office"]["name"~"psicol|salud mental",i]${a(mentalRadius)};
    nwr["amenity"~"^(hospital|clinic|doctors)$"]${a(radius)};
  );out center 150;`
  const res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: q }) })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const data = await res.json()
  const seen = new Set()
  return data.elements
    .map((e) => {
      const t = e.tags || {}
      const plat = e.lat ?? e.center?.lat
      const plon = e.lon ?? e.center?.lon
      if (!t.name || plat == null) return null
      const id = `${e.type}/${e.id}`
      if (seen.has(id)) return null
      seen.add(id)
      const kind = t.healthcare && TYPE[t.healthcare] ? t.healthcare : t.amenity
      const mental = MENTAL_KIND.includes(t.healthcare) || /psychiatry|psychology|mental/i.test(t['healthcare:speciality'] || '') || MENTAL_NAME.test(t.name)
      let type = TYPE[kind] || 'Salud'
      if (mental) type = /csmc|salud mental comunitari/i.test(t.name) ? 'Centro de Salud Mental Comunitario' : /psiqui/i.test(t.name) || /psychiatry/i.test(t['healthcare:speciality'] || '') ? 'Psiquiatría' : TYPE[t.healthcare] || 'Psicología y salud mental'
      return {
        id,
        name: t.name,
        type,
        mental,
        lat: plat,
        lon: plon,
        phone: t.phone || t['contact:phone'] || '',
        address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
        hours: t.opening_hours || '',
        dist: distanceKm({ lat, lon }, { lat: plat, lon: plon })
      }
    })
    .filter(Boolean)
    // primero salud mental (por distancia), luego el resto
    .sort((x, y) => (x.mental === y.mental ? x.dist - y.dist : x.mental ? -1 : 1))
}

export default function Map3D() {
  const box = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const meMarker = useRef(null)
  const [pos, setPos] = useState(LIMA)
  const [usingGeo, setUsingGeo] = useState(false)
  const [places, setPlaces] = useState([])
  const [state, setStateL] = useState('loading') // loading | ok | error | empty
  const [mapErr, setMapErr] = useState('')
  const [sel, setSel] = useState(null)
  const [is3d, setIs3d] = useState(true)
  const [onlyMental, setOnlyMental] = useState(true)
  const mentalCount = places.filter((p) => p.mental).length
  const shown = (onlyMental && mentalCount ? places.filter((p) => p.mental) : places).slice(0, 60)
  const theme = useStore((s) => s.theme)

  // Crear mapa
  useEffect(() => {
    let m
    try {
      m = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: [LIMA.lon, LIMA.lat],
        zoom: 15,
        pitch: 60,
        bearing: -17,
        attributionControl: { compact: true },
        maxPitch: 75
      })
    } catch {
      setMapErr('Tu navegador no puede mostrar mapas 3D (WebGL desactivado).')
      return
    }
    map.current = m
    m.on('load', () => {
      const layers = m.getStyle().layers || []
      const has3d = layers.some((l) => l.type === 'fill-extrusion')
      if (!has3d && m.getSource('openmaptiles')) {
        m.addLayer({
          id: 'edificios-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#c9dcea',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85
          }
        })
      }
    })
    m.on('error', (e) => {
      if (String(e?.error?.message || '').includes('Failed to fetch')) setMapErr('No se pudo descargar el mapa. Revisa tu conexión.')
    })
    return () => m.remove()
  }, [])

  // Ubicación del usuario (si la permite); si no, Lima centro
  const locate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude })
        setUsingGeo(true)
      },
      () => setUsingGeo(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  useEffect(locate, [])

  // Cargar lugares reales alrededor
  const load = () => {
    setStateL('loading')
    fetchPlaces(pos)
      .then((list) => {
        setPlaces(list)
        setStateL(list.length ? 'ok' : 'empty')
      })
      .catch(() => setStateL('error'))
  }
  useEffect(() => {
    map.current?.flyTo({ center: [pos.lon, pos.lat], zoom: 15, pitch: is3d ? 60 : 0, essential: true })
    meMarker.current?.remove()
    if (map.current) {
      const el = document.createElement('div')
      el.className = 'map-marker me'
      el.setAttribute('aria-label', 'Tu ubicación')
      meMarker.current = new maplibregl.Marker({ element: el }).setLngLat([pos.lon, pos.lat]).addTo(map.current)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  // Marcadores
  useEffect(() => {
    markers.current.forEach((mk) => mk.remove())
    if (!map.current) return
    markers.current = shown.map((p) => {
      const el = document.createElement('button')
      el.className = `map-marker${p.mental ? ' mental' : ''}`
      if (p.mental) el.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg>'
      el.setAttribute('aria-label', p.name)
      el.addEventListener('click', () => select(p))
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(map.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, onlyMental])

  const select = (p) => {
    setSel(p.id)
    map.current?.flyTo({ center: [p.lon, p.lat], zoom: 17, pitch: is3d ? 62 : 0, bearing: (map.current.getBearing() + 25) % 360, duration: 1400, essential: true })
    document.getElementById(`pl-${p.id.replace('/', '-')}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const zoom = (d) => map.current?.easeTo({ zoom: map.current.getZoom() + d, duration: 300 })
  const rotate = () => map.current?.easeTo({ bearing: map.current.getBearing() + 45, duration: 600 })
  const toggle3d = () => {
    const next = !is3d
    setIs3d(next)
    map.current?.easeTo({ pitch: next ? 60 : 0, duration: 600 })
  }

  useVoiceCommands(
    'map',
    [
      { re: /\b(acerca\w*|zoom|mas cerca)\b/, label: 'acércate', run: () => zoom(1) },
      { re: /\b(aleja\w*|mas lejos)\b/, label: 'aléjate', run: () => zoom(-1) },
      { re: /\b(gira\w*|rota\w*)\b/, label: 'gira', run: rotate },
      { re: /\b(mi ubicacion|donde estoy|ubicame)\b/, label: 'mi ubicación', run: locate },
      { re: /\b(mas cercano|el primero)\b/, label: 'el más cercano', run: () => places[0] && select(places[0]), say: () => (places[0] ? `El más cercano es ${places[0].name}, a ${places[0].dist.toFixed(1)} kilómetros.` : 'Aún no encuentro lugares.') },
      { re: /\b(siguiente|otro)\b/, label: 'siguiente', run: () => { const i = places.findIndex((p) => p.id === sel); const p = places[(i + 1) % places.length]; if (p) select(p) }, say: () => { const i = places.findIndex((p) => p.id === sel); const p = places[(i + 1) % places.length]; return p ? `${p.name}, ${p.type}.` : '' } },
      { re: /\b(como llego|como llegar|direcciones|ruta)\b/, label: 'cómo llegar', run: () => { const p = places.find((x) => x.id === sel) || places[0]; if (p) window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`, '_blank') } },
      { re: /\b(vista (aerea|plana|2d))\b/, label: 'vista plana', run: () => is3d && toggle3d() },
      { re: /\b(vista 3d|tres de)\b/, label: 'vista 3D', run: () => !is3d && toggle3d() }
    ],
    [places, sel, is3d]
  )

  return (
    <div className="map-layout" data-theme-hint={theme}>
      <div className="map-box">
        <div ref={box} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa 3D de centros de salud" role="region" />
        {mapErr && <div className="glass" style={{ position: 'absolute', left: 60, right: 12, top: 12, zIndex: 3 }}>{mapErr}</div>}
        <div className="map-tools">
          <button className="btn btn-sm" style={{ width: 44, padding: 0 }} onClick={() => zoom(1)} aria-label="Acercar"><Plus size={18} /></button>
          <button className="btn btn-sm" style={{ width: 44, padding: 0 }} onClick={() => zoom(-1)} aria-label="Alejar"><Minus size={18} /></button>
          <button className="btn btn-sm" style={{ width: 44, padding: 0 }} onClick={rotate} aria-label="Girar"><RotateCw size={18} /></button>
          <button className="btn btn-sm" style={{ width: 44, padding: 0 }} onClick={toggle3d} aria-label={is3d ? 'Vista plana' : 'Vista 3D'}>{is3d ? <Square size={18} /> : <Box size={18} />}</button>
          <button className="btn btn-sm" style={{ width: 44, padding: 0 }} onClick={locate} aria-label="Mi ubicación"><LocateFixed size={18} /></button>
        </div>
      </div>
      <aside className="map-list" aria-label="Lugares cercanos">
        <div className="stack-sm">
          <span className="muted small">6 de 7 · OpenStreetMap · 3D</span>
          <h2>Ayuda cerca de ti</h2>
          <p className="muted small">{usingGeo ? 'Salud mental a menos de 8 km y otros centros a menos de 3 km de ti.' : 'Mostrando Lima centro. Permite tu ubicación para ver lo más cercano.'}</p>
          <div className="map-legend">
            <span><i className="dot" style={{ color: MENTAL_COLOR }} /> Psicología y salud mental ({mentalCount})</span>
            <span><i className="dot" style={{ color: 'var(--primary)' }} /> Otros centros de salud</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Qué mostrar" style={{ alignSelf: 'flex-start' }}>
            <button role="radio" aria-checked={onlyMental} onClick={() => setOnlyMental(true)}>Salud mental</button>
            <button role="radio" aria-checked={!onlyMental} onClick={() => setOnlyMental(false)}>Todos</button>
          </div>
          {onlyMental && state === 'ok' && !mentalCount && <p className="muted small">No hay centros de salud mental registrados cerca; te mostramos todos los centros de salud. También puedes llamar a la Línea 113, opción 5.</p>}
        </div>
        {state === 'loading' && <p className="muted" role="status">Buscando centros de salud…</p>}
        {state === 'error' && (
          <div className="notice warn">
            <div className="stack-sm">
              <span>No pude consultar OpenStreetMap ahora.</span>
              <button className="btn btn-sm" onClick={load}><RefreshCw size={16} /> Reintentar</button>
            </div>
          </div>
        )}
        {state === 'empty' && <p className="muted">No hay centros con nombre registrados en 3 km. Prueba alejar el mapa o usa la Línea 113.</p>}
        {shown.map((p) => (
          <div key={p.id} id={`pl-${p.id.replace('/', '-')}`} className={`place${p.mental ? ' mental' : ''}`} aria-current={sel === p.id} role="button" tabIndex={0} onClick={() => select(p)} onKeyDown={(e) => e.key === 'Enter' && select(p)}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <b>{p.name}</b>
              <span className="tag tnum">{p.dist < 1 ? `${Math.round(p.dist * 1000)} m` : `${p.dist.toFixed(1)} km`}</span>
            </div>
            <span className="muted small">{p.type}{p.address ? ` · ${p.address}` : ''}{p.hours ? ` · ${p.hours}` : ''}</span>
            {sel === p.id && (
              <div className="row-wrap">
                <a className="btn btn-primary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Navigation size={16} /> Cómo llegar</a>
                {p.phone && <a className="btn btn-sm" href={`tel:${p.phone.replace(/\s/g, '')}`} onClick={(e) => e.stopPropagation()}><Phone size={16} /> Llamar</a>}
              </div>
            )}
          </div>
        ))}
        <p className="muted small">Voz: “el más cercano”, “siguiente”, “cómo llegar”, “acércate”, “gira”, “vista plana”.</p>
      </aside>
    </div>
  )
}
