/** DIVORAWAVE distiller — pure core (no Node APIs, unit-testable from src/test).
 *  The I/O shell is tools/distill.ts; PLAN.md Phase 5.1 governs both.
 */

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Minimal RFC-4180-ish line parser: handles "..." quoting and doubled "" escapes.
 *  Chordonomicon rows are single-line; multiline fields are not supported. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(field)
      field = ''
    } else {
      field += c
    }
  }
  out.push(field)
  return out
}

/* ------------------------------------------------------------------ */
/* token normalization (PLAN 5.1.3)                                    */
/* ------------------------------------------------------------------ */

/** Corpus chord token → parseName-compatible symbol.
 *  The sharp substitution is POSITIONAL: `s` becomes `#` only right after a root
 *  letter A–G and never when it opens `sus` (a bare `([A-G])s` would corrupt every
 *  sus chord: Csus4 → C#u#4). Applies to root and slash-bass segments alike.
 *  `min` → `m` afterward (Emin → Em, Csmin → C#m). */
export function normalizeToken(token: string): string {
  return token.replace(/([A-G])s(?!us)/g, '$1#').replace(/min/g, 'm')
}

/** True for the structural markers (`<verse_1>`, `<chorus_2>`, …). */
export function isSectionMarker(token: string): boolean {
  return token.startsWith('<') && token.endsWith('>')
}

/* ------------------------------------------------------------------ */
/* Krumhansl–Schmuckler key estimation (PLAN 5.1.3)                    */
/* ------------------------------------------------------------------ */

const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88] as const
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17] as const

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length
  let sa = 0, sb = 0
  for (let i = 0; i < n; i++) { sa += a[i]!; sb += b[i]! }
  const ma = sa / n, mb = sb / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma, xb = b[i]! - mb
    num += xa * xb; da += xa * xa; db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

export interface KeyEstimate {
  pc: number
  mode: 'minor' | 'major'
  /** best correlation minus second-best across all 24 candidates — the confidence gate */
  margin: number
}

/** Estimate the key from a 12-bin pitch-class histogram: correlate against all 24
 *  rotated K-S profiles, argmax; margin = best − runner-up. */
export function estimateKey(hist: readonly number[]): KeyEstimate {
  const scores: Array<{ pc: number; mode: 'minor' | 'major'; r: number }> = []
  for (const [mode, profile] of [['major', KRUMHANSL_MAJOR], ['minor', KRUMHANSL_MINOR]] as const) {
    for (let pc = 0; pc < 12; pc++) {
      const rotated: number[] = []
      for (let i = 0; i < 12; i++) rotated.push(hist[(i + pc) % 12]!)
      scores.push({ pc, mode, r: pearson(rotated, profile) })
    }
  }
  scores.sort((a, b) => b.r - a.r)
  const best = scores[0]!
  return { pc: best.pc, mode: best.mode, margin: best.r - scores[1]!.r }
}

/* ------------------------------------------------------------------ */
/* transition counting → table emission (PLAN 5.1.4–5.1.6)             */
/* ------------------------------------------------------------------ */

export type CountRow = Map<string, number>

export interface ModeCounts {
  start: CountRow
  order1: Map<string, CountRow>
  order2: Map<string, CountRow>
  unigram: CountRow
}

export function emptyModeCounts(): ModeCounts {
  return { start: new Map(), order1: new Map(), order2: new Map(), unigram: new Map() }
}

const bump = (row: CountRow, k: string): void => { row.set(k, (row.get(k) ?? 0) + 1) }
const bumpNested = (m: Map<string, CountRow>, rowKey: string, k: string): void => {
  let row = m.get(rowKey)
  if (!row) { row = new Map(); m.set(rowKey, row) }
  bump(row, k)
}

/** Count one song's statsId sequence into the mode bucket. `starts` are indices
 *  that open the song or a structural section (the START opener distribution).
 *  Consecutive duplicate statsIds are collapsed by the caller. */
export function countSong(counts: ModeCounts, ids: readonly string[], starts: readonly number[]): void {
  for (const s of starts) if (ids[s] !== undefined) bump(counts.start, ids[s]!)
  for (let i = 0; i < ids.length; i++) {
    bump(counts.unigram, ids[i]!)
    if (i >= 1) bumpNested(counts.order1, ids[i - 1]!, ids[i]!)
    if (i >= 2) bumpNested(counts.order2, `${ids[i - 2]}|${ids[i - 1]}`, ids[i]!)
  }
}

