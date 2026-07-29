/** Parser tests (PLAN.md Phase 2.3): names + romans, unicode/ASCII equivalence,
 *  the two §7.3 demo-bug fixes, slash-bass root-position semantics (§7.4), and
 *  the §7.12 quality-collapse policy. */
import { describe, expect, it } from 'vitest'
import { makeKey, parseName } from './chords.ts'
import { parseRoman } from './roman.ts'
import { candidates } from '../engine/rules.ts'
import { chips } from '../engine/chips.ts'

const am = makeKey('A', 'minor')
const cmaj = makeKey('C', 'major')

describe('parseName — names mode', () => {
  it('parses the core vocabulary into the right classes', () => {
    expect(parseName('Am', am)).toMatchObject({ roman: 'i', quality: 'min', semis: 0, statsId: 'i' })
    expect(parseName('F', am)).toMatchObject({ roman: '♭VI', semis: 8 })
    expect(parseName('E7', am)).toMatchObject({ roman: 'V7', quality: 'dom7', spice: .25 })
    expect(parseName('A', am)).toMatchObject({ roman: 'I', spice: .5 })
    expect(parseName('Bm7♭5', am)).toMatchObject({ roman: 'iiø7', quality: 'halfdim', statsId: 'ii°' })
    expect(parseName('Dsus2', am)).toMatchObject({ roman: 'ivsus2', quality: 'sus2', statsId: 'iv' })
    expect(parseName('Am(add9)', am)).toMatchObject({ roman: 'i(add9)', quality: 'madd9', statsId: 'i' })
  })

  it('treats unicode and ASCII accidentals identically', () => {
    const uni = parseName('F♯m7', am)
    const ascii = parseName('F#m7', am)
    expect(uni).toBeTruthy()
    expect(uni).toEqual(ascii)
    expect(parseName('B♭', am)).toEqual(parseName('Bb', am))
  })

  it('parses CM as C MAJOR (§7.3 — demo bug fixed, case-sensitive suffixes)', () => {
    expect(parseName('CM', cmaj)).toMatchObject({ roman: 'I', quality: 'maj' })
    expect(parseName('Cm', cmaj)).toMatchObject({ quality: 'min' })
    expect(parseName('CM7', cmaj)).toMatchObject({ quality: 'maj7' }) // demo parsed Cm7 — collision class, fixed
    expect(parseName('Cm7', cmaj)).toMatchObject({ quality: 'min7' })
  })

  it('accepts unambiguous all-caps suffixes (demo leniency preserved outside the m/M family)', () => {
    expect(parseName('CMAJ7', cmaj)).toMatchObject({ quality: 'maj7' })
    expect(parseName('CSUS4', cmaj)).toMatchObject({ quality: 'sus4' })
    expect(parseName('AMIN7', am)).toMatchObject({ quality: 'min7' })
    expect(parseName('BDIM', am)).toMatchObject({ quality: 'dim' })
    expect(parseName('CADD9', cmaj)).toMatchObject({ quality: 'add9' })
    expect(parseName('ADIM7', am)).toMatchObject({ quality: 'dim', extensions: ['DIM7'] })
  })

  it('collapses out-of-Q qualities onto Q with the original suffix in extensions (§7.12)', () => {
    expect(parseName('C9', cmaj)).toMatchObject({ quality: 'dom7', roman: 'V/IV', extensions: ['9'] })
    expect(parseName('Cm9', cmaj)).toMatchObject({ quality: 'min7', extensions: ['m9'] })
    expect(parseName('C6', cmaj)).toMatchObject({ quality: 'maj', roman: 'I', extensions: ['6'] })
    expect(parseName('Cm6', cmaj)).toMatchObject({ quality: 'min', extensions: ['m6'] })
    expect(parseName('Cdim7', cmaj)).toMatchObject({ quality: 'dim', extensions: ['dim7'] })
    expect(parseName('C7sus4', cmaj)).toMatchObject({ quality: 'sus4', extensions: ['7sus4'] })
    expect(parseName('Cmaj9', cmaj)).toMatchObject({ quality: 'maj7', extensions: ['maj9'] })
  })

  it('rejects what cannot collapse onto Q (the error-string path)', () => {
    expect(parseName('C13', cmaj)).toBeNull()
    expect(parseName('Caug', cmaj)).toBeNull()
    expect(parseName('Hm', cmaj)).toBeNull()
    expect(parseName('xyz', cmaj)).toBeNull()
    expect(parseName('', cmaj)).toBeNull()
  })

  it('stores slash bass but keeps root-position quality/ints (§7.4 — tonal rotation avoided)', () => {
    const inv = parseName('A/C♯', am)
    expect(inv).toMatchObject({ roman: 'I', quality: 'maj', semis: 0, bass: 'C♯' })
    expect(inv!.ints).toEqual([0, 4, 7])
    const m7 = parseName('Cmaj7/B', am)
    expect(m7).toMatchObject({ quality: 'maj7', semis: 3, bass: 'B' })
    expect(m7!.ints).toEqual([0, 4, 7, 11])
    expect(parseName('C/E', cmaj)!.bass).toBe('E')
  })
})

