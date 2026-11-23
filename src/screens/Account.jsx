import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Copy, Download, ShieldCheck, LogIn, UserPlus, AlertTriangle } from 'lucide-react'
import { register, login, recover, cancelDeletion, download, GRACE } from '../lib/auth'
import { useStore } from '../lib/store'
import { Segmented, Notice } from '../components/ui'
import { Logo } from '../components/AppShell'
import { toast } from '../components/Toast'
import { useVoiceCommands } from '../lib/voice'

function PasswordField({ id, label, value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="row" style={{ gap: 8 }}>
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
      </div>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

export default function Account() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('modo') === 'crear' ? 'crear' : params.get('modo') === 'recuperar' ? 'recuperar' : 'ingresar')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [code, setCode] = useState('')
  const [carry, setCarry] = useState(true)
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)
  const [pending, setPending] = useState(null)
  const guestHasData = useStore((s) => s.checkins.length + s.journal.length + s.chat.length > 0)
  const navigate = useNavigate()

  const go = () => navigate('/', { replace: true })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (tab === 'ingresar') {
        const r = await login({ username: user, password: pass })
        if (r.pendingDelete) setPending(r)
        else {
          toast(r.reactivated ? 'Cuenta reactivada. ¡Bienvenido de vuelta!' : `Hola, ${r.account.display}`)
          go()
        }
      } else if (tab === 'crear') {
        if (pass !== pass2) throw new Error('Las contraseñas no coinciden.')
        if (!accept) throw new Error('Acepta el aviso de privacidad para continuar.')
        const r = await register({ username: user, password: pass, carryData: carry })
        setCreated(r)
      } else {
        if (pass !== pass2) throw new Error('Las contraseñas no coinciden.')
        await recover({ username: user, code, newPassword: pass })
        toast('Contraseña cambiada. Ya puedes iniciar sesión.')
        setTab('ingresar')
        setPass('')
        setPass2('')
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error.')
    }
    setBusy(false)
  }

  useVoiceCommands(
    'account',
    [
      { re: /\b(crear|registr\w*|nueva) (una )?cuenta\b|\bregistrarme\b/, label: 'crear cuenta', run: () => setTab('crear') },
      { re: /\b(iniciar|inicia) sesion\b|\bingresar\b|\bentrar\b/, label: 'iniciar sesión', run: () => setTab('ingresar') },
      { re: /\b(olvide|recuperar) (mi )?contrasena\b/, label: 'recuperar contraseña', run: () => setTab('recuperar') },
      { re: /\b(sin cuenta|anonimo|invitado)\b/, label: 'continuar sin cuenta', run: go }
    ],
    []
  )

  if (pending) {
    const date = new Date(pending.pendingDelete).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    return (
      <div className="onb">
        <div className="onb-card">
          <Notice tone="warn" icon={AlertTriangle}>
            <b>Tu cuenta está programada para eliminarse el {date}.</b> Si la recuperas ahora, conservarás todos tus registros.
          </Notice>
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={() => { cancelDeletion(pending.account.id); toast('Eliminación cancelada. Tu cuenta sigue activa.'); go() }}>Cancelar la eliminación</button>
            <button className="btn" onClick={go}>Seguir con la eliminación</button>
          </div>
        </div>
      </div>
    )
  }

  if (created) {
    const txt = `Escucha — código de recuperación\nUsuario: ${created.account.username}\nCódigo: ${created.recoveryCode}\nGuárdalo en un lugar seguro. Sirve para cambiar tu contraseña si la olvidas.`
    return (
      <div className="onb">
        <div className="onb-card">
          <span className="ico-tile success" style={{ width: 56, height: 56 }}><ShieldCheck size={28} /></span>
          <div className="stack-sm">
            <h1>Tu cuenta está lista</h1>
            <p className="muted">Guarda este código. Es la única forma de recuperar tu cuenta si olvidas la contraseña, porque Escucha no pide tu correo.</p>
          </div>
          <div className="card" style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 750, letterSpacing: '0.08em' }} aria-label="Código de recuperación">
            <span className="tnum">{created.recoveryCode}</span>
          </div>
          <div className="row-wrap">
            <button className="btn" onClick={() => navigator.clipboard?.writeText(created.recoveryCode).then(() => toast('Código copiado'))}><Copy size={18} /> Copiar</button>
            <button className="btn" onClick={() => download('escucha-codigo-recuperacion.txt', txt)}><Download size={18} /> Descargar</button>
          </div>
          <button className="btn btn-primary btn-block" onClick={go}>Ya lo guardé, continuar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="onb">
      <form className="onb-card" onSubmit={submit} noValidate>
        <span className="brand"><Logo /> Escucha</span>
        <div className="stack-sm">
          <h1>{tab === 'ingresar' ? 'Inicia sesión' : tab === 'crear' ? 'Crea tu cuenta' : 'Recupera tu cuenta'}</h1>
          <p className="muted">
            {tab === 'crear'
              ? 'Solo te pedimos un usuario y una contraseña. Sin nombre real, sin correo, sin teléfono.'
              : tab === 'ingresar'
                ? 'Entra para ver tu diario, tus registros y tus ajustes.'
                : 'Usa el código de recuperación que guardaste al crear la cuenta.'}
          </p>
        </div>
        <Segmented
          label="Acceso"
          value={tab}
          onChange={(t) => { setTab(t); setError('') }}
          options={[{ value: 'ingresar', label: 'Iniciar sesión' }, { value: 'crear', label: 'Crear cuenta' }]}
        />

        <div className="field">
          <label className="label" htmlFor="acc-user">Usuario</label>
          <input id="acc-user" className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="Por ejemplo: luna_23" />
          {tab === 'crear' && <span className="muted small">Puede ser un apodo. No uses tu nombre real.</span>}
        </div>
        {tab === 'recuperar' && (
          <div className="field">
            <label className="label" htmlFor="acc-code">Código de recuperación</label>
            <input id="acc-code" className="input tnum" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} />
          </div>
        )}
        <PasswordField
          id="acc-pass"
          label={tab === 'recuperar' ? 'Nueva contraseña' : 'Contraseña'}
          value={pass}
          onChange={setPass}
          autoComplete={tab === 'ingresar' ? 'current-password' : 'new-password'}
          hint={tab !== 'ingresar' ? 'Mínimo 8 caracteres, con letras y al menos un número.' : null}
        />
        {tab !== 'ingresar' && <PasswordField id="acc-pass2" label="Repite la contraseña" value={pass2} onChange={setPass2} autoComplete="new-password" />}

        {tab === 'crear' && (
          <div className="stack-sm">
            {guestHasData && (
              <label className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)', marginTop: 2 }} />
                <span className="small">Llevar a mi cuenta lo que ya registré sin cuenta (diario, emociones y chat).</span>
              </label>
            )}
            <label className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)', marginTop: 2 }} />
              <span className="small">Entiendo que mi cuenta se guarda solo en este dispositivo y que Escucha no reemplaza la atención profesional.</span>
            </label>
          </div>
        )}

        {error && <div className="notice danger" role="alert"><AlertTriangle size={18} aria-hidden="true" /><div>{error}</div></div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {tab === 'ingresar' ? <LogIn size={18} /> : tab === 'crear' ? <UserPlus size={18} /> : <KeyRound size={18} />}
          {busy ? 'Un momento…' : tab === 'ingresar' ? 'Iniciar sesión' : tab === 'crear' ? 'Crear cuenta' : 'Cambiar contraseña'}
        </button>
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          {tab === 'ingresar' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTab('recuperar'); setError('') }}>Olvidé mi contraseña</button>
          ) : tab === 'recuperar' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('ingresar')}>Volver a iniciar sesión</button>
          ) : <span />}
          <Link to="/" className="btn btn-ghost btn-sm" replace>Continuar sin cuenta</Link>
        </div>
        <p className="muted small">Tu cuenta vive en este navegador, sin servidor: la contraseña se guarda protegida con hash (PBKDF2), nunca en texto. Si eliminas una cuenta tendrás {GRACE} días para arrepentirte.</p>
      </form>
    </div>
  )
}
