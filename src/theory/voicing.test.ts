/** Voicing-engine tests (brief §8.3): correct pitch content for all 11 qualities,
 *  register bounds, min-motion behavior, and 3-vs-4-note distance clamping.
 *  Exact numeric parity with the demo is covered by golden.test.ts. */
import { describe, expect, it } from 'vitest'
import { Q, type Quality } from './chords.ts'
import { voice } from './voicing.ts'

const pcset = (notes: number[]) => new Set(notes.map(n => n % 12))

describe('voice()', () => {
  it('voices every quality with the right pitch classes (bass root, root dropped from uppers on 4-pc chords)', () => {
    for (const quality of Object.keys(Q) as Quality[]) {
      const ints = Q[quality].ints
      const rootPc = 0
      const v = voice({ ints, rootPc })
      const chordPcs = [...new Set(ints.map(i => (rootPc + i) % 12))]
      expect(v.bass).toBe(36)
      if (chordPcs.length > 3) {
        // sevenths / add9s: bass carries the root, uppers are the remaining 3 pcs
        expect(pcset(v.uppers)).toEqual(new Set(chordPcs.slice(1)))
        expect(v.uppers.length).toBe(3)
      } else {
        expect(pcset(v.uppers)).toEqual(new Set(chordPcs))
        expect(v.uppers.length).toBe(chordPcs.length)
      }
    }
  })

  it('keeps uppers inside the 48..76 band and the first chord centered near B3', () => {
    for (const rootPc of [0, 3, 6, 9, 11]) {
      const v = voice({ ints: Q.min.ints, rootPc })
      expect(v.bass).toBe(36 + rootPc)
      for (const n of v.uppers) { expect(n).toBeGreaterThanOrEqual(48); expect(n).toBeLessThanOrEqual(76) }
      const mean = v.uppers.reduce((x, y) => x + y, 0) / v.uppers.length
      expect(Math.abs(mean - 59)).toBeLessThanOrEqual(6)
    }
  })

  it('re-voicing the same chord against its own uppers has zero motion', () => {
    const first = voice({ ints: Q.maj.ints, rootPc: 5 })
    const again = voice({ ints: Q.maj.ints, rootPc: 5 }, first.uppers)
    expect(again.uppers).toEqual(first.uppers)
    expect(again.dist).toBe(0)
  })

  it('picks the minimum-motion option among all rotations/registers', () => {
    const am = voice({ ints: Q.min.ints, rootPc: 9 })
    const f = voice({ ints: Q.maj.ints, rootPc: 5 }, am.uppers)
    // dist is the sorted, index-clamped pairwise sum vs prev — recompute and confirm
    const a = [...f.uppers].sort((x, y) => x - y)
    const b = [...am.uppers].sort((x, y) => x - y)
    let d = 0
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) d += Math.abs(a[Math.min(i, a.length - 1)]! - b[Math.min(i, b.length - 1)]!)
    expect(f.dist).toBe(d)
    // Am→F shares two tones (A, C): the greedy min-motion choice moves ≤ 2 semitones total
    expect(f.dist).toBeLessThanOrEqual(2)
  })

  it('specified bass: the bass note is the slash bass, not the root (§7.20)', () => {
    // C/E — first inversion of a triad: bass E (MIDI 40), uppers keep the full triad
    const inv = voice({ ints: Q.maj.ints, rootPc: 0, bassPc: 4 })
    expect(inv.bass).toBe(40)
    expect(pcset(inv.uppers)).toEqual(new Set([0, 4, 7]))
    expect(inv.all[0]).toBe(40)
    // and it really differs from root position
    expect(voice({ ints: Q.maj.ints, rootPc: 0 }).bass).toBe(36)
  })

  it('specified bass: a dense chord drops the DOUBLED bass tone from the uppers', () => {
    // Cmaj7/B — B in the bass, so the uppers are C E G (not E G B)
    const v = voice({ ints: Q.maj7.ints, rootPc: 0, bassPc: 11 })
    expect(v.bass).toBe(47)
    expect(pcset(v.uppers)).toEqual(new Set([0, 4, 7]))
    expect(v.uppers.length).toBe(3)
  })

  it('specified bass: a FOREIGN bass keeps the whole chord above it (identity intact)', () => {
    // Cmaj7/D — D doubles nothing, so nothing yields: dropping the root here would
    // leave E G B over D, i.e. G6/D, and the chord would stop being a Cmaj7
    const v = voice({ ints: Q.maj7.ints, rootPc: 0, bassPc: 2 })
    expect(v.bass).toBe(38)
    expect(pcset(v.uppers)).toEqual(new Set([0, 4, 7, 11]))
    expect(v.uppers.length).toBe(4) // brief §8.3 allows three to four upper voices
    for (const n of v.uppers) { expect(n).toBeGreaterThanOrEqual(48); expect(n).toBeLessThanOrEqual(76) }
  })

  it('specified bass never collides with or rises above the upper band', () => {
    for (const bassPc of [0, 1, 4, 7, 11]) {
      const v = voice({ ints: Q.dom7.ints, rootPc: 5, bassPc })
      expect(v.bass).toBeGreaterThanOrEqual(36)
      expect(v.bass).toBeLessThanOrEqual(47)
      expect(v.bass).toBeLessThan(Math.min(...v.uppers))
    }
  })

  it('a bassPc equal to the root is indistinguishable from no bass at all (parity guard)', () => {
    for (const quality of Object.keys(Q) as Quality[]) {
      for (const rootPc of [0, 5, 9]) {
        const plain = voice({ ints: Q[quality].ints, rootPc })
        const explicit = voice({ ints: Q[quality].ints, rootPc, bassPc: rootPc })
        expect(explicit).toEqual(plain)
      }
    }
  })

  it('inversions still voice-lead: the uppers minimize motion, the bass stays put', () => {
    const am = voice({ ints: Q.min.ints, rootPc: 9 })
    const fOverA = voice({ ints: Q.maj.ints, rootPc: 5, bassPc: 9 }, am.uppers)
    expect(fOverA.bass).toBe(45) // A in the bass — pinned by the slash, not searched
    expect(fOverA.dist).toBeLessThanOrEqual(2) // F/A shares A and C with Am
  })

  it('clamps sanely between 3-note and 4-note voicings (index-clamped pairing)', () => {
    const triad = voice({ ints: Q.maj.ints, rootPc: 0 })
    const seventh = voice({ ints: Q.dom7.ints, rootPc: 7 }, triad.uppers)
    expect(Number.isFinite(seventh.dist)).toBe(true)
    expect(seventh.uppers.length).toBe(3) // 4 pcs → root dropped → still 3 uppers
    const back = voice({ ints: Q.maj.ints, rootPc: 0 }, seventh.uppers)
    expect(Number.isFinite(back.dist)).toBe(true)
  })
})
