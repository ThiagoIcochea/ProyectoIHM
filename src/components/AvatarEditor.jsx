import { useRef, useState } from 'react'
import { Sparkles, Upload, Shuffle, RotateCcw } from 'lucide-react'
import { setState, useStore } from '../lib/store'
import { hasKey } from '../lib/groq'
import { avatarFromImage } from '../lib/avatarAI'
import {
  avatarSVG, normalizeAvatar, DEFAULT_AVATAR, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH, PANTS, SHOES,
  BODIES, BUILDS, HEIGHTS, EXPRESSIONS, BROWS, HAIRS, FACIAL, TOPS, ACCESSORIES
} from '../modalities/avatars'
import { Segmented } from './ui'

function Swatches({ label, value, options, onChange }) {
  return (
    <div className="stack-sm">
      <span className="label">{label}</span>
      <div className="row-wrap" role="radiogroup" aria-label={label}>
        {options.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)} className="swatch" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}
function Choice({ label, value, options, onChange }) {
  return (
    <div className="stack-sm">
      <span className="label">{label}</span>
      <div className="row-wrap" role="radiogroup" aria-label={label}>
        {Object.entries(options).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className="opt-chip" onClick={() => onChange(k)}>{l}</button>
        ))}
      </div>
    </div>
  )
}

