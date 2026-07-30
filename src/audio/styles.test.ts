/** Style-pattern golden tests (PLAN.md Phase 3): exact event lists for a fixed
 *  voicing at 104 BPM, hand-derived ONCE from mockup/piano.js's _chord/_note math
 *  (piano.js commits WebAudio nodes and cannot emit event lists):
 *    _chord(out, midis, t, dur, vel, roll): note i at t + i·roll,
 *      duration max(.1, dur − i·roll), velocity vel·(i===0 ? 1 : .9)
 *    block: _chord(v.all, t, cd·.98, .6, .012)
 *    pulse: k 0..3 → _chord(v.all, t + k·e8, e8·.55, k===0?.72:k===2?.6:.42, .004)
 *    arps:  _note(v.bass, t, cd·.95, .5); k 0..3 → _note(seq[k % len], t + k·e8,
 *           e8·1.6, k===0?.6:.45); seq = sorted uppers, reversed for arpdown
 *    audition: _chord(midis, now+.02, 1.7, .4, .015)
 */
import { describe, expect, it } from 'vitest'
import { auditionEvents, midiVelocity, rolledChord, styleEvents } from './styles.ts'

// Am voicing in A minor: bass 36+9=45, uppers A3/C4/E4
const v = { bass: 45, uppers: [57, 60, 64], all: [45, 57, 60, 64], dist: 0 }
const beat = 60 / 104 // ≈ .576923
const cd = 2 * beat
const e8 = beat / 2

const close = (got: number, want: number): void => { expect(got).toBeCloseTo(want, 10) }

describe('styleEvents at 104 BPM', () => {
  it('block: full voicing bass-first, gate .98·cd, vel .6, 12 ms roll with taper', () => {
    const ev = styleEvents('block', v, beat)
    expect(ev.map(e => e.midi)).toEqual([45, 57, 60, 64])
    ev.forEach((e, i) => {
      close(e.off, i * .012)
      close(e.dur, cd * .98 - i * .012)
      close(e.vel, .6 * (i === 0 ? 1 : .9)) // .6, .54, .54, .54
    })
  })

  it('pulse ⅛: 4 eighth hits, gate .55·e8, accents .72/.42/.6/.42, 4 ms roll', () => {
    const ev = styleEvents('pulse', v, beat)
    expect(ev.length).toBe(16)
    for (let k = 0; k < 4; k++) {
      const hit = ev.slice(k * 4, k * 4 + 4)
      const baseVel = k === 0 ? .72 : k === 2 ? .6 : .42
      expect(hit.map(e => e.midi)).toEqual([45, 57, 60, 64])
      hit.forEach((e, i) => {
        close(e.off, k * e8 + i * .004)
        close(e.dur, e8 * .55 - i * .004) // gate ≈ .1587 > .1 floor
        close(e.vel, baseVel * (i === 0 ? 1 : .9))
      })
    }
  })

  it('arp ↑: sustained bass + 4 events over sorted uppers with wraparound on beat 4', () => {
    const ev = styleEvents('arpup', v, beat)
    expect(ev.length).toBe(5)
    const bass = ev[0]!
    expect(bass.midi).toBe(45)
    close(bass.off, 0); close(bass.dur, cd * .95); close(bass.vel, .5)
    expect(ev.slice(1).map(e => e.midi)).toEqual([57, 60, 64, 57]) // 3 uppers → beat 4 wraps
    ev.slice(1).forEach((e, k) => {
      close(e.off, k * e8)
      close(e.dur, e8 * 1.6) // overlapping — legato
      close(e.vel, k === 0 ? .6 : .45)
    })
  })

  it('arp ↓: same shape over the reversed sorted uppers', () => {
    const ev = styleEvents('arpdown', v, beat)
    expect(ev.slice(1).map(e => e.midi)).toEqual([64, 60, 57, 64])
    expect(ev[0]!.midi).toBe(45)
  })

  it('arp sorts uppers ascending regardless of voicing order', () => {
    const scrambled = { ...v, uppers: [64, 57, 60] }
    expect(styleEvents('arpup', scrambled, beat).slice(1).map(e => e.midi)).toEqual([57, 60, 64, 57])
  })
})

describe('audition and the rolled-chord taper', () => {
  it('audition: +20 ms start, 1.7 s, vel .4, 15 ms roll', () => {
    const ev = auditionEvents(v.all)
    ev.forEach((e, i) => {
      close(e.off, .02 + i * .015)
      close(e.dur, 1.7 - i * .015)
      close(e.vel, .4 * (i === 0 ? 1 : .9)) // .4, .36, .36, .36
    })
  })

  it('rolled chords clamp duration at the .1 s floor', () => {
    const ev = rolledChord([60, 61, 62], 0, .05, .5, .004)
    for (const e of ev) expect(e.dur).toBe(.1)
  })
})

describe('midiVelocity (engine 0–1 → smplr 0–127)', () => {
  it('maps and clamps', () => {
    expect(midiVelocity(0)).toBe(0)
    expect(midiVelocity(1)).toBe(127)
    expect(midiVelocity(.72)).toBe(91)  // round(91.44)
    expect(midiVelocity(.4)).toBe(51)   // round(50.8)
    expect(midiVelocity(.648)).toBe(82) // round(82.296) — pulse taper velocity
    expect(midiVelocity(1.5)).toBe(127)
    expect(midiVelocity(-1)).toBe(0)
  })
})
