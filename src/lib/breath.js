// Ciclo de respiración 4-4-4 del prototipo: Inhala 4 s, Sostén 4 s, Exhala 4 s · 4 ciclos (~1 minuto con la preparación).
import { useEffect, useRef, useState, useCallback } from 'react'
import { chime, vibrate } from './sound'

export const PHASES = [
  { id: 'inhala', label: 'Inhala', secs: 4, freq: 432 },
  { id: 'sosten', label: 'Sostén', secs: 4, freq: 528 },
  { id: 'exhala', label: 'Exhala', secs: 4, freq: 396 }
]
export const TOTAL_CYCLES = 4

export function useBreath({ cycles = TOTAL_CYCLES, onPhase, onDone, sound = true, haptics = true } = {}) {
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(-1)
  const [left, setLeft] = useState(PHASES[0].secs)
  const [cycle, setCycle] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const cb = useRef({ onPhase, onDone })
  cb.current = { onPhase, onDone }
  const st = useRef({ phaseIdx: -1, left: 0, cycle: 0 })

  const enter = useCallback(
    (idx, cyc) => {
      const p = PHASES[idx]
      st.current = { phaseIdx: idx, left: p.secs, cycle: cyc }
      setPhaseIdx(idx)
      setLeft(p.secs)
      setCycle(cyc)
      if (sound) chime(p.freq, 0.7, 0.08)
      if (haptics) vibrate(p.id === 'inhala' ? [60] : p.id === 'exhala' ? [30, 60, 30] : [20])
      cb.current.onPhase?.(p, cyc)
    },
    [sound, haptics]
  )

  const start = useCallback(() => {
    setElapsed(0)
    setRunning(true)
    enter(0, 1)
  }, [enter])
  const stop = useCallback(() => {
    setRunning(false)
    setPhaseIdx(-1)
    setCycle(0)
  }, [])
  const pause = useCallback(() => setRunning(false), [])
  const resume = useCallback(() => st.current.phaseIdx >= 0 && setRunning(true), [])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setElapsed((e) => e + 1)
      const s = st.current
      if (s.left > 1) {
        s.left -= 1
        setLeft(s.left)
        return
      }
      const nextIdx = (s.phaseIdx + 1) % PHASES.length
      const nextCycle = nextIdx === 0 ? s.cycle + 1 : s.cycle
      if (nextCycle > cycles) {
        setRunning(false)
        setPhaseIdx(-1)
        cb.current.onDone?.()
        return
      }
      enter(nextIdx, nextCycle)
    }, 1000)
    return () => clearInterval(t)
  }, [running, cycles, enter])

  const total = cycles * PHASES.reduce((a, p) => a + p.secs, 0)
  return {
    running,
    phase: phaseIdx >= 0 ? PHASES[phaseIdx] : null,
    left,
    cycle,
    cycles,
    progress: Math.min(1, elapsed / total),
    start,
    stop,
    pause,
    resume,
    started: phaseIdx >= 0
  }
}
