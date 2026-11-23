import { Phone, MessageSquareText, ExternalLink } from 'lucide-react'
import { HELPLINES } from '../lib/crisis'

export default function Helplines({ compact = false }) {
  const list = compact ? HELPLINES.slice(0, 3) : HELPLINES
  return (
    <div className="stack-sm">
      {list.map((h) => (
        <a
          key={h.id}
          href={h.tel ? `tel:${h.tel}` : h.href}
          target={h.href ? '_blank' : undefined}
          rel={h.href ? 'noreferrer' : undefined}
          className={`card card-link row${h.primary ? '' : ''}`}
          style={{ padding: 14, borderColor: h.primary ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : undefined }}
        >
          <span className={`ico-tile ${h.primary ? 'danger' : ''}`}>
            {h.href ? <MessageSquareText size={20} /> : <Phone size={20} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{h.name}</b>
            <br />
            <span className="muted small">{h.detail}</span>
          </span>
          {h.href ? <ExternalLink size={18} className="muted" aria-hidden="true" /> : <span className="tag">{h.tel === '080041212' ? '0800-4-1212' : h.tel}</span>}
        </a>
      ))}
    </div>
  )
}
