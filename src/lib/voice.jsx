// Motor de voz: reconocimiento continuo (Web Speech API) + síntesis (speechSynthesis)
// + respaldo con grabación y transcripción Whisper en Groq cuando el navegador no reconoce voz (Firefox, Meta Quest).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getState, setState, useStore } from './store'
import { parseGlobal, matchLocal, classifyWithAI, norm, DESTINATIONS } from './intents'
import { detectCrisis, CRISIS_REPLY } from './crisis'
import { hasKey, transcribe } from './groq'
import { toast } from '../components/Toast'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const supportsSR = !!SR
export const supportsRecorder = typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
export const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
const SCALES = [100, 130, 160, 200]

const VoiceCtx = createContext(null)
export const useVoice = () => useContext(VoiceCtx)

let pickedVoice = null
function pickVoice() {
  if (!supportsTTS) return null
  const voices = speechSynthesis.getVoices()
  pickedVoice =
    voices.find((v) => /es[-_]PE/i.test(v.lang)) ||
    voices.find((v) => /es[-_](419|MX|US|CO|AR|CL)/i.test(v.lang)) ||
    voices.find((v) => /^es/i.test(v.lang)) ||
    null
  return pickedVoice
}
if (supportsTTS) speechSynthesis.onvoiceschanged = pickVoice

