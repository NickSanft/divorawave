/** DIVORAWAVE engine — §6.5 Conjure: temperature sampling over the blend,
 *  loop-shaped ending (the final chord's function pulls back to i).
 *
 *  Verbatim port of mockup/engine.js conjure(); PLAN.md §5 freezes the shape,
 *  including the review-fix ordering: the final-chord home filter
 *  (func === 'D' && no '/' in the roman — secondary dominants excluded) applies
 *  to the ORIGINAL 12-candidate pool via if/else-if, so the last chord is EXEMPT
 *  from the same-function filter. Both filters fall back to the unfiltered pool
 *  when they would empty it. Constants: length 4 (p=.7) or 8 · pool 12 ·
 *  τ = .65 + .5·(dial/100) · weights max(score,1e-4)^(1/τ) · roulette wheel with
 *  pool[0] fallback. conjure never passes prevUppers — no VL term in sampling.
 *
 *  rng stays injectable: the unit-test seam and the seeded-RNG stretch goal.
 */
import { suggest, type Suggestion } from './blend.ts'
import type { Key } from '../theory/chords.ts'
import type { Stats } from './stats.ts'

export function conjure(stats: Stats, key: Key, dial: number, rng: () => number = Math.random): Suggestion[] {
  const len = rng() < .7 ? 4 : 8
  const deck: Suggestion[] = []
  for (let i = 0; i < len; i++) {
    let pool = suggest(stats, deck, key, dial, 12)
    const l = deck[i - 1], p2 = deck[i - 2]
    if (i === len - 1) {
      // loop-shape rule outranks the function-repetition constraint: filter the ORIGINAL pool
      const home = pool.filter(cd => cd.func === 'D' && !cd.roman.includes('/'))
      if (home.length) pool = home
    } else if (l && p2 && l.func === p2.func) {
      const f = pool.filter(cd => cd.func !== l.func)
      if (f.length) pool = f
    }
    const tau = .65 + .5 * (dial / 100)
    const ws = pool.map(cd => Math.pow(Math.max(cd.score, 1e-4), 1 / tau))
    let r = rng() * ws.reduce((x, y) => x + y, 0)
    let pick = pool[0]!
    for (let k = 0; k < pool.length; k++) { r -= ws[k]!; if (r <= 0) { pick = pool[k]!; break } }
    deck.push(pick)
  }
  return deck
}
