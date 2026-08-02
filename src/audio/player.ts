/** DIVORAWAVE audio — the piano player: AudioContext lifecycle, smplr instrument,
 *  FX routing, audition, and playback runs (brief §8.1/§8.2, PLAN.md Phase 3).
 *
 *  smplr 1.0 API: factory style (no `new`), `await piano.ready`, fixed `destination`
 *  at construction. Primary instrument SplendidGrandPiano (~19–23 MB, real progress
 *  drives the "tuning the ether…" shimmer); fallback smplr Soundfont
 *  acoustic_grand_piano (~2.3 MB) if Splendid fails (brief §11 CDN risk).
 *  CacheStorage wraps sample fetches — the default CDNs are GitHub Pages and
 *  rate-limit dev hot-reload otherwise.
 *
 *  Routing (§7.13, revised during Phase 3): piano → permanent `out` gain → fx.input.
 *  Stop = cease scheduling + piano.stop() UNDER the `out` fade (τ .06); the gain
 *  stays parked at 0 until the next audition or play restores it. One persistent
 *  bus, because auditions share the instrument's single output (a per-run gain
 *  would mute them after disconnect). Every note carries ampRelease .07 — the
 *  demo's own per-note release τ (piano.js `setTargetAtTime(0, t + dur, .07)`) —
 *  which keeps gates staccato-faithful AND makes stopped tails die on the demo
 *  timescale, so the on-demand gain restore is inaudible.
 *
 *  ensure() semantics per the demo: lazy create, resume on gesture, return whether
 *  running — `false` drives the "tap anywhere to tune in" toast (brief §4.6).
 */
import { CacheStorage, SplendidGrandPiano, Soundfont } from 'smplr'
import { createFxChain, type FxChain } from './fx.ts'
import { Scheduler, LOOKAHEAD_HORIZON } from './scheduler.ts'
import { auditionEvents, midiVelocity, styleEvents, type StyleId } from './styles.ts'
import type { Voicing } from '../theory/voicing.ts'

export type LoadState = 'idle' | 'loading' | 'ready' | 'failed'

export interface PlayOptions {
  bpm: number
  style: StyleId
  onChord?: (i: number) => void
  onEnd?: () => void
}

interface SmplrInstrument {
  ready: Promise<unknown>
  start(event: { note: number; time?: number; duration?: number; velocity?: number; ampRelease?: number }): unknown
  stop(): void
}

/** Per-note release τ — the demo's own (piano.js line 40); smplr's default (.5 s)
 *  would blur the staccato gates and let stopped tails ring into gain restores. */
export const NOTE_RELEASE = .07

/** Lead-in before the first chord (frozen demo constant — equals the lookahead horizon). */
export const PLAY_LEAD_IN = .12
/** Tail after the last chord before onEnd (frozen demo constant). */
export const PLAY_TAIL = .35
/** Stop fade time constant (frozen demo constant). */
export const STOP_FADE_TAU = .06

export class EtherPiano {
  private ctx: AudioContext | null = null
  private fx: FxChain | null = null
  private out: GainNode | null = null
  private piano: SmplrInstrument | null = null
  private sched: Scheduler | null = null
  /** bumped by dispose() so an in-flight init() can't resurrect state onto a dead context */
  private generation = 0

  loadState: LoadState = 'idle'
  usingFallback = false
  onLoadProgress: ((progress: { loaded: number; total: number }) => void) | null = null
  /** Fired on every stop/end; `silent` mirrors the demo's stop(true) — the viz layer
   *  resets --pulse to 0 only for non-silent stops and natural ends. */
  onStopped: ((silent: boolean) => void) | null = null

  get analyser(): AnalyserNode | null { return this.fx?.analyser ?? null }
  get playing(): boolean { return this.sched?.playing ?? false }
  get chorusBypassed(): boolean { return this.fx?.chorusBypassed ?? false }
  setChorusBypass(b: boolean): void { this.fx?.setChorusBypass(b) }

  private createCtx(): AudioContext {
    if (this.ctx) return this.ctx
    type AC = typeof AudioContext
    const Ctor: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext
    this.ctx = new Ctor()
    this.fx = createFxChain(this.ctx)
    this.out = this.ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(this.fx.input)
    this.sched = new Scheduler({
      now: () => this.ctx!.currentTime,
      startNote: n => {
        this.piano?.start({ note: n.midi, time: n.t, duration: n.dur, velocity: midiVelocity(n.vel), ampRelease: NOTE_RELEASE })
      },
    })
    return this.ctx
  }

  /** Lazy-create + resume; true iff the context is running (false → gesture toast). */
  ensure(): boolean {
    const ctx = this.createCtx()
    if (ctx.state !== 'running') void ctx.resume()
    return ctx.state === 'running'
  }

