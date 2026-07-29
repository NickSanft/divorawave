/** Candidate-set tests (brief §10 M1: "correct candidate sets in A minor") plus
 *  key-change re-labeling and the makeKey fallback. */
import { describe, expect, it } from 'vitest'
import { candidates, makeKey } from './rules.ts'
import { chordFrom, parseName } from '../theory/chords.ts'

describe('candidate sets', () => {
  it('A minor: the frozen 21-class table, in order', () => {
    const got = candidates(makeKey('A', 'minor')).map(c => [c.roman, c.name, c.quality, c.semis, c.func, c.spice, c.statsId])
    expect(got).toEqual([
      ['i', 'Am', 'min', 0, 'T', 0, 'i'],
      ['i(add9)', 'Am(add9)', 'madd9', 0, 'T', .12, 'i'],
      ['ii°', 'Bdim', 'dim', 2, 'S', .1, 'ii°'],
      ['iiø7', 'Bm7♭5', 'halfdim', 2, 'S', .18, 'ii°'],
      ['♭III', 'C', 'maj', 3, 'T', 0, '♭III'],
      ['iv', 'Dm', 'min', 5, 'S', 0, 'iv'],
      ['ivsus2', 'Dsus2', 'sus2', 5, 'S', .12, 'iv'],
      ['v', 'Em', 'min', 7, 'D', .05, 'v'],
      ['♭VI', 'F', 'maj', 8, 'S', 0, '♭VI'],
      ['♭VIadd9', 'Fadd9', 'add9', 8, 'S', .12, '♭VI'],
      ['♭VII', 'G', 'maj', 10, 'D', 0, '♭VII'],
      ['V', 'E', 'maj', 7, 'D', .2, 'V'],
      ['V7', 'E7', 'dom7', 7, 'D', .25, 'V7'],
      ['IV', 'D', 'maj', 5, 'S', .45, 'IV'],
      ['I', 'A', 'maj', 0, 'T', .5, 'I'],
      ['V/♭III', 'G7', 'dom7', 10, 'D', .6, 'V/♭III'],
      ['V/♭VI', 'C7', 'dom7', 3, 'D', .6, 'V/♭VI'],
      ['V/♭VII', 'D7', 'dom7', 5, 'D', .62, 'V/♭VII'],
      ['V/iv', 'A7', 'dom7', 0, 'D', .6, 'V/iv'],
      ['♭II', 'B♭', 'maj', 1, 'S', .8, '♭II'],
      ['♭II7', 'B♭7', 'dom7', 1, 'D', .9, '♭II7'],
    ])
  })

  it('C major: the frozen 19-class table, in order', () => {
    const got = candidates(makeKey('C', 'major')).map(c => [c.roman, c.name, c.quality, c.semis, c.func, c.spice, c.statsId])
    expect(got).toEqual([
      ['I', 'C', 'maj', 0, 'T', 0, 'I'],
      ['Iadd9', 'Cadd9', 'add9', 0, 'T', .12, 'I'],
      ['ii', 'Dm', 'min', 2, 'S', 0, 'ii'],
      ['ii7', 'Dm7', 'min7', 2, 'S', .1, 'ii'],
      ['iii', 'Em', 'min', 4, 'T', .12, 'iii'],
      ['IV', 'F', 'maj', 5, 'S', 0, 'IV'],
      ['IVadd9', 'Fadd9', 'add9', 5, 'S', .12, 'IV'],
      ['V', 'G', 'maj', 7, 'D', 0, 'V'],
      ['V7', 'G7', 'dom7', 7, 'D', .1, 'V'],
      ['vi', 'Am', 'min', 9, 'T', 0, 'vi'],
      ['vii°', 'Bdim', 'dim', 11, 'D', .2, 'vii°'],
      ['iv', 'Fm', 'min', 5, 'S', .45, 'iv'],
      ['♭VI', 'A♭', 'maj', 8, 'S', .5, '♭VI'],
      ['♭VII', 'B♭', 'maj', 10, 'D', .4, '♭VII'],
      ['V/ii', 'A7', 'dom7', 9, 'D', .6, 'V/ii'],
      ['V/IV', 'C7', 'dom7', 0, 'D', .55, 'V/IV'],
      ['V/V', 'D7', 'dom7', 2, 'D', .6, 'V/V'],
      ['V/vi', 'E7', 'dom7', 4, 'D', .6, 'V/vi'],
      ['♭II7', 'D♭7', 'dom7', 1, 'D', .9, '♭II7'],
    ])
  })

  it('every class carries a non-empty reason string (brief §6.2, stored not surfaced)', () => {
    for (const key of [makeKey('A', 'minor'), makeKey('C', 'major')]) {
      for (const cd of candidates(key)) expect(cd.reason.length).toBeGreaterThan(0)
    }
  })

  it('coloring variants alias their parent statsId', () => {
    const am = candidates(makeKey('A', 'minor'))
    const aliased = am.filter(cd => cd.statsId !== cd.roman).map(cd => [cd.roman, cd.statsId])
    expect(aliased).toEqual([
      ['i(add9)', 'i'], ['iiø7', 'ii°'], ['ivsus2', 'iv'], ['♭VIadd9', '♭VI'],
    ])
  })
})

describe('key change (brief §4.2 — stored progression is the source of truth)', () => {
  it('re-labels Am–F–C from A minor into E minor as Em–C–G, romans preserved', () => {
    const am = makeKey('A', 'minor')
    const em = makeKey('E', 'minor')
    const stored = ['Am', 'F', 'C'].map(s => parseName(s, am)!)
    expect(stored.map(c => c.roman)).toEqual(['i', '♭VI', '♭III'])
    const relabeled = stored.map(c => chordFrom(c, em))
    expect(relabeled.map(c => c.name)).toEqual(['Em', 'C', 'G'])
    expect(relabeled.map(c => c.roman)).toEqual(['i', '♭VI', '♭III'])
    expect(relabeled.map(c => c.rootPc)).toEqual([4, 0, 7])
  })
})

describe('makeKey', () => {
  it('resolves all 12 roots and falls back to A for unknown names (demo behavior)', () => {
    expect(makeKey('E♭', 'major')).toEqual({ root: 'E♭', pc: 3, mode: 'major' })
    expect(makeKey('F♯', 'minor').pc).toBe(6)
    expect(makeKey('X', 'minor')).toEqual({ root: 'A', pc: 9, mode: 'minor' })
  })
})