const TABS = { cuerpo: 'Cuerpo', cara: 'Cara', pelo: 'Pelo', ropa: 'Ropa', accesorios: 'Accesorios', ia: 'Con IA' }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export default function AvatarEditor({ onChange }) {
  const stored = useStore((s) => s.avatar)
  const a = normalizeAvatar(stored || {})
  const [tab, setTab] = useState('cuerpo')
  const [busy, setBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [preview, setPreview] = useState('')
  const fileRef = useRef(null)

  const save = (next) => {
    const v = normalizeAvatar(next)
    setState({ avatar: v })
    onChange?.(v)
  }
  const set = (patch) => save({ ...a, ...patch })
  const toggleAcc = (k) => {
    const on = a.accessories.includes(k)
    if (!on && a.accessories.length >= 4) return setAiMsg('Máximo 4 accesorios. Quita uno para agregar otro.')
    setAiMsg('')
    set({ accessories: on ? a.accessories.filter((x) => x !== k) : [...a.accessories, k] })
  }
  const random = () => save({
    body: pick(Object.keys(BODIES)), build: pick(Object.keys(BUILDS)), height: pick(Object.keys(HEIGHTS)), skin: pick(SKINS), eyes: pick(EYE_COLORS),
    brows: pick(Object.keys(BROWS)), expression: pick(Object.keys(EXPRESSIONS)), hair: pick(Object.keys(HAIRS)), hairColor: pick(HAIR_COLORS),
    facial: Math.random() > 0.7 ? pick(Object.keys(FACIAL)) : 'ninguno', top: pick(Object.keys(TOPS)), outfit: pick(CLOTH), pants: pick(PANTS), shoes: pick(SHOES),
    accessories: Object.keys(ACCESSORIES).filter(() => Math.random() > 0.8)
  })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setAiMsg('Elige una imagen (JPG o PNG).')
    setBusy(true)
    setAiMsg('Analizando la imagen…')
    try {
      const r = await avatarFromImage(file, a)
      setPreview(r.preview)
      save(r.avatar)
      setAiMsg(r.ai ? 'Listo: la IA creó tu personaje. Puedes ajustar cualquier detalle en las otras pestañas.' : 'Tomé los colores de pelo, piel y ropa de tu imagen. Para reconocer peinado y accesorios, agrega tu clave de IA en Perfil.')
    } catch {
      setAiMsg('No pude leer esa imagen. Prueba con otra.')
    }
    setBusy(false)
  }

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div className="avatar-preview" dangerouslySetInnerHTML={{ __html: avatarSVG(a) }} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 180 }}>
          <Segmented label="Personaje" value={a.body} onChange={(v) => set({ body: v, facial: v === 'mujer' ? 'ninguno' : a.facial })} options={Object.entries(BODIES).map(([value, label]) => ({ value, label }))} />
          <div className="row-wrap">
            <button type="button" className="btn btn-sm" onClick={random}><Shuffle size={16} /> Sorpréndeme</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => save({ ...DEFAULT_AVATAR, body: a.body })}><RotateCcw size={16} /> Reiniciar</button>
          </div>
        </div>
      </div>

      <div className="tabs-scroll" role="tablist" aria-label="Partes del personaje">
        {Object.entries(TABS).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="tab-btn" onClick={() => setTab(k)}>{k === 'ia' && <Sparkles size={14} />} {l}</button>
        ))}
      </div>

      {tab === 'cuerpo' && (
        <div className="stack">
          <Choice label="Contextura" value={a.build} options={BUILDS} onChange={(v) => set({ build: v })} />
          <Choice label="Estatura" value={a.height} options={HEIGHTS} onChange={(v) => set({ height: v })} />
          <Swatches label="Tono de piel" value={a.skin} options={SKINS} onChange={(v) => set({ skin: v })} />
        </div>
      )}
      {tab === 'cara' && (
        <div className="stack">
          <Choice label="Expresión" value={a.expression} options={EXPRESSIONS} onChange={(v) => set({ expression: v })} />
          <Swatches label="Color de ojos" value={a.eyes} options={EYE_COLORS} onChange={(v) => set({ eyes: v })} />
          <Choice label="Cejas" value={a.brows} options={BROWS} onChange={(v) => set({ brows: v })} />
          <Choice label="Bigote o barba" value={a.facial} options={FACIAL} onChange={(v) => set({ facial: v })} />
        </div>
      )}
      {tab === 'pelo' && (
        <div className="stack">
          <Choice label="Peinado" value={a.hair} options={HAIRS} onChange={(v) => set({ hair: v })} />
          <Swatches label="Color de pelo" value={a.hairColor} options={HAIR_COLORS} onChange={(v) => set({ hairColor: v })} />
        </div>
      )}
      {tab === 'ropa' && (
        <div className="stack">
          <Choice label="Prenda" value={a.top} options={TOPS} onChange={(v) => set({ top: v })} />
          <Swatches label="Color de la prenda" value={a.outfit} options={CLOTH} onChange={(v) => set({ outfit: v })} />
          <Swatches label="Pantalón" value={a.pants} options={PANTS} onChange={(v) => set({ pants: v })} />
          <Swatches label="Zapatillas" value={a.shoes} options={SHOES} onChange={(v) => set({ shoes: v })} />
        </div>
      )}
      {tab === 'accesorios' && (
        <div className="stack-sm">
          <span className="label">Elige hasta 4 ({a.accessories.length}/4)</span>
          <div className="row-wrap">
            {Object.entries(ACCESSORIES).map(([k, l]) => (
              <button key={k} type="button" className="opt-chip" aria-pressed={a.accessories.includes(k)} onClick={() => toggleAcc(k)}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {tab === 'ia' && (
        <div className="stack">
          <p className="muted small">Sube una foto o un dibujo y {hasKey() ? 'la IA reconocerá peinado, ropa, accesorios y colores' : 'tomaremos los colores de pelo, piel y ropa'} para crear tu personaje. Usa una imagen tuya o un dibujo; no subas fotos de otras personas sin su permiso.</p>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={18} /> {busy ? 'Creando…' : 'Subir imagen'}</button>
            {preview && <img src={preview} alt="Imagen subida" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12 }} />}
          </div>
          <p className="muted small">{hasKey() ? 'La imagen se envía a Groq solo para describirla y no se guarda en Escucha.' : 'Sin clave de IA, la imagen no sale de tu dispositivo.'}</p>
        </div>
      )}
      {aiMsg && <p className="small" role="status">{aiMsg}</p>}
    </div>
  )
}
