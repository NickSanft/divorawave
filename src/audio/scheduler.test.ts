/** Lookahead-scheduler tests with a fake clock (PLAN.md Phase 3): every event is
 *  scheduled exactly once, only inside the ~120 ms horizon, with correct times;
 *  chord marks fire at t − .04 on change only; onEnd fires at endT. */
import { describe, expect, it } from 'vitest'
import { Scheduler, type ScheduledNote } from './scheduler.ts'

function makeScheduler(startT = 1) {
  let t = startT
  const started: ScheduledNote[] = []
  const sched = new Scheduler({
    now: () => t,
    startNote: n => started.push(n),
    setIntervalFn: () => 0,
    clearIntervalFn: () => {},
    rafFn: () => 0,
    cafFn: () => {},
  })
  return { sched, started, setT: (v: number) => { t = v } }
}

const note = (t: number, midi = 60): ScheduledNote => ({ midi, t, dur: .5, vel: .6 })

describe('Scheduler.tick — lookahead scheduling', () => {
  it('schedules each event exactly once, only when it enters the horizon', () => {
    const { sched, started, setT } = makeScheduler(1)
    const events = [note(1.12), note(1.4), note(2.0), note(2.5)]
    sched.start({ events, marks: [], endT: 3 })
    // start() ticks immediately: horizon = 1 + .12 = 1.12 → first event only
    expect(started.map(n => n.t)).toEqual([1.12])

    setT(1.25); sched.tick() // horizon 1.37 — nothing new
    expect(started.length).toBe(1)

    setT(1.3); sched.tick() // horizon 1.42 → the 1.4 event
    expect(started.map(n => n.t)).toEqual([1.12, 1.4])

    sched.tick(); sched.tick() // repeated ticks never double-schedule
    expect(started.length).toBe(2)

    setT(1.9); sched.tick() // horizon 2.02 → the 2.0 event
    setT(2.4); sched.tick() // horizon 2.52 → the 2.5 event
    expect(started.map(n => n.t)).toEqual([1.12, 1.4, 2.0, 2.5])
  })

  it('passes events through with exact time/duration/velocity and sorts by time', () => {
    const { sched, started, setT } = makeScheduler(0)
    const a: ScheduledNote = { midi: 64, t: .9, dur: .25, vel: .42 }
    const b: ScheduledNote = { midi: 45, t: .3, dur: 1.1, vel: .5 }
    sched.start({ events: [a, b], marks: [], endT: 2 }) // unsorted input
    setT(.7); sched.tick() // horizon .82 — only the .3 event
    expect(started).toEqual([b]) // sorted: the .3 event first
    setT(.8); sched.tick() // horizon .92 → the .9 event
    expect(started).toEqual([b, a])
  })
})

describe('Scheduler.frame — marks and end', () => {
  it('fires onChord at t − .04, on change only, and onEnd at endT', () => {
    const { sched, setT } = makeScheduler(1)
    const chords: number[] = []
    let ended = 0
    sched.start({
      events: [],
      marks: [{ t: 1.12, i: 0 }, { t: 1.7, i: 1 }],
      endT: 2.8,
      onChord: i => chords.push(i),
      onEnd: () => ended++,
    })

    setT(1.05); sched.frame() // 1.05 < 1.12 − .04 = 1.08 — not yet
    expect(chords).toEqual([])

    setT(1.09); sched.frame() // ≥ 1.08 → chord 0
    expect(chords).toEqual([0])

    sched.frame(); sched.frame() // no re-fire without change
    expect(chords).toEqual([0])

    setT(1.67); sched.frame() // ≥ 1.66 → chord 1
    expect(chords).toEqual([0, 1])

    setT(2.79); sched.frame() // < endT — still playing
    expect(ended).toBe(0)
    expect(sched.playing).toBe(true)

    setT(2.8); sched.frame() // endT reached → onEnd once, run cleared
    expect(ended).toBe(1)
    expect(sched.playing).toBe(false)

    sched.frame() // parked — no further callbacks
    expect(ended).toBe(1)
  })

  it('a fresh start() replaces the prior run', () => {
    const { sched, started, setT } = makeScheduler(0)
    sched.start({ events: [note(5)], marks: [], endT: 6 })
    expect(started.length).toBe(0)
    sched.start({ events: [note(.1, 61)], marks: [], endT: 1 }) // immediate tick catches .1 ≤ .12
    expect(started.map(n => n.midi)).toEqual([61])
    setT(4.9); sched.tick() // old run's 5.0 event must never fire
    expect(started.length).toBe(1)
  })

  it('start() from inside onEnd does not duplicate the rAF loop', () => {
    let t = 0
    const rafCallbacks: Array<() => void> = []
    const cancelled = new Set<number>()
    const sched = new Scheduler({
      now: () => t,
      startNote: () => {},
      setIntervalFn: () => 0,
      clearIntervalFn: () => {},
      rafFn: fn => { rafCallbacks.push(fn); return rafCallbacks.length },
      cafFn: id => { cancelled.add(id) },
    })
    // run A ends at 1; its onEnd chains straight into run B (the conjure-autoplay shape)
    sched.start({
      events: [], marks: [], endT: 1,
      onEnd: () => sched.start({ events: [], marks: [], endT: 5 }),
    })
    expect(rafCallbacks.length).toBe(1) // A's loop
    t = 1
    rafCallbacks[0]!() // A's loop runs: frame → onEnd → start(B) schedules B's loop;
    //                    the superseded A loop must NOT also reschedule itself
    expect(sched.playing).toBe(true)
    expect(rafCallbacks.length).toBe(2)
    t = 2
    rafCallbacks[1]!() // B's loop reschedules exactly once
    expect(rafCallbacks.length).toBe(3)
  })

  it('stop() ceases scheduling and callbacks', () => {
    const { sched, started, setT } = makeScheduler(0)
    let ended = 0
    sched.start({ events: [note(.5)], marks: [], endT: 1, onEnd: () => ended++ })
    sched.stop()
    setT(.45); sched.tick()
    setT(1.5); sched.frame()
    expect(started.length).toBe(0)
    expect(ended).toBe(0)
    expect(sched.playing).toBe(false)
  })
})
