import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle, Mic, Accessibility, UserRound, Database } from 'lucide-react'
import { resetAll, setState, useStore } from '../lib/store'
import { testKey, explainError, hasKey } from '../lib/groq'
import { supportsSR, supportsTTS, useVoice } from '../lib/voice'
import { Segmented, Switch, Notice } from '../components/ui'
import { DESTINATIONS } from '../lib/intents'
import { toast } from '../components/Toast'

export default function Profile() {
  const s = useStore()
  const v = useVoice()
  const { hash } = useLocation()
  const [key, setKey] = useState(s.groqKey)
  const [show, setShow] = useState(false)
  const [test, setTest] = useState(null)

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  const saveKey = async () => {
    setState({ groqKey: key.trim() })
    if (!key.trim()) return setTest(null)
    setTest('loading')
    try {
      await testKey()
      setTest('ok')
      toast('Clave guardada y verificada')
    } catch (e) {
      setTest(explainError(e))
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Perfil</h1>
        <p>Tu cuenta es anónima. Todo se guarda solo en este navegador.</p>
      </div>

      <section className="card stack" aria-labelledby="p-alias">
        <div className="row"><span className="ico-tile"><UserRound size={22} /></span><h2 id="p-alias">Tu apodo</h2></div>
        <input className="input" aria-label="Apodo" value={s.alias} onChange={(e) => setState({ alias: e.target.value.slice(0, 24) })} placeholder="Sin apodo" />
      </section>

      <section className="card stack" aria-labelledby="p-a11y" id="accesibilidad">
        <div className="row"><span className="ico-tile"><Accessibility size={22} /></span><h2 id="p-a11y">Accesibilidad</h2></div>
        <div className="field">
          <span className="label">Tamaño de texto</span>
          <Segmented label="Tamaño de texto" value={s.textScale} onChange={(x) => setState({ textScale: x })} options={[100, 130, 160, 200].map((n) => ({ value: n, label: `${n} %` }))} />
        </div>
        <div className="field">
          <span className="label">Tema</span>
          <Segmented label="Tema" value={s.theme} onChange={(x) => setState({ theme: x })} options={[{ value: 'system', label: 'Automático' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} />
        </div>
        <div>
          <Switch id="hc" label="Alto contraste" hint="Contraste de al menos 7:1" checked={s.highContrast} onChange={(x) => setState({ highContrast: x })} />
          <Switch id="rm" label="Reducir movimiento" hint="Quita animaciones y transiciones" checked={s.reduceMotion} onChange={(x) => setState({ reduceMotion: x })} />
          <Switch id="tts" label="Leer en voz alta" hint={supportsTTS ? 'Escucha lee sus respuestas' : 'Tu navegador no tiene síntesis de voz'} checked={s.tts} onChange={(x) => setState({ tts: x })} />
          <Switch id="cap" label="Subtítulos de voz" hint="Muestra lo que Escucha oye y dice" checked={s.captions} onChange={(x) => setState({ captions: x })} />
        </div>
      </section>

      <section className="card stack" aria-labelledby="p-voz" id="voz">
        <div className="row"><span className="ico-tile"><Mic size={22} /></span><h2 id="p-voz">Navegación por voz</h2></div>
        {!supportsSR && (
          <Notice tone="warn" icon={AlertTriangle}>
            Este navegador no tiene reconocimiento de voz integrado. Escucha grabará tu voz y la transcribirá con Whisper (Groq) si agregas tu clave abajo. Para la mejor experiencia usa Chrome, Edge o Safari.
          </Notice>
        )}
        <div>
          <Switch id="hf" label="Manos libres" hint="Escucha todo el tiempo, sin tocar el micrófono" checked={s.handsFree} onChange={(x) => setState({ handsFree: x })} />
          <Switch id="ww" label="Palabra de activación" hint="Con manos libres, solo responde si empiezas con “Escucha…”" checked={s.wakeWord} onChange={(x) => setState({ wakeWord: x })} />
        </div>
        <div className="stack-sm">
          <h3>Qué puedes decir en cualquier pantalla</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>“Abre …” o “ir a …”: {DESTINATIONS.map((d) => d.label.toLowerCase()).join(', ')}</li>
            <li>“Atrás”, “lee la pantalla”, “callate”, “deja de escuchar”</li>
            <li>“Modo oscuro”, “modo claro”, “alto contraste”, “aumenta el texto”, “reduce el texto”</li>
            <li>“Necesito ayuda” abre SOS. En el chat, todo lo que digas se envía como mensaje.</li>
            <li>Atajos de teclado: V para hablar, Esc para callar la voz.</li>
          </ul>
          <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={v.toggleListening}><Mic size={16} /> Probar ahora</button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="p-ia" id="ia">
        <div className="row"><span className="ico-tile"><KeyRound size={22} /></span><h2 id="p-ia">Inteligencia artificial</h2></div>
        <p className="muted small">Escucha usa modelos de Groq para conversar, entender órdenes de voz libres y transcribir audio. Pega tu clave; se guarda solo en este navegador y no se sube al repositorio.</p>
        <div className="field">
          <label className="label" htmlFor="gk">Clave de API de Groq</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="gk" className="input" type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_…" autoComplete="off" spellCheck={false} />
            <button className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar clave' : 'Mostrar clave'}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
        </div>
        <div className="row-wrap" style={{ alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveKey} disabled={test === 'loading'}>{test === 'loading' ? 'Verificando…' : 'Guardar y probar'}</button>
          {s.groqKey && <button className="btn btn-ghost" onClick={() => { setKey(''); setState({ groqKey: '' }); setTest(null) }}>Quitar clave</button>}
          {test === 'ok' && <span className="tag tag-live"><CheckCircle2 size={14} /> Funciona</span>}
          {test && test !== 'ok' && test !== 'loading' && <span className="tag tag-sim">{test}</span>}
          {!test && <span className="tag">{hasKey() ? 'Clave configurada' : 'Sin clave: modo básico'}</span>}
        </div>
      </section>

      <section className="card stack" aria-labelledby="p-data">
        <div className="row"><span className="ico-tile danger"><Database size={22} /></span><h2 id="p-data">Tus datos</h2></div>
        <p className="muted small">{s.checkins.length} registros de emociones · {s.journal.length} entradas de diario · {s.chat.length} mensajes.</p>
        <div className="row-wrap">
          <button className="btn" onClick={() => setState({ coachDone: false })}>Ver otra vez la guía</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('¿Borrar todos tus datos de este dispositivo? No se puede deshacer.')) {
                resetAll()
                location.hash = '#/bienvenida'
              }
            }}
          >
            Borrar todo
          </button>
        </div>
      </section>
    </div>
  )
}