  /** Start loading samples (context may still be suspended — decode works regardless).
   *  Idempotent; loadState + onLoadProgress drive the shimmer. */
  async init(): Promise<void> {
    if (this.loadState !== 'idle') return
    const ctx = this.createCtx()
    const gen = this.generation
    this.loadState = 'loading'
    const storage = typeof caches !== 'undefined' ? new CacheStorage() : undefined
    try {
      const piano = SplendidGrandPiano(ctx, {
        destination: this.out!,
        storage,
        // §7.19: samples are vendored first-party (public/samples/) — no third-party
        // CDN at runtime; smplr percent-encodes the '#'/space filenames on fetch
        baseUrl: `${import.meta.env.BASE_URL}samples/splendid-grand-piano`,
        onLoadProgress: p => this.onLoadProgress?.(p),
      })
      await piano.ready
      if (gen !== this.generation) return // disposed while loading
      this.piano = piano as unknown as SmplrInstrument
      this.loadState = 'ready'
    } catch {
      try {
        const fallback = Soundfont(ctx, {
          instrument: 'acoustic_grand_piano',
          destination: this.out!,
          storage,
          onLoadProgress: p => this.onLoadProgress?.(p),
        })
        await fallback.ready
        if (gen !== this.generation) return // disposed while loading
        this.piano = fallback as unknown as SmplrInstrument
        this.usingFallback = true
        this.loadState = 'ready'
      } catch {
        if (gen !== this.generation) return
        this.loadState = 'failed'
      }
    }
  }

  /** Audition (brief §4.3): immediate soft block. Returns false when blocked on the
   *  user-gesture resume or while samples load. */
  audition(midis: readonly number[]): boolean {
    if (!this.ensure() || this.loadState !== 'ready' || !this.piano) return false
    if (!this.playing) this.restoreGain() // cancel a pending stop-fade so auditions stay audible
    const now = this.ctx!.currentTime
    for (const ev of auditionEvents(midis)) {
      this.piano.start({ note: ev.midi, time: now + ev.off, duration: ev.dur, velocity: midiVelocity(ev.vel), ampRelease: NOTE_RELEASE })
    }
    return true
  }

  /** Perform the deck once (brief §4.4): two beats per chord, lookahead-scheduled. */
  play(voicings: readonly Voicing[], opts: PlayOptions): boolean {
    if (!this.ensure() || this.loadState !== 'ready' || !this.piano || voicings.length === 0) return false
    this.stop(true) // starting a run silently stops any prior run (demo stop(true))
    this.restoreGain()
    const beat = 60 / opts.bpm
    const cd = 2 * beat
    const t0 = this.ctx!.currentTime + PLAY_LEAD_IN
    const events = voicings.flatMap((v, i) =>
      styleEvents(opts.style, v, beat).map(ev => ({ midi: ev.midi, t: t0 + i * cd + ev.off, dur: ev.dur, vel: ev.vel })),
    )
    const marks = voicings.map((_, i) => ({ t: t0 + i * cd, i }))
    const endT = t0 + voicings.length * cd + PLAY_TAIL
    this.sched!.start({
      events,
      marks,
      endT,
      onChord: opts.onChord,
      onEnd: () => {
        this.onStopped?.(false) // natural end resets the pulse (demo _pulseTo0 on end)
        opts.onEnd?.()
      },
    })
    return true
  }

  /** Stop: cease scheduling, hard-stop the instrument UNDER the routing-gain fade
   *  (τ .06 — the release tails die inside the closing gain, matching the demo's
   *  ring-into-the-faded-bus behavior), and leave the gain parked at 0. The next
   *  audition or play restores it (§7.13). silent=true (chaining into a new run)
   *  skips the pulse reset, mirroring the demo's stop(true). */
  stop(silent = false): void {
    this.sched?.stop()
    if (this.ctx && this.out) {
      const now = this.ctx.currentTime
      this.out.gain.cancelScheduledValues(now)
      this.out.gain.setValueAtTime(this.out.gain.value, now)
      this.out.gain.setTargetAtTime(0, now, STOP_FADE_TAU)
      this.piano?.stop()
    }
    this.onStopped?.(silent)
  }

  private restoreGain(): void {
    if (this.ctx && this.out) {
      const now = this.ctx.currentTime
      this.out.gain.cancelScheduledValues(now)
      // short linear ramp instead of a step: no discontinuity click if a stopped
      // note's (τ .07) tail is still nonzero at restore time
      this.out.gain.setValueAtTime(this.out.gain.value, now)
      this.out.gain.linearRampToValueAtTime(1, now + .005)
    }
  }

  dispose(): void {
    this.generation++
    this.stop(true)
    this.piano?.stop()
    this.fx?.dispose()
    void this.ctx?.close()
    this.ctx = null; this.fx = null; this.out = null; this.piano = null; this.sched = null
    this.loadState = 'idle'
  }
}

export { LOOKAHEAD_HORIZON }
