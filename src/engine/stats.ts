/** DIVORAWAVE engine — Stage 2 statistics: order-2 → order-1 → unigram backoff
 *  over the shipped transition JSON (brief §6.3).
 *
 *  Backoff is ROW-level: the most specific row that EXISTS is used, then
 *  `row[next] ?? 0` — a present row missing `next` yields 0, it does NOT fall
 *  through to a coarser row. With no order2/unigram in the table (the interim
 *  demo JSON) this reproduces mockup/engine.js exactly:
 *  `(last ? T[last.statsId] : T.START) || {}` → value or 0.
 *
 *  Failure degrades to rules-only mode (uniform stats via blend's +.004 floor)
 *  with a status flag the footer note consumes (brief §4.6) — never a thrown error.
 */
import type { Mode } from '../theory/chords.ts'

export type StatsRow = Record<string, number>

export interface ModeTable {
  /** opener distribution for the empty deck (the demo's START pseudo-row) */
  start: StatsRow
  /** P(next | prev1), keyed on statsId */
  order1: Record<string, StatsRow>
  /** P(next | prev2, prev1), keyed `${prev2}|${prev1}` — absent in the interim demo JSON */
  order2?: Record<string, StatsRow>
  /** unigram priors — absent in the interim demo JSON (keeps demo parity for unknown rows) */
  unigram?: StatsRow
}

export interface TransitionTable {
  version: number
  provenance?: Record<string, unknown>
  minor: ModeTable
  major: ModeTable
}

export type StatsStatus = 'ready' | 'rules-only'

export interface Stats {
  readonly status: StatsStatus
  /** normalized-ish probability mass for `next` given up to two predecessors; rows may be sub-stochastic */
  p(mode: Mode, next: string, prev1?: string, prev2?: string): number
  readonly provenance?: Record<string, unknown>
}

export function createStats(table: TransitionTable): Stats {
  return {
    status: 'ready',
    provenance: table.provenance,
    p(mode, next, prev1, prev2) {
      const t = table[mode]
      if (prev1 === undefined) return t.start[next] ?? 0
      const row = (prev2 !== undefined ? t.order2?.[`${prev2}|${prev1}`] : undefined) ?? t.order1[prev1]
      if (row) return row[next] ?? 0
      return t.unigram?.[next] ?? 0
    },
  }
}

/** §4.6 degradation: no stats at all — every candidate rides the blend's +.004 floor. */
export const rulesOnlyStats: Stats = { status: 'rules-only', p: () => 0 }

/** Load the shipped transition table; any failure (network, HTTP, parse, shape)
 *  returns rulesOnlyStats instead of throwing. */
export async function loadStats(url: string): Promise<Stats> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const table = (await res.json()) as TransitionTable
    if (
      !table || typeof table !== 'object' ||
      !table.minor?.start || !table.minor.order1 ||
      !table.major?.start || !table.major.order1
    ) throw new Error('malformed transition table')
    return createStats(table)
  } catch {
    return rulesOnlyStats
  }
}
