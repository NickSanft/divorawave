/** DIVORAWAVE theory — roman-numeral classification and parsing, in OUR convention
 *  (minor: i, ii°, ♭III, iv, v, ♭VI, ♭VII, plus borrowed V / picardy I).
 *
 *  tonal's roman/progression modules are mode-agnostic (uppercase-only, major-scale
 *  degrees) so they cannot produce this convention — the label authority is the
 *  candidate tables plus classify() (PLAN.md §7.10). classify() is a verbatim port:
 *  its snap-to-candidate step is what keeps user-entered chords connected to STATS.
 *
 *  Deviation from the demo (PLAN.md §7.3): parseRoman does a case-SENSITIVE direct
 *  match first, so 'V' and 'I' reach the harmonic-minor dominant and picardy I in
 *  minor keys instead of being shadowed by 'v'/'i'.
 */
import { candidates } from '../engine/rules.ts'
import { Q, chordFrom, type Chord, type Key, type Quality } from './chords.ts'

/** Map (semis, quality) onto a candidate class if one matches, else synthesize a
 *  class (spice .5, heuristic func, statsId = constructed roman). Verbatim port. */
export function classify(semis: number, quality: Quality, key: Key): Chord {
  const hit = candidates(key).find(cd => cd.semis === semis && cd.quality === quality)
  if (hit) return { ...hit }
  const M: Record<number, readonly [string, number]> = {
    0: ['I', 0], 1: ['♭II', 1], 2: ['II', 1], 3: ['♭III', 2], 4: ['III', 2], 5: ['IV', 3],
    6: ['♭V', 4], 7: ['V', 4], 8: ['♭VI', 5], 9: ['VI', 5], 10: ['♭VII', 6], 11: ['VII', 6],
  }
  const [lab, lo] = M[semis]!
  const minorish = (['min', 'min7', 'dim', 'halfdim', 'madd9'] as Quality[]).includes(quality)
  let roman = minorish ? lab.replace(/[IV]+/, s => s.toLowerCase()) : lab
  if (quality === 'dim') roman += '°'
  if (quality === 'halfdim') roman += 'ø7'
  if (quality === 'dom7' || quality === 'min7') roman += '7'
  if (quality === 'maj7') roman += 'maj7'
  if ((['sus2', 'sus4', 'add9', 'madd9'] as Quality[]).includes(quality)) roman += Q[quality].suf.replace('m(', '(')
  const func = [0, 3, 4, 9].includes(semis) ? 'T' : [7, 10, 11].includes(semis) ? 'D' : 'S'
  return chordFrom(
    { semis, quality, roman, lo, func, spice: .5, statsId: roman, reason: 'out-of-vocabulary — classified by degree heuristic' },
    key,
  )
}

/** Parse a roman numeral (our convention) → Chord.
 *  Order: case-sensitive direct match (§7.3 fix) → case-insensitive direct match
 *  (demo behavior, keeps 'biii' → ♭III and 'v7' → V7 working) → regex + classify.
 *
 *  Recorded decision (PLAN.md §7.3): typed case is honored exactly where BOTH-case
 *  candidates exist in the table (minor i/I, v/V, iv/IV; major iv/IV). For degrees
 *  with a single-case candidate the ci fallback maps to that sole candidate even if
 *  the typed case differs (major 'v' → V, 'II' → ii, …) — inherited demo behavior,
 *  kept so 'v7' → V7 and 'biii' → ♭III conveniences survive. */
export function parseRoman(str: string, key: Key): Chord | null {
  const s = str.trim().replace(/b(?=[IViv])/g, '♭')
  const cands = candidates(key)
  const exact = cands.find(cd => cd.roman === s)
  if (exact) return { ...exact }
  const direct = cands.find(cd => cd.roman.toLowerCase() === s.toLowerCase())
  if (direct) return { ...direct }
  const m = /^(♭?)([ivIV]+)(°|ø|o)?(maj7|7|sus2|sus4|add9)?$/.exec(s)
  if (!m) return null
  const NUM: Record<string, number> = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 }
  const base = NUM[m[2]!.toLowerCase()]
  if (base === undefined) return null
  const semis = (base + (m[1] ? -1 : 0) + 12) % 12
  const lower = m[2] === m[2]!.toLowerCase()
  let quality: Quality = lower ? 'min' : 'maj'
  if (m[3]) quality = 'dim'
  if (m[4] === '7') quality = m[3] ? 'halfdim' : lower ? 'min7' : 'dom7'
  if (m[4] === 'maj7') quality = 'maj7'
  if (m[4] === 'sus2') quality = 'sus2'
  if (m[4] === 'sus4') quality = 'sus4'
  if (m[4] === 'add9') quality = lower ? 'madd9' : 'add9'
  return classify(semis, quality, key)
}
