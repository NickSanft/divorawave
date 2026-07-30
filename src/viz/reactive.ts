/** DIVORAWAVE viz — the analyser → `--pulse` bridge (brief §8.5/§5.5, PLAN.md §5).
 *
 *  Verbatim demo behavior (mockup/piano.js _pulse/_kick/_pulseTo0), frozen:
 *  RMS over every 4th sample of the analyser's time-domain buffer;
 *  target = min(1, rms · 3.2); asymmetric one-pole smoothing per rAF frame —
 *  attack .3, release .07 (≈60 ms / ≈300 ms at 60 fps — nothing over 3 Hz);
 *  ambience multiplier 0–1; hard reset to 0 on natural end and non-silent stop
 *  BEFORE the loop parks (a parked loop must never freeze --pulse nonzero);
 *  MUST stay 0 under reduced motion (the loop parks entirely).
 *
 *  `--pulse` is the ONLY bridge between audio and CSS. Consumers (tokens sheet):
 *  sun glow opacity calc(.55 + var(--pulse)*.45) · grid brightness calc(1 + var(--pulse)*.7).
 */

export interface Reactive {
  /** run continuously (playback started) */
  start(): void
  /** breathe for a bounded window (auditions) — demo _kick(2) */
  kick(seconds?: number): void
  /** playback finished or was stopped; silent mirrors the demo stop(true) */
  endRun(silent: boolean): void
  setAmbience(v: number): void
  setReducedMotion(rm: boolean): void
  /** current smoothed pulse (post ambience/RM clamp) — for harness readouts */
  readonly value: number
  dispose(): void
}

const defaultWrite = (v: number): void => {
  document.documentElement.style.setProperty('--pulse', v.toFixed(3))
}

export function createReactive(analyser: AnalyserNode, write: (v: number) => void = defaultWrite): Reactive {
  const buf = new Float32Array(analyser.fftSize)
  let sm = 0
  let amb = 1
  let rm = false
  let playing = false
  let kickUntil = 0
  let rafId: number | null = null
  let lastOut = 0

  const emit = (v: number): void => {
    lastOut = v
    write(v)
  }

  const frame = (): void => {
    rafId = null
    if (rm) return // parked — reduced motion locks --pulse at 0 (masked, not cleared)
    const active = playing || performance.now() < kickUntil
    if (!active) {
      // demo parity (piano.js _kick else-branch): a kick window that expires resets
      // to 0 before parking — a parked loop must never freeze --pulse nonzero
      if (kickUntil !== 0) { kickUntil = 0; pulseTo0() }
      return
    }
    analyser.getFloatTimeDomainData(buf)
    let s = 0
    for (let i = 0; i < buf.length; i += 4) s += buf[i]! * buf[i]!
    const rms = Math.sqrt(s / (buf.length / 4))
    const target = Math.min(1, rms * 3.2)
    sm += (target - sm) * (target > sm ? .3 : .07)
    emit(sm * amb)
    rafId = requestAnimationFrame(frame)
  }

  const ensureLoop = (): void => {
    if (rm || rafId !== null) return
    rafId = requestAnimationFrame(frame)
  }

  const pulseTo0 = (): void => {
    sm = 0
    emit(0)
  }

  return {
    get value() { return lastOut },
    start() {
      playing = true
      kickUntil = 0 // playback owns the loop; stale audition windows must not outlive it
      ensureLoop()
    },
    kick(seconds = 2) {
      if (playing) return // demo guard (piano.js _kick): playback owns the pulse
      kickUntil = performance.now() + seconds * 1000
      ensureLoop()
    },
    endRun(silent: boolean) {
      playing = false
      if (!silent) pulseTo0() // demo: _pulseTo0 on end and non-silent stop only
    },
    setAmbience(v: number) {
      amb = Math.max(0, Math.min(1, v))
    },
    setReducedMotion(on: boolean) {
      rm = on
      if (on) {
        // mask, don't clear: RM parks the loop and locks --pulse at 0, but an active
        // run keeps its state so toggling RM off mid-playback resumes the ambience
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
        pulseTo0()
      } else {
        ensureLoop()
      }
    },
    dispose() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      pulseTo0()
    },
  }
}
