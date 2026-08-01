/** Distiller-core unit tests (PLAN.md 5.1.3 pins the normalization cases). */
import { describe, expect, it } from 'vitest'
import {
  countSong, emitRow, emptyModeCounts, estimateKey, isSectionMarker,
  normalizeToken, parseCsvLine,
} from '../../tools/core.ts'
import { makeKey, parseName } from '../theory/chords.ts'

describe('normalizeToken — the POSITIONAL sharp substitution', () => {
  it('pins the PLAN 5.1.3 cases', () => {
    expect(normalizeToken('Csus4')).toBe('Csus4') // a bare s→# would give C#u#4
    expect(normalizeToken('Asus2')).toBe('Asus2')
    expect(normalizeToken('Fsmin')).toBe('F#m')
    expect(normalizeToken('A/Cs')).toBe('A/C#')
    expect(normalizeToken('Cs')).toBe('C#')
    expect(normalizeToken('Emin')).toBe('Em')
    expect(normalizeToken('Emin7')).toBe('Em7')
    expect(normalizeToken('Csmin7')).toBe('C#m7')
    expect(normalizeToken('Bb')).toBe('Bb')
    expect(normalizeToken('Cmaj7')).toBe('Cmaj7')
    expect(normalizeToken('Cdim')).toBe('Cdim')
  })

  it('normalized tokens parse via the app theory code (F♯ minor spelling intact)', () => {
    const am = makeKey('A', 'minor')
    expect(parseName(normalizeToken('Fsmin'), am)).toMatchObject({ quality: 'min', rootPc: 6 })
    expect(parseName(normalizeToken('A/Cs'), am)).toMatchObject({ quality: 'maj', bass: 'C♯' })
    expect(parseName(normalizeToken('Csus4'), am)).toMatchObject({ quality: 'sus4' })
  })
})

describe('parseCsvLine', () => {
  it('handles quoting, escapes, and plain fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
    expect(parseCsvLine('1,"E D A/Cs","\'new wave\' \'synthpop\'",2000')).toEqual(
      ['1', 'E D A/Cs', "'new wave' 'synthpop'", '2000'],
    )
    expect(parseCsvLine('x,"say ""hi"", ok",y')).toEqual(['x', 'say "hi", ok', 'y'])
    expect(parseCsvLine('a,,b')).toEqual(['a', '', 'b'])
  })
})

describe('estimateKey — Krumhansl profile match', () => {
  const histFor = (symbols: string[], reps = 4): number[] => {
    const cRef = makeKey('C', 'major')
    const hist = new Array<number>(12).fill(0)
    for (let r = 0; r < reps; r++) {
      for (const s of symbols) {
        const ch = parseName(s, cRef)!
        for (const i of ch.ints) hist[(ch.rootPc + i) % 12]!++
      }
    }
    return hist
  }

  it('recognizes an A-minor progression', () => {
    const est = estimateKey(histFor(['Am', 'F', 'C', 'G', 'Am', 'Dm', 'E7', 'Am']))
    expect(est.mode).toBe('minor')
    expect(est.pc).toBe(9)
    expect(est.margin).toBeGreaterThan(0)
  })

  it('recognizes a C-major progression', () => {
    const est = estimateKey(histFor(['C', 'F', 'G', 'C', 'Am', 'F', 'G7', 'C']))
    expect(est.mode).toBe('major')
    expect(est.pc).toBe(0)
  })
})

describe('counting + emission', () => {
  it('counts start/order1/order2/unigram and prunes on emit', () => {
    const counts = emptyModeCounts()
    for (let r = 0; r < 10; r++) countSong(counts, ['i', '♭VI', '♭VII', 'i'], [0])
    countSong(counts, ['i', 'IV'], [0]) // rare transition — should prune at minCount 3
    expect(counts.start.get('i')).toBe(11)
    expect(counts.order1.get('i')?.get('♭VI')).toBe(10)
    expect(counts.order2.get('i|♭VI')?.get('♭VII')).toBe(10)
    const plain = { minCount: 3, minRowTotal: 8, maxRowEntries: 12, laplaceK: 0, excludeTargets: new Set<string>() }
    const emitted = emitRow(counts.order1.get('i')!, plain)!
    expect(emitted['♭VI']).toBeCloseTo(10 / 11, 4)
    expect(emitted['IV']).toBeUndefined() // pruned
    expect(emitRow(counts.order1.get('♭VII')!, { ...plain, minRowTotal: 80 })).toBeNull()
  })

  it('Laplace add-k lifts the tail; deep-shelf targets are excluded (§7.18)', () => {
    const counts = emptyModeCounts()
    for (let r = 0; r < 90; r++) countSong(counts, ['i', '♭VI'], [0])
    for (let r = 0; r < 6; r++) countSong(counts, ['i', 'v'], [0])
    for (let r = 0; r < 4; r++) countSong(counts, ['i', '♭II'], [0])
    const row = counts.order1.get('i')!
    const smoothed = emitRow(row, { minCount: 3, minRowTotal: 8, maxRowEntries: 12, laplaceK: .02, excludeTargets: new Set(['♭II']) })!
    expect(smoothed['♭II']).toBeUndefined() // deep shelf never targeted by consensus rows
    // add-k: p = (p_raw + .02)/(1 + .02·n) over the ♭II-free total (96)
    expect(smoothed['v']).toBeCloseTo((6 / 96 + .02) / (1 + .02 * 2), 4)
    expect(smoothed['♭VI']).toBeCloseTo((90 / 96 + .02) / (1 + .02 * 2), 4)
  })

  it('isSectionMarker', () => {
    expect(isSectionMarker('<verse_1>')).toBe(true)
    expect(isSectionMarker('Am')).toBe(false)
  })
})