describe('parseRoman — our convention', () => {
  it('case-sensitive direct match first: V ≠ v and I ≠ i in minor (§7.3)', () => {
    expect(parseRoman('V', am)).toMatchObject({ roman: 'V', quality: 'maj', spice: .2 })
    expect(parseRoman('v', am)).toMatchObject({ roman: 'v', quality: 'min', spice: .05 })
    expect(parseRoman('I', am)).toMatchObject({ roman: 'I', quality: 'maj', spice: .5 })
    expect(parseRoman('i', am)).toMatchObject({ roman: 'i', quality: 'min', spice: 0 })
  })

  it('case-sensitive direct match first: iv ≠ IV in major (§7.3 — demo returned IV for typed iv)', () => {
    expect(parseRoman('iv', cmaj)).toMatchObject({ roman: 'iv', quality: 'min', spice: .45 })
    expect(parseRoman('IV', cmaj)).toMatchObject({ roman: 'IV', quality: 'maj', spice: 0 })
  })

  it('case-sensitive direct match first: IV ≠ iv in minor (§7.3 — demo returned iv for typed IV)', () => {
    expect(parseRoman('IV', am)).toMatchObject({ roman: 'IV', quality: 'maj', spice: .45 })
    expect(parseRoman('iv', am)).toMatchObject({ roman: 'iv', quality: 'min', spice: 0 })
  })

  it('reaches candidates via case-insensitive fallback and ASCII flats (demo compatibility)', () => {
    expect(parseRoman('biii', am)).toMatchObject({ roman: '♭III' })
    expect(parseRoman('bVI', am)).toMatchObject({ roman: '♭VI' })
    expect(parseRoman('♭ii7', am)).toMatchObject({ roman: '♭II7' })
    expect(parseRoman('v7', am)).toMatchObject({ roman: 'V7' }) // demo ci behavior, kept
  })

  it('parses secondary dominants via direct match', () => {
    expect(parseRoman('V/♭III', am)).toMatchObject({ statsId: 'V/♭III', quality: 'dom7' })
    expect(parseRoman('V/iv', am)).toMatchObject({ quality: 'dom7', semis: 0 })
  })

  it('regex path synthesizes out-of-vocabulary degrees (spice .5, statsId = roman)', () => {
    expect(parseRoman('II', am)).toMatchObject({ semis: 2, quality: 'maj', spice: .5, statsId: 'II' })
    expect(parseRoman('♭V', am)).toMatchObject({ semis: 6, quality: 'maj' })
    expect(parseRoman('vii°7', am)).toMatchObject({ quality: 'halfdim' }) // ° + 7 → halfdim (demo quirk, kept)
    expect(parseRoman('iii7', am)).toMatchObject({ quality: 'min7', semis: 4 })
  })

  it('rejects garbage', () => {
    expect(parseRoman('X', am)).toBeNull()
    expect(parseRoman('iix', am)).toBeNull()
    expect(parseRoman('', am)).toBeNull()
  })
})

describe('round-trips (PLAN §2.1 normalization contract)', () => {
  it('every chip label parses in both notations, in every key', () => {
    for (const root of ['A', 'C', 'E♭', 'F♯', 'B♭'] as const) {
      for (const mode of ['minor', 'major'] as const) {
        const key = makeKey(root, mode)
        for (const label of chips(key, 'names', '')) {
          expect(parseName(label, key), `names chip ${label} in ${root} ${mode}`).toBeTruthy()
        }
        for (const label of chips(key, 'roman', '')) {
          expect(parseRoman(label, key), `roman chip ${label} in ${root} ${mode}`).toBeTruthy()
        }
      }
    }
  })

  it('every candidate name, roman, and statsId parses back to the same class', () => {
    for (const root of ['A', 'C', 'F♯'] as const) {
      for (const mode of ['minor', 'major'] as const) {
        const key = makeKey(root, mode)
        for (const cd of candidates(key)) {
          const byName = parseName(cd.name, key)
          expect(byName, `name ${cd.name}`).toBeTruthy()
          expect(byName).toMatchObject({ semis: cd.semis, quality: cd.quality, roman: cd.roman })
          const byRoman = parseRoman(cd.roman, key)
          expect(byRoman, `roman ${cd.roman}`).toBeTruthy()
          expect(byRoman).toMatchObject({ semis: cd.semis, quality: cd.quality })
          expect(parseRoman(cd.statsId, key), `statsId ${cd.statsId}`).toBeTruthy()
        }
      }
    }
  })
})
