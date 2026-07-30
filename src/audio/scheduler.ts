/** DIVORAWAVE audio — the lookahead scheduler (brief §8.1).
 *
 *  The classic two-clocks pattern: a ~25 ms timer tick schedules every note event
 *  whose time falls within the next ~120 ms against ctx.currentTime, and a rAF loop
 *  does UI-only work — chord marks fire onChord at t − .04 (frozen demo constant),
 *  onEnd fires at endT. This replaces the demo's all-at-once scheduling ("fine for
 *  ≤8 chords, not for Phase B" — HANDOFF).
 *
 *  All clocks and timer functions are injectable so the scheduler is unit-testable
 *  with a fake clock (PLAN.md Phase 3 tests).
 */

export const LOOKAHEAD_TICK_MS = 25
export const LOOKAHEAD_HORIZON = .12
/** onChord early-fire window (frozen demo constant). */
export const MARK_EARLY = .04

/** One note event at an ABSOLUTE AudioContext time. */
export interface ScheduledNote {
  midi: number
  t: number
  dur: number
  vel: number
}

export interface Mark { t: number; i: number }

export interface Run {
  events: readonly ScheduledNote[]
  marks: readonly Mark[]
  endT: number
  onChord?: (i: number) => void
  onEnd?: () => void
}

export interface SchedulerDeps {
  now(): number
  startNote(n: ScheduledNote): void
  tickMs?: number
  horizon?: number
  setIntervalFn?: (fn: () => void, ms: number) => number
  clearIntervalFn?: (id: number) => void
  rafFn?: (fn: () => void) => number
  cafFn?: (id: number) => void
}

export class Scheduler {
  private readonly deps: Required<SchedulerDeps>
  private run: Run | null = null
  private events: ScheduledNote[] = []
  private nextIdx = 0
  private chordIdx = -1
  private intervalId: number | null = null
  private rafId: number | null = null
  playing = false

  constructor(deps: SchedulerDeps) {
    this.deps = {
      tickMs: LOOKAHEAD_TICK_MS,
      horizon: LOOKAHEAD_HORIZON,
      setIntervalFn: (fn, ms) => window.setInterval(fn, ms),
      clearIntervalFn: id => window.clearInterval(id),
      rafFn: fn => window.requestAnimationFrame(fn),
      cafFn: id => window.cancelAnimationFrame(id),
      ...deps,
    }
  }

  /** Begin a run. Any prior run is stopped first (its notes are the player's concern). */
  start(run: Run): void {
    this.stop()
    this.run = run
    this.events = [...run.events].sort((a, b) => a.t - b.t)
    this.nextIdx = 0
    this.chordIdx = -1
    this.playing = true
    this.tick() // schedule anything already inside the horizon (the .12 s lead-in)
    this.intervalId = this.deps.setIntervalFn(() => this.tick(), this.deps.tickMs)
    this.rafId = this.deps.rafFn(this.loop)
  }

  /** Schedule every event inside the lookahead horizon, exactly once. */
  tick(): void {
    if (!this.playing) return
    const limit = this.deps.now() + this.deps.horizon
    while (this.nextIdx < this.events.length && this.events[this.nextIdx]!.t <= limit) {
      this.deps.startNote(this.events[this.nextIdx]!)
      this.nextIdx++
    }
  }

  /** UI-clock work: chord marks (fired at t − .04, on change only) and the end check. */
  frame(): void {
    const run = this.run
    if (!run || !this.playing) return
    const now = this.deps.now()
    let idx = this.chordIdx
    for (const m of run.marks) if (now >= m.t - MARK_EARLY) idx = m.i
    if (idx !== this.chordIdx) {
      this.chordIdx = idx
      run.onChord?.(idx)
    }
    if (now >= run.endT) {
      const onEnd = run.onEnd
      this.stop()
      onEnd?.()
    }
  }

  private loop = (): void => {
    const run = this.run // guard: if frame()'s onEnd starts a NEW run, that run owns
    this.frame() //         its own rAF chain — a superseded loop must not reschedule
    if (this.playing && this.run === run) this.rafId = this.deps.rafFn(this.loop)
  }

  /** Cease scheduling and UI callbacks. Does NOT silence already-scheduled notes —
   *  that is the player's job (piano.stop() + routing-gain fade, §7.13). */
  stop(): void {
    if (this.intervalId !== null) { this.deps.clearIntervalFn(this.intervalId); this.intervalId = null }
    if (this.rafId !== null) { this.deps.cafFn(this.rafId); this.rafId = null }
    this.run = null
    this.events = []
    this.nextIdx = 0
    this.chordIdx = -1
    this.playing = false
  }
}