export interface EmitOptions {
  /** drop next-entries with fewer than this many observations */
  minCount: number
  /** drop rows whose total observations fall below this */
  minRowTotal: number
  /** keep at most this many entries per row (highest counts win) */
  maxRowEntries: number
  /** Laplace add-k smoothing (brief §6.3), as a fraction of the row total added to
   *  each kept entry: p = (p_raw + k)/(1 + k·n). Lifts the thin consensus tail so
   *  the frozen blend's spice term can't outrun real consensus too early. */
  laplaceK: number
  /** statsIds excluded as TARGETS (deep shelf): the demo consensus table never
   *  targets them — they are reachable through the spice term alone.
   *  They remain row SOURCES (resolution rows), matching the demo shape. */
  excludeTargets: ReadonlySet<string>
  /** when set, only these statsIds may appear as TARGETS (the runtime candidate
   *  vocabulary) — out-of-vocab targets are unreachable in suggestions and an
   *  all-unreachable row zeroes the stats term under row-level backoff */
  vocabulary?: ReadonlySet<string>
}

export const EMIT_DEFAULTS: Omit<EmitOptions, 'excludeTargets'> = {
  minCount: 3, minRowTotal: 8, maxRowEntries: 12, laplaceK: .02,
}

/** Normalize a count row to probabilities (4 decimals), pruned + Laplace-smoothed. */
export function emitRow(row: CountRow, opts: EmitOptions): Record<string, number> | null {
  const admissible = (k: string): boolean =>
    !opts.excludeTargets.has(k) && (!opts.vocabulary || opts.vocabulary.has(k))
  let total = 0
  for (const [k, v] of row) { if (admissible(k)) total += v }
  if (total < opts.minRowTotal) return null
  const kept = [...row.entries()]
    .filter(([k, v]) => v >= opts.minCount && admissible(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.maxRowEntries)
  if (!kept.length) return null
  const n = kept.length
  const out: Record<string, number> = {}
  for (const [k, v] of kept) {
    const p = (v / total + opts.laplaceK) / (1 + opts.laplaceK * n)
    out[k] = Math.round(p * 10000) / 10000
  }
  return out
}

export interface EmittedMode {
  start: Record<string, number>
  order1: Record<string, Record<string, number>>
  order2: Record<string, Record<string, number>>
  unigram: Record<string, number>
}

export function emitMode(counts: ModeCounts, opts: EmitOptions): EmittedMode {
  const start = emitRow(counts.start, { ...opts, minRowTotal: 1, minCount: 1 }) ?? {}
  const unigram = emitRow(counts.unigram, { ...opts, minRowTotal: 1 }) ?? {}
  const order1: Record<string, Record<string, number>> = {}
  for (const [k, row] of counts.order1) {
    const emitted = emitRow(row, opts)
    if (emitted) order1[k] = emitted
  }
  const order2: Record<string, Record<string, number>> = {}
  for (const [k, row] of counts.order2) {
    const emitted = emitRow(row, opts)
    if (emitted) order2[k] = emitted
  }
  return { start, order1, order2, unigram }
}

/** §7.5: hand-authored secondary-dominant resolution rows, layered OVER the
 *  distilled table (flagged in provenance). Note the corpus DOES produce `V/x`
 *  statsIds — classify() snaps dom7s on the right degrees to them — so the
 *  distiller must both overwrite these order-1 rows AND delete corpus order-2
 *  rows sourced from a secondary, or backoff would shadow the resolutions. */
export const SECONDARY_ROWS: Record<'minor' | 'major', Record<string, Record<string, number>>> = {
  minor: { 'V/♭III': { '♭III': .6 }, 'V/♭VI': { '♭VI': .6 }, 'V/♭VII': { '♭VII': .6 }, 'V/iv': { iv: .6 } },
  major: { 'V/ii': { ii: .6 }, 'V/IV': { IV: .6 }, 'V/V': { V: .6 }, 'V/vi': { vi: .6 } },
}
