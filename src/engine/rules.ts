/** DIVORAWAVE engine — Stage 1 rules layer: the candidate-class tables (brief §6.2).
 *
 *  Verbatim port of mockup/engine.js MINOR/MAJOR. PLAN.md §5 freezes the tables:
 *  spice values are calibrated against the blend constants (do not retune
 *  independently), func assignments are load-bearing (♭VII = D is what lets Conjure
 *  cadence on it), statsId aliasing makes coloring variants share their parent's
 *  stats row, and ARRAY ORDER matters (empty-input chips = the first 8 entries =
 *  the §4.6 synthwave openers; classify()'s first-match determinism).
 *
 *  Additive vs the demo: each class carries a `reason` string — stored for a
 *  future "why" surface, never shown in the POC (brief §6.2, non-goal §2).
 */
import { chordFrom, type CandidateClass, type Chord, type Func, type Key, type Quality } from '../theory/chords.ts'

export { makeKey, ROOTS } from '../theory/chords.ts'

function c(semis: number, quality: Quality, roman: string, lo: number, func: Func, spice: number, reason: string, statsId?: string): CandidateClass {
  return { semis, quality, roman, lo, func, spice, statsId: statsId || roman, reason }
}

/** Minor-key candidate classes — aeolian center of gravity. func: T tonic / S subdominant / D dominant. */
const MINOR: readonly CandidateClass[] = [
  c(0, 'min', 'i', 0, 'T', 0, 'diatonic tonic of the natural minor'),
  c(0, 'madd9', 'i(add9)', 0, 'T', .12, 'add9 coloring on i — synthwave shimmer', 'i'),
  c(2, 'dim', 'ii°', 1, 'S', .1, 'diatonic supertonic diminished'),
  c(2, 'halfdim', 'iiø7', 1, 'S', .18, 'half-diminished seventh coloring on ii°', 'ii°'),
  c(3, 'maj', '♭III', 2, 'T', 0, 'diatonic mediant major'),
  c(5, 'min', 'iv', 3, 'S', 0, 'diatonic subdominant minor'),
  c(5, 'sus2', 'ivsus2', 3, 'S', .12, 'sus2 coloring on iv', 'iv'),
  c(7, 'min', 'v', 4, 'D', .05, 'diatonic minor dominant — modal, no leading tone'),
  c(8, 'maj', '♭VI', 5, 'S', 0, 'diatonic submediant major'),
  c(8, 'add9', '♭VIadd9', 5, 'S', .12, 'add9 coloring on ♭VI', '♭VI'),
  c(10, 'maj', '♭VII', 6, 'D', 0, 'diatonic subtonic major — the aeolian cadence chord'),
  c(7, 'maj', 'V', 4, 'D', .2, 'harmonic-minor major dominant — the pull home'),
  c(7, 'dom7', 'V7', 4, 'D', .25, 'harmonic-minor dominant seventh — stronger pull home'),
  c(5, 'maj', 'IV', 3, 'S', .45, 'dorian brightening of iv (borrowed from dorian)'),
  c(0, 'maj', 'I', 0, 'T', .5, 'cadential picardy major tonic (borrowed from the parallel major)'),
  c(10, 'dom7', 'V/♭III', 6, 'D', .6, 'secondary dominant of ♭III'),
  c(3, 'dom7', 'V/♭VI', 2, 'D', .6, 'secondary dominant of ♭VI'),
  c(5, 'dom7', 'V/♭VII', 3, 'D', .62, 'secondary dominant of ♭VII'),
  c(0, 'dom7', 'V/iv', 0, 'D', .6, 'secondary dominant of iv'),
  c(1, 'maj', '♭II', 1, 'S', .8, 'Neapolitan flavor — the deep-ether shelf'),
  c(1, 'dom7', '♭II7', 1, 'D', .9, 'tritone substitute of V — the deep-ether shelf'),
]

/** Major-key mirror: standard functional graph plus borrowed iv, ♭VI, ♭VII. */
const MAJOR: readonly CandidateClass[] = [
  c(0, 'maj', 'I', 0, 'T', 0, 'diatonic tonic'),
  c(0, 'add9', 'Iadd9', 0, 'T', .12, 'add9 coloring on I', 'I'),
  c(2, 'min', 'ii', 1, 'S', 0, 'diatonic supertonic'),
  c(2, 'min7', 'ii7', 1, 'S', .1, 'minor-seventh coloring on ii', 'ii'),
  c(4, 'min', 'iii', 2, 'T', .12, 'diatonic mediant'),
  c(5, 'maj', 'IV', 3, 'S', 0, 'diatonic subdominant'),
  c(5, 'add9', 'IVadd9', 3, 'S', .12, 'add9 coloring on IV', 'IV'),
  c(7, 'maj', 'V', 4, 'D', 0, 'diatonic dominant'),
  c(7, 'dom7', 'V7', 4, 'D', .1, 'dominant-seventh coloring on V', 'V'),
  c(9, 'min', 'vi', 5, 'T', 0, 'diatonic submediant'),
  c(11, 'dim', 'vii°', 6, 'D', .2, 'diatonic leading-tone diminished'),
  c(5, 'min', 'iv', 3, 'S', .45, 'borrowed minor subdominant (parallel minor)'),
  c(8, 'maj', '♭VI', 5, 'S', .5, 'borrowed submediant (parallel minor)'),
  c(10, 'maj', '♭VII', 6, 'D', .4, 'borrowed subtonic (parallel minor)'),
  c(9, 'dom7', 'V/ii', 5, 'D', .6, 'secondary dominant of ii'),
  c(0, 'dom7', 'V/IV', 0, 'D', .55, 'secondary dominant of IV'),
  c(2, 'dom7', 'V/V', 1, 'D', .6, 'secondary dominant of V'),
  c(4, 'dom7', 'V/vi', 2, 'D', .6, 'secondary dominant of vi'),
  c(1, 'dom7', '♭II7', 1, 'D', .9, 'tritone substitute of V — the deep-ether shelf'),
]

/** The entire Stage-1 rules layer at runtime: materialize the mode's classes in the key. */
export function candidates(key: Key): Chord[] {
  return (key.mode === 'minor' ? MINOR : MAJOR).map(cl => chordFrom(cl, key))
}
