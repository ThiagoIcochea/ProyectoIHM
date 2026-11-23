import { setState, useStore } from '../lib/store'
import { avatarSVG, normalizeAvatar, SKINS, HAIR_COLORS, OUTFITS, HAIRS, ACCESSORIES } from '../modalities/avatars'
import { Segmented } from './ui'

function Swatches({ label, value, options, onChange }) {
  return (
    <div className="stack-sm">
      <span className="label">{label}</span>
      <div className="row-wrap" role="radiogroup" aria-label={label}>
        {options.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer', border: value === c ? '3px solid var(--primary)' : '2px solid var(--border)', boxShadow: value === c ? '0 0 0 2px var(--surface) inset' : 'none' }} />
        ))}
      </div>
    </div>
  )
}

export default function AvatarEditor({ onChange }) {
  const stored = useStore((s) => s.avatar)
  const a = normalizeAvatar(stored || {})
  const set = (patch) => {
    const next = normalizeAvatar({ ...a, ...patch })
    setState({ avatar: next })
    onChange?.(next)
  }
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 120, flex: 'none' }} dangerouslySetInnerHTML={{ __html: avatarSVG(a) }} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 200 }}>
          <span className="label">Personaje</span>
          <Segmented label="Personaje" value={a.body} onChange={(v) => set({ body: v, hair: v === 'hombre' && a.hair === 'largo' ? 'corto' : v === 'mujer' && a.hair === 'rapado' ? 'largo' : a.hair })} options={[{ value: 'mujer', label: 'Mujer' }, { value: 'hombre', label: 'Hombre' }]} />
          <span className="muted small">Puedes cambiarlo cuando quieras. Los demás lo ven en la sala.</span>
        </div>
      </div>
      <Swatches label="Tono de piel" value={a.skin} options={SKINS} onChange={(v) => set({ skin: v })} />
      <div className="stack-sm">
        <span className="label">Peinado</span>
        <Segmented label="Peinado" value={a.hair} onChange={(v) => set({ hair: v })} options={Object.entries(HAIRS).map(([value, label]) => ({ value, label }))} />
      </div>
      <Swatches label="Color de pelo" value={a.hairColor} options={HAIR_COLORS} onChange={(v) => set({ hairColor: v })} />
      <Swatches label="Color de ropa" value={a.outfit} options={OUTFITS} onChange={(v) => set({ outfit: v })} />
      <div className="stack-sm">
        <span className="label">Accesorio</span>
        <Segmented label="Accesorio" value={a.accessory} onChange={(v) => set({ accessory: v })} options={Object.entries(ACCESSORIES).map(([value, label]) => ({ value, label }))} />
      </div>
    </div>
  )
}
