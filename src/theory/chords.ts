/** DIVORAWAVE theory — chord vocabulary, keys, spelling, and name parsing.
 *
 *  Ported from mockup/engine.js (Phase A demo engine). The Q interval sets, ROOTS
 *  spellings, and chordFrom() are verbatim ports frozen by PLAN.md §5; spell() is
 *  deliberately RETAINED as the demo letter-offset speller (PLAN.md §7.14 — its
 *  output is the approved display surface; tonal assists parsing, not spelling).
 *  Name parsing is the one replaced piece: tonal.js tokenizes the symbol
 *  (root / type / slash bass) and the type collapses onto the 11-quality Q
 *  vocabulary per PLAN.md §7.12, then routes through the same classify() snap the
 *  demo used so typed chords stay connected to the stats rows.
 */
import { Chord as TonalChord, ChordType, Note } from 'tonal'
import { classify } from './roman.ts'

export type Mode = 'minor' | 'major'
export type Func = 'T' | 'S' | 'D'
export type Quality =
  | 'maj' | 'min' | 'dim' | 'dom7' | 'min7' | 'maj7'
  | 'halfdim' | 'sus2' | 'sus4' | 'add9' | 'madd9'

/** A candidate class: key-relative chord identity plus engine metadata (§6.2). */
export interface CandidateClass {
  /** root offset from the key root in semitones, 0–11 */
  semis: number
  quality: Quality
  /** roman-degree display label in OUR convention (unicode ♭/°), e.g. '♭VI', 'ii°' */
  roman: string
  /** letter offset 0–6 (scale-degree letter distance) used by spell() */
  lo: number
  func: Func
  /** 0–1, calibrated against the frozen blend constants — do not retune */
  spice: number
  /** stats-row key; coloring variants alias their parent (e.g. 'i(add9)' → 'i') */
  statsId: string
  /** why this candidate exists — stored, never surfaced (brief §6.2) */
  reason: string
}

/** A materialized chord in a key (candidate class + absolute form). */
export interface Chord extends CandidateClass {
  /** semitone intervals from the root (add9/madd9 use 14, NOT 2 — voicing input) */
  ints: readonly number[]
  /** display symbol, unicode accidentals, e.g. 'B♭7', 'Am(add9)', 'A/C♯' */
  name: string
  /** absolute root pitch class 0–11 */
  rootPc: number
  /** spelled root name (unicode), e.g. 'B♭' */
  root: string
  /** spelled slash bass (unicode) when specified, e.g. 'C♯' — display only */
  bass?: string
  /** absolute slash-bass pitch class 0–11; the voicing engine's bass note (§7.20) */
  bassPc?: number
  /** KEY-RELATIVE bass storage (§7.20): semitones above the chord root. Key-relative
   *  so a key change transposes the inversion with the chord (A/C♯ → E/G♯), per
   *  brief §4.2's "the stored progression is the source of truth". */
  bassInterval?: number
  /** letter distance (0–6) from the chord root's letter to the bass's — carries the
   *  correct enharmonic spelling through transposition (C♯ stays a third, not a ♭IV) */
  bassLo?: number
  /** original symbol suffix when the quality was collapsed onto Q (PLAN §7.12), else [] */
  extensions: string[]
}

/** Anything materializable in a key: a candidate class, optionally carrying the
 *  slash-bass and quality-collapse metadata a parsed chord picked up. */
export type Materializable = CandidateClass & Partial<Pick<Chord, 'bassInterval' | 'bassLo' | 'extensions'>>

