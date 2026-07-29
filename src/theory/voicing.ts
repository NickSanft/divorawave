/** DIVORAWAVE theory — voice-leading-aware voicing engine (brief §8.3).
 *
 *  Verbatim port of mockup/engine.js voice(); PLAN.md §5 freezes every constant:
 *  bass = MIDI 36 + rootPc (octave 2, always the root — specified bass is §7.4 backlog);
 *  >3 distinct pitch classes → root dropped from the uppers (the bass covers it);
 *  candidate voicings = every rotation of the upper pcs stacked ascending from a base
 *  note in 48..62 whose pc matches the rotation head, rejected if the top exceeds 76;
 *  cost vs a previous voicing = sum of |Δ| over SORTED, index-clamped note lists;
 *  first-chord cost = |mean − 59|·1.5 + (lowest < 50 ? 2 : 0).
 *  dist doubles as the blend tiebreaker (engine/blend.ts).
 */
import type { Chord } from './chords.ts'

export interface Voicing {
  bass: number
  uppers: number[]
  all: number[]
  dist: number
}

export function voice(ch: Pick<Chord, 'ints' | 'rootPc'>, prevUppers: readonly number[] | null = null): Voicing {
  const bass = 36 + ch.rootPc
  const pcs = [...new Set(ch.ints.map(i => (ch.rootPc + i) % 12))]
  const upperPcs = pcs.length > 3 ? pcs.slice(1) : pcs
  const n = upperPcs.length
  const opts: number[][] = []
  for (let r = 0; r < n; r++) {
    const rot = upperPcs.slice(r).concat(upperPcs.slice(0, r))
    for (let base = 48; base <= 62; base++) {
      if (base % 12 !== rot[0]) continue
      const notes = [base]
      for (let k = 1; k < n; k++) { let m = notes[k - 1]! + 1; while (m % 12 !== rot[k]) m++; notes.push(m) }
      if (notes[notes.length - 1]! > 76) continue
      opts.push(notes)
    }
  }
  let best = opts[0]!, bd = 1e9
  for (const o of opts) {
    let d: number
    if (prevUppers && prevUppers.length) {
      const a = [...o].sort((x, y) => x - y), b = [...prevUppers].sort((x, y) => x - y)
      const len = Math.max(a.length, b.length); d = 0
      for (let i = 0; i < len; i++) d += Math.abs(a[Math.min(i, a.length - 1)]! - b[Math.min(i, b.length - 1)]!)
    } else {
      const mean = o.reduce((x, y) => x + y, 0) / o.length
      d = Math.abs(mean - 59) * 1.5 + (o[0]! < 50 ? 2 : 0)
    }
    if (d < bd) { bd = d; best = o }
  }
  return { bass, uppers: best, all: [bass, ...best], dist: bd }
}
