import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { AlertTriangle, PauseCircle, Trash2, CalendarClock, FileCheck2, Download, Eye, EyeOff } from 'lucide-react'
import { useAccount, checkPassword, deactivate, requestDeletion, exportData, download, GRACE } from '../lib/auth'
import { useStore } from '../lib/store'
import { Notice } from '../components/ui'
import { toast } from '../components/Toast'

const STEPS = ['Advertencia', 'Alternativa', 'Motivo', 'Confirmación', 'Periodo de gracia', 'Comprobante']
const REASONS = ['Ya no la necesito', 'Me preocupa mi privacidad', 'Uso otra app', 'Prefiero no decirlo']

export default function DeleteAccount() {
  const acc = useAccount()
  const s = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [reason, setReason] = useState('')
  const [word, setWord] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  if (!acc && !result) return <Navigate to="/perfil" replace />

  const confirm = async (e) => {
    e.preventDefault()
    setError('')
    if (word.trim() !== 'ELIMINAR') return setError('Escribe ELIMINAR en mayúsculas para confirmar.')
    setBusy(true)
    const ok = await checkPassword(acc.id, pass)
    setBusy(false)
    if (!ok) return setError('La contraseña no es correcta.')
    setStep(4)
  }

  const schedule = () => {
    const r = requestDeletion(acc.id, reason)
    setResult({ ...r, at: new Date().toISOString() })
    setStep(5)
  }

  const receipt = result
    ? `Escucha — comprobante de solicitud de eliminación\n\nSolicitud: ${result.requestId}\nUsuario: ${result.username}\nFecha de solicitud: ${new Date(result.at).toLocaleString('es-PE')}\nEliminación definitiva: ${new Date(result.deleteAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nHasta esa fecha puedes iniciar sesión y cancelar la eliminación.\nDespués se borrarán tu diario, tus registros de emociones, tu chat y tus ajustes de este dispositivo.`
    : ''

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="stack-sm">
        <span className="muted small tnum">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</span>
        <div className="steps" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} style={i <= step ? { background: 'var(--danger)' } : undefined} />)}</div>
      </div>

      {step === 0 && (
        <section className="card stack">
          <div className="row"><span className="ico-tile danger"><AlertTriangle size={22} /></span><h1 style={{ fontSize: '1.5rem' }}>Eliminar tu cuenta</h1></div>
          <p className="muted">Antes de seguir, esto es lo que se borrará de forma definitiva de la cuenta <b style={{ color: 'var(--ink)' }}>{acc.display}</b>:</p>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>{s.journal.length} entradas de tu diario</li>
            <li>{s.checkins.length} registros de emociones</li>
            <li>{s.chat.length} mensajes con el asistente</li>
            <li>Tus ajustes de accesibilidad, voz y dispositivos</li>
          </ul>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => download(`escucha-${acc.username}.json`, exportData(), 'application/json')}><Download size={18} /> Descargar mis datos primero</button>
          <div className="row-wrap">
            <button className="btn btn-danger" onClick={() => setStep(1)}>Continuar</button>
            <Link className="btn" to="/perfil">Mantener mi cuenta</Link>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="card stack">
          <div className="row"><span className="ico-tile"><PauseCircle size={22} /></span><h1 style={{ fontSize: '1.5rem' }}>¿Prefieres desactivarla?</h1></div>
          <p className="muted">Si solo quieres tomar una pausa, puedes desactivar la cuenta. Se cierra tu sesión, no se borra nada y vuelve a activarse cuando inicies sesión.</p>
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={() => { deactivate(acc.id); toast('Cuenta desactivada. Inicia sesión cuando quieras volver.'); navigate('/', { replace: true }) }}>Desactivar en su lugar</button>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>No, quiero eliminarla</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card stack">
          <h1 style={{ fontSize: '1.5rem' }}>¿Por qué te vas?</h1>
          <p className="muted">Es opcional. Nos ayuda a mejorar.</p>
          <div className="stack-sm" role="radiogroup" aria-label="Motivo">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className="chip" style={{ justifyContent: 'flex-start' }} onClick={() => setReason(r)}>
                <span className="chip-check" aria-hidden="true" style={{ borderRadius: '50%' }} />
                {r}
              </button>
            ))}
          </div>
          <div className="row-wrap">
            <button className="btn btn-danger" onClick={() => setStep(3)}>Continuar</button>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Atrás</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <form className="card stack" onSubmit={confirm} noValidate>
          <div className="row"><span className="ico-tile danger"><Trash2 size={22} /></span><h1 style={{ fontSize: '1.5rem' }}>Confirma que eres tú</h1></div>
          <div className="field">
            <label className="label" htmlFor="del-word">Escribe <b>ELIMINAR</b></label>
            <input id="del-word" className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" aria-invalid={!!error && word.trim() !== 'ELIMINAR'} />
          </div>
          <div className="field">
            <label className="label" htmlFor="del-pass">Tu contraseña</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="del-pass" className="input" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
          </div>
          {error && <div className="notice danger" role="alert"><AlertTriangle size={18} aria-hidden="true" /><div>{error}</div></div>}
          <div className="row-wrap">
            <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? 'Verificando…' : 'Confirmar'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>Atrás</button>
          </div>
        </form>
      )}

      {step === 4 && (
        <section className="card stack">
          <div className="row"><span className="ico-tile"><CalendarClock size={22} /></span><h1 style={{ fontSize: '1.5rem' }}>Tienes {GRACE} días para arrepentirte</h1></div>
          <p className="muted">Tu cuenta quedará bloqueada y se eliminará por completo el <b style={{ color: 'var(--ink)' }}>{new Date(Date.now() + GRACE * 864e5).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</b>. Hasta entonces, si inicias sesión podrás cancelar la eliminación.</p>
          <Notice>Si te estás yendo porque estás pasando un mal momento, la Línea 113, opción 5, es gratuita y atiende las 24 horas.</Notice>
          <div className="row-wrap">
            <button className="btn btn-danger" onClick={schedule}>Programar eliminación</button>
            <Link className="btn" to="/perfil">Cancelar, mantener cuenta</Link>
          </div>
        </section>
      )}

      {step === 5 && result && (
        <section className="card stack">
          <div className="row"><span className="ico-tile success"><FileCheck2 size={22} /></span><h1 style={{ fontSize: '1.5rem' }}>Solicitud registrada</h1></div>
          <pre className="card" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, background: 'var(--surface-2)', fontSize: '0.9rem' }}>{receipt}</pre>
          <p className="muted small">Escucha no tiene tu correo, así que el comprobante no se envía: descárgalo y guárdalo.</p>
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={() => download(`comprobante-${result.requestId}.txt`, receipt)}><Download size={18} /> Descargar comprobante</button>
            <Link className="btn" to="/" replace>Ir al inicio</Link>
          </div>
        </section>
      )}
    </div>
  )
}
