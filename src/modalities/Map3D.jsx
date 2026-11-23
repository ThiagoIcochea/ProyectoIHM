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

async function fetchPlaces({ lat, lon }, radius = 3000) {
  const q = `[out:json][timeout:25];(nwr["amenity"~"^(hospital|clinic|doctors)$"](around:${radius},${lat},${lon});nwr["healthcare"~"^(psychologist|psychotherapist|counselling)$"](around:${radius},${lat},${lon}););out center 80;`
  const res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: q }) })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const data = await res.json()
  return data.elements
    .map((e) => {
      const t = e.tags || {}
      const plat = e.lat ?? e.center?.lat
      const plon = e.lon ?? e.center?.lon
      if (!t.name || plat == null) return null
      const kind = t.healthcare && TYPE[t.healthcare] ? t.healthcare : t.amenity
      return {
        id: `${e.type}/${e.id}`,
        name: t.name,
        type: TYPE[kind] || 'Salud',
        mental: ['psychologist', 'psychotherapist', 'counselling'].includes(kind) || /mental|psicol/i.test(t['healthcare:speciality'] || ''),
        lat: plat,
        lon: plon,
        phone: t.phone || t['contact:phone'] || '',
        address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
        hours: t.opening_hours || '',
        dist: distanceKm({ lat, lon }, { lat: plat, lon: plon })
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist)
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
    markers.current = places.slice(0, 40).map((p) => {
      const el = document.createElement('button')
      el.className = 'map-marker'
      el.style.background = p.mental ? 'var(--success)' : 'var(--primary)'
      el.setAttribute('aria-label', p.name)
      el.addEventListener('click', () => select(p))
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(map.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

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
          <p className="muted small">{usingGeo ? 'Lugares a menos de 3 km de tu ubicación.' : 'Mostrando Lima centro. Permite tu ubicación para ver lo más cercano.'} Verde: psicología o consejería.</p>
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
        {places.slice(0, 40).map((p) => (
          <div key={p.id} id={`pl-${p.id.replace('/', '-')}`} className="place" aria-current={sel === p.id} role="button" tabIndex={0} onClick={() => select(p)} onKeyDown={(e) => e.key === 'Enter' && select(p)}>
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
