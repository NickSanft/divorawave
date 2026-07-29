/** DIVORAWAVE engine — the §6.4 blend: score = (1−a)·P̂stats + a·spice·novelty,
 *  voice-leading smoothness as tiebreaker.
 *
 *  Verbatim port of mockup/engine.js suggest(); PLAN.md §5 freezes every constant:
 *  aa = a^1.8 · novelty = .35+.65·max(0, 1−P̂·5) · spice term (.12+.88·spice)·novelty·.2
 *  · coloring-variant demotion ×.72 (keyed on statsId ≠ roman) · VL tiebreak
 *  +.006·(1−min(d,24)/24) ONLY when prevUppers is passed (conjure never passes it)
 *  · the +.004 floor AND the ×.25 same-function penalty both apply to raw p BEFORE
 *  the normalizing sum · no-literal-repeat filters on (semis, quality) · top-N dedupe
 *  by BOTH name and statsId (one coloring variant per parent) · rel = (s/smax)^1.15.
 *
 *  The only structural change from the demo: the row lookup
 *  `const row = (last ? T[last.statsId] : T.START) || {}` became the injected
 *  stats backoff query — both branches route through stats.p (START = no prev1).
 */
import { candidates } from './rules.ts'
import { voice } from '../theory/voicing.ts'
import type { Chord, Key } from '../theory/chords.ts'
import type { Stats } from './stats.ts'

export interface Suggestion extends Chord {
  /** (score/smax)^1.15 — display transform driving orb diameter/glow, not ranking */
  rel: number
  score: number
  rank: number
}

export function suggest(
  stats: Stats,
  deck: readonly Chord[],
  key: Key,
  dial: number,
  count = 6,
  prevUppers: readonly number[] | null = null,
): Suggestion[] {
  const a = dial / 100
  const cands = candidates(key)
  const last = deck[deck.length - 1]
  const prev2 = deck[deck.length - 2]
  const list = cands.filter(ch => !(last && ch.semis === last.semis && ch.quality === last.quality))
  const sameFunc = last && prev2 && last.func === prev2.func ? last.func : null
  const raw = list.map(ch => {
    let p = stats.p(key.mode, ch.statsId, last?.statsId, prev2?.statsId) + .004
    if (sameFunc && ch.func === sameFunc) p *= .25
    return p
  })
  const sum = raw.reduce((x, y) => x + y, 0)
  const scored = list.map((ch, i) => {
    const Pn = raw[i]! / sum
    const novelty = .35 + .65 * Math.max(0, 1 - Pn * 5)
    const aa = Math.pow(a, 1.8) // curved: spice ENTERS the top-6 near DEEP ETHER, doesn't own the default
    let s = (1 - aa) * Pn + aa * (.12 + .88 * ch.spice) * novelty * .2 // spice term scaled to stats magnitude
    if (ch.statsId !== ch.roman) s *= .72 // colour variants sit below their parent
    if (prevUppers) { const d = voice(ch, prevUppers).dist; s += .006 * (1 - Math.min(d, 24) / 24) }
    return { ch, s }
  }).sort((x, y) => y.s - x.s)
  const seen = new Set<string>(), seenStats = new Set<string>(), top: { ch: Chord; s: number }[] = []
  for (const it of scored) {
    if (seen.has(it.ch.name) || seenStats.has(it.ch.statsId)) continue // one variant per parent
    seen.add(it.ch.name); seenStats.add(it.ch.statsId); top.push(it)
    if (top.length >= count) break
  }
  const smax = top[0]!.s
  return top.map((t, i) => {
    const rel = Math.pow(t.s / smax, 1.15)
    return { ...t.ch, rel, score: t.s, rank: i + 1 }
  })
}
