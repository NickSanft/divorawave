/** Conjure constraint tests (brief §6.2/§6.5, PLAN.md Phase 2.3) over seeded runs:
 *  loop-shaped ending, no literal repeats, ≤2 consecutive same-function (final chord
 *  exempt — the §7 review-fix ordering), and the 4-vs-8 length split. */
import { describe, expect, it } from 'vitest'
import { makeKey } from './rules.ts'
import { conjure } from './conjure.ts'
import { shippedStats, mulberry32 } from '../test/helpers.ts'

const RUNS_PER_DIAL = 200
const DIALS = [0, 38, 70, 100]

describe('conjure constraints (seeded)', () => {
  for (const mode of ['minor', 'major'] as const) {
    const key = makeKey(mode === 'minor' ? 'A' : 'C', mode)

    it(`${mode}: every run is loop-shaped, repeat-free, and function-disciplined`, () => {
      let fours = 0
      let total = 0
      for (const dial of DIALS) {
        for (let seed = 1; seed <= RUNS_PER_DIAL; seed++) {
          const deck = conjure(shippedStats, key, dial, mulberry32(seed * 31 + dial))
          total++
          expect([4, 8]).toContain(deck.length)
          if (deck.length === 4) fours++

          // loop-shape: final chord pulls home — dominant function, no secondary dominants
          const last = deck[deck.length - 1]!
          expect(last.func, `seed ${seed} dial ${dial}: ends on ${last.roman}`).toBe('D')
          expect(last.roman.includes('/'), `seed ${seed} dial ${dial}: ends on ${last.roman}`).toBe(false)

          // no immediate literal repeat (same semis + quality)
          for (let i = 1; i < deck.length; i++) {
            const a = deck[i - 1]!, b = deck[i]!
            expect(a.semis === b.semis && a.quality === b.quality,
              `seed ${seed} dial ${dial}: literal repeat ${a.roman}→${b.roman}`).toBe(false)
          }

          // ≤2 consecutive same-function within the non-final prefix (final chord is exempt)
          for (let i = 0; i + 2 <= deck.length - 2; i++) {
            const f = deck[i]!.func
            const run3 = deck[i + 1]!.func === f && deck[i + 2]!.func === f
            expect(run3, `seed ${seed} dial ${dial}: 3-run of ${f} at ${i}`).toBe(false)
          }
        }
      }
      // length split: p(4) = .7 — loose bounds over the aggregate
      const frac = fours / total
      expect(frac).toBeGreaterThan(.62)
      expect(frac).toBeLessThan(.78)
    })
  }

  it('is deterministic under a fixed seed (the injectable rng seam)', () => {
    const key = makeKey('A', 'minor')
    const a = conjure(shippedStats, key, 38, mulberry32(7)).map(c => c.roman)
    const b = conjure(shippedStats, key, 38, mulberry32(7)).map(c => c.roman)
    expect(a).toEqual(b)
  })
})
