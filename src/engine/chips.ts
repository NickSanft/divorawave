/** DIVORAWAVE engine — autocomplete chips for the chord input (brief §4.2).
 *
 *  Verbatim port of mockup/engine.js chips(). The pool is candidate-derived so
 *  every chip is guaranteed parseable; empty input returns the FIRST 8 pool
 *  entries, which — because the rules tables are ordered diatonic-first — is the
 *  §4.6 "common synthwave openers" seeding. Do not reorder the tables.
 */
import { candidates } from './rules.ts'
import type { Key } from '../theory/chords.ts'

export type Notation = 'names' | 'roman'

export function chips(key: Key, notation: Notation, input: string): string[] {
  const cands = candidates(key)
  const pool = [...new Map(cands.map(cd => [notation === 'names' ? cd.name : cd.roman, cd])).keys()]
  const q = input.trim().toLowerCase().replace(/#/g, '♯')
  const list = q
    ? pool.filter(nm => nm.toLowerCase().startsWith(q) || nm.toLowerCase().startsWith(q.replace(/♯/g, '#')))
    : pool.slice(0, 8)
  return list.slice(0, 8)
}