export interface Key {
  root: string
  pc: number
  mode: Mode
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LSEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** The 12 selectable key roots — preferred vaporwave-friendly spellings, unicode accidentals. */
export const ROOTS: ReadonlyArray<{ n: string; pc: number }> = [
  { n: 'C', pc: 0 }, { n: 'C♯', pc: 1 }, { n: 'D', pc: 2 }, { n: 'E♭', pc: 3 },
  { n: 'E', pc: 4 }, { n: 'F', pc: 5 }, { n: 'F♯', pc: 6 }, { n: 'G', pc: 7 },
  { n: 'A♭', pc: 8 }, { n: 'A', pc: 9 }, { n: 'B♭', pc: 10 }, { n: 'B', pc: 11 },
]

/** The 11-quality vocabulary — interval sets are the voicing input (add9/madd9 = 14). */
export const Q: Record<Quality, { ints: readonly number[]; suf: string }> = {
  maj: { ints: [0, 4, 7], suf: '' },
  min: { ints: [0, 3, 7], suf: 'm' },
  dim: { ints: [0, 3, 6], suf: 'dim' },
  dom7: { ints: [0, 4, 7, 10], suf: '7' },
  min7: { ints: [0, 3, 7, 10], suf: 'm7' },
  maj7: { ints: [0, 4, 7, 11], suf: 'maj7' },
  halfdim: { ints: [0, 3, 6, 10], suf: 'm7♭5' },
  sus2: { ints: [0, 2, 7], suf: 'sus2' },
  sus4: { ints: [0, 5, 7], suf: 'sus4' },
  add9: { ints: [0, 4, 7, 14], suf: 'add9' },
  madd9: { ints: [0, 3, 7, 14], suf: 'm(add9)' },
}

/** Demo-faithful key factory: unknown root names fall back to A (ROOTS[9]) by design,
 *  with a warning so the fallback is observable (PLAN.md Phase 2 §2.2). */
export function makeKey(rootName: string, mode: Mode): Key {
  const r = ROOTS.find(x => x.n === rootName)
  if (!r) console.warn(`makeKey: unknown root '${rootName}' — falling back to A (demo behavior)`)
  const resolved = r ?? ROOTS[9]!
  return { root: resolved.n, pc: resolved.pc, mode }
}

/** Letter-offset chord-root speller (verbatim port). Letter-correct within ±1 accidental,
 *  otherwise falls back to the enharmonic ROOTS spelling. */
function spell(key: Key, semis: number, lo: number): string {
  const ti = LETTERS.indexOf(key.root[0] as (typeof LETTERS)[number])
  const letter = LETTERS[(ti + lo) % 7]!
  const target = (key.pc + semis) % 12
  const acc = ((target - LSEMI[letter]!) % 12 + 18) % 12 - 6
  if (Math.abs(acc) > 1) { const alt = ROOTS.find(x => x.pc === target)!; return alt.n }
  return letter + (acc === 1 ? '♯' : acc === -1 ? '♭' : '')
}

/** Materialize a candidate class in a key (verbatim port + root/bass/extensions).
 *  Idempotent: re-materializing an already-materialized Chord in another key
 *  transposes it, slash bass and quality-collapse record included. */
export function chordFrom(cls: Materializable, key: Key): Chord {
  const q = Q[cls.quality]
  const root = spell(key, cls.semis, cls.lo)
  const rootPc = (key.pc + cls.semis) % 12
  const chord: Chord = {
    ...cls,
    ints: q.ints,
    name: root + q.suf,
    rootPc,
    root,
    extensions: cls.extensions ?? [],
    // the bass is ALWAYS a function of bassInterval — never inherited from the
    // spread, so a stale bass can't outlive the interval that justified it
    bass: undefined,
    bassPc: undefined,
  }
  if (cls.bassInterval !== undefined) {
    // Spell the bass through the same key-relative machinery as the root, so the
    // inversion transposes correctly: A/C♯ in A minor → E/G♯ in E minor (§7.20).
    // bassLo is measured from the root as ACTUALLY SPELLED, so the letter must be
    // re-derived from `root` here — not from cls.lo, which is the pre-spelling
    // letter and diverges whenever spell() takes its enharmonic fallback (that
    // mismatch printed nonsense like "A/D♭" for an A major triad).
    const interval = ((cls.bassInterval % 12) + 12) % 12
    const keyLetter = LETTERS.indexOf(key.root[0] as (typeof LETTERS)[number])
    const rootLetter = LETTERS.indexOf(root[0] as (typeof LETTERS)[number])
    const bassLoFromKey = ((rootLetter + (cls.bassLo ?? 0) - keyLetter) % 7 + 7) % 7
    chord.bassPc = (rootPc + interval) % 12
    chord.bass = spell(key, (cls.semis + interval) % 12, bassLoFromKey)
    chord.name += `/${chord.bass}`
  }
  return chord
}

/* ------------------------------------------------------------------ */
/* accidental normalization — the unicode↔ASCII contract (PLAN §2.1)  */
/* ------------------------------------------------------------------ */

/** unicode → ASCII before every tonal call (tonal parses ASCII accidentals only). */
export function normalizeAccidentals(s: string): string {
  return s.replace(/♯/g, '#').replace(/♭/g, 'b')
}

/* (ASCII → unicode display conversion intentionally absent: spell() is the single
   spelling authority, so no caller needs a blanket accidental replace — which would
   also mangle any lowercase 'b' that isn't an accidental.) */

/* ------------------------------------------------------------------ */
/* name parsing (names mode) — tonal-assisted, Q-collapse per §7.12   */
/* ------------------------------------------------------------------ */

type QualityHit = { quality: Quality; collapsedFrom?: string }

/** Exact-match suffix table (case-SENSITIVE — fixes the demo's 'CM'→minor bug, PLAN §7.3).
 *  Covers the demo SUFQ vocabulary plus common aliases; order is precedence. */
const SUFFIX_TO_QUALITY: ReadonlyArray<readonly [string, Quality]> = [
  ['m7b5', 'halfdim'], ['-7b5', 'halfdim'], ['ø7', 'halfdim'], ['ø', 'halfdim'],
  ['m(add9)', 'madd9'], ['madd9', 'madd9'], ['madd2', 'madd9'], ['m(add2)', 'madd9'],
  ['maj7', 'maj7'], ['Maj7', 'maj7'], ['M7', 'maj7'], ['ma7', 'maj7'], ['Δ', 'maj7'], ['^7', 'maj7'],
  ['add9', 'add9'], ['add2', 'add9'], ['Madd9', 'add9'],
  ['sus2', 'sus2'], ['sus4', 'sus4'], ['sus', 'sus4'],
  ['dim', 'dim'], ['°', 'dim'], ['o', 'dim'],
  ['min7', 'min7'], ['m7', 'min7'], ['-7', 'min7'],
  ['min', 'min'], ['m', 'min'], ['-', 'min'],
  ['maj', 'maj'], ['M', 'maj'], ['', 'maj'],
  ['7', 'dom7'], ['dom', 'dom7'],
]

/** Collapse table (§7.12): qualities outside Q with a natural parent map onto it;
 *  the original suffix is preserved in Chord.extensions. */
const COLLAPSE_SUFFIX: ReadonlyArray<readonly [string, Quality]> = [
  ['dim7', 'dim'], ['°7', 'dim'], ['o7', 'dim'],
  ['9', 'dom7'], ['m9', 'min7'], ['min9', 'min7'], ['-9', 'min7'],
  ['maj9', 'maj7'], ['M9', 'maj7'],
  ['6', 'maj'], ['M6', 'maj'], ['add6', 'maj'],
  ['m6', 'min'], ['min6', 'min'], ['-6', 'min'],
  ['7sus4', 'sus4'],
]

/** Chroma-set → quality, for tonal chord types not covered by the string tables. */
const CHROMA_TO_QUALITY: ReadonlyArray<readonly [string, Quality, boolean]> = [
  // [sorted pitch-class set, quality, isCollapse]
  ['0,4,7', 'maj', false], ['0,3,7', 'min', false], ['0,3,6', 'dim', false],
  ['0,4,7,10', 'dom7', false], ['0,3,7,10', 'min7', false], ['0,4,7,11', 'maj7', false],
  ['0,3,6,10', 'halfdim', false], ['0,2,7', 'sus2', false], ['0,5,7', 'sus4', false],
  ['0,2,4,7', 'add9', false], ['0,2,3,7', 'madd9', false],
  ['0,2,4,7,10', 'dom7', true], ['0,2,3,7,10', 'min7', true], ['0,2,4,7,11', 'maj7', true],
  ['0,4,7,9', 'maj', true], ['0,3,7,9', 'min', true], ['0,3,6,9', 'dim', true],
  ['0,5,7,10', 'sus4', true],
]

/** Case-insensitive retry for unambiguous suffixes only: 'CMAJ7'/'CSUS2'/'ADIM7' parse
 *  (the demo accepted them), while the m/M collision family stays case-sensitive so the
 *  §7.3 CM-bug fix holds. A lowercase form matching entries with DIFFERENT qualities
 *  (m vs M, m7 vs M7, madd9 vs Madd9…) is ambiguous → rejected here. */
function ciLookup(type: string): QualityHit | null {
  const lower = type.toLowerCase()
  const hits: QualityHit[] = []
  for (const [s, q] of SUFFIX_TO_QUALITY) if (s.toLowerCase() === lower) hits.push({ quality: q })
  for (const [s, q] of COLLAPSE_SUFFIX) if (s.toLowerCase() === lower) hits.push({ quality: q, collapsedFrom: type })
  const first = hits[0]
  if (!first) return null
  return hits.every(h => h.quality === first.quality) ? first : null
}

function qualityFromType(type: string): QualityHit | null {
  const exact = SUFFIX_TO_QUALITY.find(([s]) => s === type)
  if (exact) return { quality: exact[1] }
  const collapsed = COLLAPSE_SUFFIX.find(([s]) => s === type)
  if (collapsed) return { quality: collapsed[1], collapsedFrom: type }
  const ci = ciLookup(type)
  if (ci) return ci
  // fall back to tonal's chord-type dictionary (wide alias coverage), then chroma-match
  const ct = ChordType.get(type)
  if (ct.empty || typeof ct.chroma !== 'string') return null
  const set = [...ct.chroma].flatMap((bit, i) => (bit === '1' ? [i] : [])).join(',')
  const hit = CHROMA_TO_QUALITY.find(([s]) => s === set)
  if (!hit) return null
  return hit[2] ? { quality: hit[1], collapsedFrom: type } : { quality: hit[1] }
}

/** Parse a chord symbol in names mode → key-relative Chord via the classify snap.
 *  Accepts unicode and ASCII accidentals; a slash bass is stored key-relatively and
 *  voiced (§7.20). Returns null for anything that can't collapse onto Q (§7.12). */
export function parseName(str: string, key: Key): Chord | null {
  const trimmed = str.trim()
  if (!trimmed) return null
  const ascii = normalizeAccidentals(trimmed)
  const input = ascii[0]!.toUpperCase() + ascii.slice(1)
  const [tonic, type, bassRaw] = TonalChord.tokenize(input)
  if (!tonic) return null
  const pc = Note.chroma(tonic)
  if (!Number.isFinite(pc)) return null // tonal returns NaN (typeof 'number') for invalid names
  const q = qualityFromType(type ?? '')
  if (!q) return null
  const chord = classify(((pc! - key.pc) % 12 + 12) % 12, q.quality, key)
  if (q.collapsedFrom !== undefined) chord.extensions = [q.collapsedFrom]
  if (bassRaw) {
    const bpc = Note.chroma(bassRaw)
    if (!Number.isFinite(bpc)) return null
    const rootLetterIdx = LETTERS.indexOf(chord.root[0] as (typeof LETTERS)[number])
    const bassLetterIdx = LETTERS.indexOf(bassRaw[0]!.toUpperCase() as (typeof LETTERS)[number])
    if (rootLetterIdx < 0 || bassLetterIdx < 0) return null
    // store the bass key-relatively, then re-materialize so name/bass/bassPc are
    // computed by the single code path that also handles transposition (§7.20)
    chord.bassInterval = ((bpc! - chord.rootPc) % 12 + 12) % 12
    chord.bassLo = ((bassLetterIdx - rootLetterIdx) % 7 + 7) % 7
    return chordFrom(chord, key)
  }
  return chord
}
