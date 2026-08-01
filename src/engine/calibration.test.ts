/** Dial-calibration acceptance (HANDOFF targets, PLAN.md §6.5) against the SHIPPED
 *  transitions JSON. Measured record on the tier-1 distill (865 songs, §7.18):
 *  A minor — purely diatonic through 9; mild borrows (dorian IV, picardy I — brief
 *  §6.2's middle shelf, spice ≤ .5) share slot 6 through 41; first deep-shelf
 *  entrant ♭II7 at exactly 42; full deep-ether from 77. C major — first deep-shelf
 *  (♭II7) at 44; first secondary dominant not before 59.
 *  The exact-dial pins exist so a re-distill drifts LOUDLY: update them together
 *  with PLAN §6.5 in the same commit (working agreement §10). */
import { describe, expect, it } from 'vitest'
import { makeKey } from './rules.ts'
import { suggest } from './blend.ts'
import { parseRoman } from '../theory/roman.ts'
import { shippedStats } from '../test/helpers.ts'

const am = makeKey('A', 'minor')
const cmaj = makeKey('C', 'major')
const isDeepShelf = (s: { spice: number; roman: string }): boolean => s.spice >= .6 || s.roman === '♭II'

describe('adventurousness dial calibration (A minor, empty deck)', () => {
  it('the landing band (≤39) never shows the deep shelf; low dials are purely diatonic', () => {
    for (const dial of [0, 5, 9]) {
      for (const s of suggest(shippedStats, [], am, dial)) {
        expect(s.spice, `${s.roman} at dial ${dial}`).toBeLessThanOrEqual(.25)
      }
    }
    for (const dial of [10, 15, 20, 25, 30, 35, 38, 39, 41]) {
      const top = suggest(shippedStats, [], am, dial)
      for (const s of top) {
        expect(s.spice, `${s.roman} at dial ${dial}`).toBeLessThanOrEqual(.5)
        expect(s.roman.includes('/'), `${s.roman} at dial ${dial}`).toBe(false)
        expect(s.roman === '♭II' || s.roman === '♭II7', `${s.roman} at dial ${dial}`).toBe(false)
      }
    }
  })

  it('the first deep-shelf entrant is ♭II7 — at the measured dial 42, inside the 40–58 contract window', () => {
    let firstDial = -1
    let entrant = ''
    for (let dial = 0; dial <= 100; dial++) {
      const spicy = suggest(shippedStats, [], am, dial).find(isDeepShelf)
      if (spicy) { firstDial = dial; entrant = spicy.roman; break }
    }
    // product contract (HANDOFF "~50"): the window
    expect(firstDial).toBeGreaterThanOrEqual(40)
    expect(firstDial).toBeLessThanOrEqual(58)
    expect(entrant).toBe('♭II7')
    // measured record (§6.5) — a silent re-distill must fail here, not drift quietly
    expect(firstDial).toBe(42)
  })

  it('dial 60: mixed — consensus and spice share the top six', () => {
    const top = suggest(shippedStats, [], am, 60)
    expect(top.some(s => s.spice <= .05)).toBe(true)
    expect(top.some(s => s.spice >= .45)).toBe(true)
  })

  it('full deep-ether from the measured dial 77 upward', () => {
    for (const dial of [77, 85, 90, 95, 100]) {
      for (const s of suggest(shippedStats, [], am, dial)) {
        expect(s.spice, `${s.roman} at dial ${dial}`).toBeGreaterThanOrEqual(.5)
      }
    }
  })
})

describe('adventurousness dial calibration (C major — the mode the §7.18 V/IV fix protects)', () => {
  it('the empty-deck landing band shows no deep shelf (measured: ♭II7 first at 44)', () => {
    for (const dial of [0, 10, 20, 29, 35, 38, 39, 43]) {
      for (const s of suggest(shippedStats, [], cmaj, dial)) {
        expect(s.roman.includes('/'), `${s.roman} at dial ${dial}`).toBe(false)
        expect(s.roman === '♭II7', `${s.roman} at dial ${dial}`).toBe(false)
        expect(s.spice, `${s.roman} at dial ${dial}`).toBeLessThanOrEqual(.5)
      }
    }
  })

  it('no secondary dominant leaks into the landing band after I (the V/IV class §7.18 excludes)', () => {
    // mid-progression the floor-driven ♭II7 may enter earlier than the empty-deck
    // landing (the major I row is thin) — that's the same corpus-reality entrant
    // class as A minor's dial-42; the SECONDARY leak is what consensus rows must
    // never produce, and that is pinned here
    const deckI = [parseRoman('I', cmaj)!]
    for (const dial of [0, 10, 20, 29, 35, 38, 39]) {
      for (const s of suggest(shippedStats, deckI, cmaj, dial)) {
        expect(s.roman.includes('/'), `${s.roman} at dial ${dial} after I`).toBe(false)
      }
    }
  })
})

describe('secondary-dominant resolutions (§7.5 hand rows govern the ≥2-chord order-2 path)', () => {
  it('every V/x resolves to its target as rank 1 in minor', () => {
    for (const [prev, sec, target] of [
      ['♭VI', 'V/♭VI', '♭VI'], ['♭VII', 'V/♭VII', '♭VII'], ['♭III', 'V/♭III', '♭III'], ['iv', 'V/iv', 'iv'],
    ] as const) {
      const deck = [parseRoman(prev, am)!, parseRoman(sec, am)!]
      const top = suggest(shippedStats, deck, am, 38)
      expect(top[0]!.statsId, `${prev} → ${sec} should resolve to ${target}`).toBe(target)
    }
  })

  it('every V/x resolves to its target as rank 1 in major', () => {
    for (const [prev, sec, target] of [
      ['I', 'V/IV', 'IV'], ['vi', 'V/V', 'V'], ['I', 'V/ii', 'ii'], ['IV', 'V/vi', 'vi'],
    ] as const) {
      const deck = [parseRoman(prev, cmaj)!, parseRoman(sec, cmaj)!]
      const top = suggest(shippedStats, deck, cmaj, 38)
      expect(top[0]!.statsId, `${prev} → ${sec} should resolve to ${target}`).toBe(target)
    }
  })
})