export function VoiceProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const handsFree = useStore((s) => s.handsFree)
  const wakeWord = useStore((s) => s.wakeWord)

  const [status, setStatus] = useState(supportsSR || supportsRecorder ? 'idle' : 'unsupported')
  const [interim, setInterim] = useState('')
  const [heard, setHeard] = useState('')
  const [level, setLevel] = useState(0)

  const recRef = useRef(null)
  const wantRef = useRef(false)
  const speakingRef = useRef(false)
  const commandsRef = useRef([]) // pila de {id, commands}
  const freeTextRef = useRef([]) // pila de {id, fn}
  const dictationRef = useRef(null)
  const pendingChatRef = useRef(null)
  const mediaRef = useRef(null)
  const restartRef = useRef(null)
  const locRef = useRef(location.pathname)
  locRef.current = location.pathname

  // ---------- TTS ----------
  const speak = useCallback((text, { force = false, onEnd } = {}) => {
    if (!supportsTTS || !text) return onEnd?.()
    if (!force && !getState().tts) return onEnd?.()
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-PE'
    const v = pickedVoice || pickVoice()
    if (v) u.voice = v
    u.rate = 1.02
    speakingRef.current = true
    try { recRef.current?.abort() } catch { /* nada */ }
    setStatus('speaking')
    u.onend = u.onerror = () => {
      speakingRef.current = false
      setStatus(wantRef.current ? 'listening' : 'idle')
      onEnd?.()
      if (wantRef.current) setTimeout(() => restartRef.current?.(), 250)
    }
    speechSynthesis.speak(u)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const silence = useCallback(() => {
    if (supportsTTS) speechSynthesis.cancel()
    speakingRef.current = false
  }, [])

  // ---------- ejecución de intenciones ----------
  const runIntent = useCallback(
    async (intent) => {
      switch (intent.type) {
        case 'navigate':
          navigate(intent.to)
          toast(`Abriendo ${intent.label}`)
          speak(`Abriendo ${intent.label}.`)
          return true
        case 'back':
          navigate(-1)
          speak('Volviendo.')
          return true
        case 'help':
          navigate('/perfil#voz')
          speak('Puedes decir, por ejemplo: abre respiración, ir al chat, lee la pantalla, modo oscuro, aumenta el texto, o necesito ayuda. En cada pantalla también hay órdenes propias.')
          return true
        case 'silence':
          silence()
          return true
        case 'stop':
          stopListening(true)
          return true
        case 'read': {
          const main = document.querySelector('main')
          const text = (main?.innerText || '').replace(/\s+/g, ' ').slice(0, 700)
          speak(text || 'No hay texto para leer.', { force: true })
          return true
        }
        case 'setting':
          setState({ [intent.key]: intent.value })
          toast(intent.say)
          speak(intent.say)
          return true
        case 'toggle':
          setState((s) => ({ [intent.key]: !s[intent.key] }))
          toast(intent.say)
          speak(intent.say)
          return true
        case 'textScale': {
          const cur = getState().textScale
          const i = Math.max(0, Math.min(SCALES.length - 1, SCALES.indexOf(cur) + intent.dir))
          setState({ textScale: SCALES[i] })
          toast(`Texto al ${SCALES[i]} %`)
          speak(`Texto al ${SCALES[i]} por ciento.`)
          return true
        }
        default:
          return false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, speak, silence]
  )

  const handleFinal = useCallback(
    async (raw) => {
      let text = raw.trim()
      if (!getState().handsFree) wantRef.current = false
      if (!text) return
      if (getState().wakeWord && getState().handsFree && !dictationRef.current) {
        const n = norm(text)
        if (!/^(oye )?escucha\b/.test(n)) return
        text = text.replace(/^\s*(oye\s+)?escucha[,\s]*/i, '')
        if (!text) return speak('Te escucho.')
      }
      setHeard(text)
      setInterim('')

      if (dictationRef.current) {
        const fn = dictationRef.current
        dictationRef.current = null
        return fn(text)
      }

      const locals = commandsRef.current.at(-1)?.commands || []
      const local = matchLocal(text, locals)
      if (local) {
        local.cmd.run(local.match, text)
        if (local.cmd.say) speak(typeof local.cmd.say === 'function' ? local.cmd.say(local.match) : local.cmd.say)
        return
      }

      const freeEntry = [...freeTextRef.current].reverse().find((x) => x.fn)
      const free = freeEntry?.fn
      if (freeEntry?.exclusive) return free(text)
      const global = parseGlobal(text)
      if (global) return runIntent(global)

      if (free) return free(text)

      if (detectCrisis(text)) {
        navigate('/ayuda')
        speak(CRISIS_REPLY, { force: true })
        return
      }

      setStatus('processing')
      const ai = await classifyWithAI(text, locals.map((c) => c.label))
      setStatus(wantRef.current ? 'listening' : 'idle')
      if (ai?.intent === 'navigate' && ai.to) return runIntent({ type: 'navigate', to: ai.to, label: DESTINATIONS.find((d) => d.to === ai.to)?.label || 'la pantalla' })
      if (ai?.intent === 'back') return runIntent({ type: 'back' })
      if (ai?.intent === 'local' && ai.command) {
        const c = locals.find((l) => l.label === ai.command)
        if (c) { c.run([], text); if (c.say) speak(typeof c.say === 'function' ? c.say([]) : c.say); return }
      }
      if (ai?.intent === 'chat' || (!ai && text.split(' ').length > 4)) {
        pendingChatRef.current = ai?.message || text
        navigate('/chat')
        return
      }
      toast(`No entendí “${text}”. Di “qué puedo decir”.`, { tone: 'warn' })
      speak('No te entendí. Di: qué puedo decir, para escuchar ejemplos.')
    },
    [navigate, runIntent, speak]
  )

  // ---------- reconocimiento ----------
  const startRec = useCallback(() => {
    if (!SR || speakingRef.current) return
    try { recRef.current?.abort() } catch { /* nada */ }
    const rec = new SR()
    rec.lang = 'es-PE'
    rec.interimResults = true
    rec.continuous = getState().handsFree
    rec.maxAlternatives = 1
    rec.onstart = () => setStatus('listening')
    rec.onresult = (e) => {
      let finalText = ''
      let inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else inter += r[0].transcript
      }
      setInterim(inter)
      if (finalText) handleFinal(finalText)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false
        setStatus('idle')
        toast('Permite el micrófono para usar la voz.', { tone: 'warn' })
      } else if (e.error === 'network') {
        toast('El reconocimiento de voz necesita internet.', { tone: 'warn' })
      }
    }
    rec.onend = () => {
      setInterim('')
      if (wantRef.current && getState().handsFree && !speakingRef.current) {
        setTimeout(() => wantRef.current && startRec(), 200)
      } else if (!speakingRef.current) {
        wantRef.current = getState().handsFree && wantRef.current
        setStatus(wantRef.current ? 'listening' : 'idle')
      }
    }
    recRef.current = rec
    try { rec.start() } catch { /* ya iniciado */ }
  }, [handleFinal])

  // Respaldo: grabar hasta silencio y transcribir con Whisper (Groq)
  const startRecorder = useCallback(async () => {
    if (!hasKey()) {
      toast('Este navegador no reconoce voz. Usa Chrome, Edge o Safari, o agrega tu clave de Groq en Perfil.', { tone: 'warn', duration: 5000 })
      wantRef.current = false
      return setStatus('idle')
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks = []
      const actx = new (window.AudioContext || window.webkitAudioContext)()
      const an = actx.createAnalyser()
      an.fftSize = 512
      actx.createMediaStreamSource(stream).connect(an)
      const data = new Uint8Array(an.fftSize)
      let lastLoud = performance.now()
      let spoke = false
      const started = performance.now()
      const tick = () => {
        if (mr.state !== 'recording') return
        an.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(peak / 128)
        if (peak > 14) { lastLoud = performance.now(); spoke = true }
        const now = performance.now()
        if ((spoke && now - lastLoud > 1300) || now - started > 12000) mr.stop()
        else requestAnimationFrame(tick)
      }
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        actx.close()
        setLevel(0)
        if (!spoke) { setStatus(wantRef.current && getState().handsFree ? 'listening' : 'idle'); if (wantRef.current && getState().handsFree) startRecorder(); return }
        setStatus('processing')
        try {
          const text = await transcribe(new Blob(chunks, { type: mr.mimeType }))
          await handleFinal(text)
        } catch {
          toast('No pude transcribir el audio.', { tone: 'warn' })
        }
        if (wantRef.current && getState().handsFree && !speakingRef.current) startRecorder()
        else if (speakingRef.current) { /* se reanuda al terminar de hablar */ }
        else if (!speakingRef.current) setStatus('idle')
      }
      mediaRef.current = mr
      mr.start()
      setStatus('listening')
      requestAnimationFrame(tick)
    } catch {
      wantRef.current = false
      setStatus('idle')
      toast('Permite el micrófono para usar la voz.', { tone: 'warn' })
    }
  }, [handleFinal])

  restartRef.current = SR ? startRec : startRecorder

  const startListening = useCallback(() => {
    if (status === 'unsupported') return toast('Tu navegador no permite usar el micrófono.', { tone: 'warn' })
    silence()
    wantRef.current = true
    if (SR) startRec()
    else startRecorder()
  }, [status, silence, startRec, startRecorder])

  const stopListening = useCallback((announce = false) => {
    wantRef.current = false
    try { recRef.current?.abort() } catch { /* nada */ }
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    setInterim('')
    setStatus('idle')
    if (announce) toast('Micrófono apagado')
  }, [])

  const toggleListening = useCallback(() => {
    if (status === 'listening' || status === 'processing') stopListening()
    else startListening()
  }, [status, startListening, stopListening])

  // Manos libres: al activarlo, empieza a escuchar; al desactivarlo, se detiene
  useEffect(() => {
    if (handsFree) startListening()
    else if (wantRef.current) stopListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree])

  // Atajo de teclado: V para hablar, Esc para callar
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return
      if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        toggleListening()
      }
      if (e.key === 'Escape') silence()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleListening, silence])

  // ---------- registro de comandos por pantalla ----------
  const registerCommands = useCallback((id, commands) => {
    commandsRef.current = [...commandsRef.current.filter((c) => c.id !== id), { id, commands }]
    return () => { commandsRef.current = commandsRef.current.filter((c) => c.id !== id) }
  }, [])
  const registerFreeText = useCallback((id, fn, exclusive = false) => {
    freeTextRef.current = [...freeTextRef.current.filter((c) => c.id !== id), { id, fn, exclusive }]
    return () => { freeTextRef.current = freeTextRef.current.filter((c) => c.id !== id) }
  }, [])
  const dictate = useCallback(
    () =>
      new Promise((resolve) => {
        dictationRef.current = resolve
        if (!wantRef.current) startListening()
      }),
    [startListening]
  )
  const consumePendingChat = useCallback(() => {
    const p = pendingChatRef.current
    pendingChatRef.current = null
    return p
  }, [])

  const value = useMemo(
    () => ({
      status, interim, heard, level, handsFree, wakeWord,
      supportsSR, supportsTTS, supportsRecorder,
      speak, silence, startListening, stopListening, toggleListening,
      registerCommands, registerFreeText, dictate, consumePendingChat, runIntent
    }),
    [status, interim, heard, level, handsFree, wakeWord, speak, silence, startListening, stopListening, toggleListening, registerCommands, registerFreeText, dictate, consumePendingChat, runIntent]
  )
  return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>
}

// Hook para que cada pantalla declare sus órdenes de voz
export function useVoiceCommands(id, commands, deps = []) {
  const v = useVoice()
  useEffect(() => v.registerCommands(id, commands), deps) // eslint-disable-line react-hooks/exhaustive-deps
}
export function useFreeText(id, fn, deps = [], exclusive = false) {
  const v = useVoice()
  useEffect(() => v.registerFreeText(id, fn, exclusive), deps) // eslint-disable-line react-hooks/exhaustive-deps
}
