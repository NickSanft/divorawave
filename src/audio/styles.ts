/** DIVORAWAVE audio — performance styles as PURE functions (brief §4.4/§8.4).
 *
 *  Every constant is a verbatim port of mockup/piano.js, frozen by PLAN.md §5:
 *  two beats per chord (cd = 2·beat), e8 = beat/2.
 *  · Block: full voicing v.all (bass first), gate cd·.98, vel .6, roll 12 ms
 *  · Pulse ⅛: 4 eighth hits of v.all, gate e8·.55, vels .72/.42/.6/.42 (accents
 *    on beats 1 and 3 — velocity, never strobe), roll 4 ms
 *  · Arp ↑/↓: sustained bass (cd·.95, vel .5) + exactly 4 upper events over the
 *    SORTED-ascending uppers with seq[k % seq.length] wraparound (3-note voicings
 *    repeat the first note on beat 4), gate e8·1.6, vels .6/.45; ↓ = reversed
 *  · Rolled chords (the demo _chord): note i starts at off + i·roll, duration
 *    max(.1, dur − i·roll), velocity vel·(1 if i===0 else .9)
 *  · Audition: soft block at +20 ms, 1.7 s, vel .4, 15 ms roll (brief §4.3)
 */
import type { Voicing } from '../theory/voicing.ts'

export type StyleId = 'block' | 'pulse' | 'arpup' | 'arpdown'

/** UI ordering: Pulse ⅛ is the synthwave default (brief §4.4). */
export const STYLES: ReadonlyArray<{ id: StyleId; label: string }> = [
  { id: 'pulse', label: 'Pulse ⅛' },
  { id: 'block', label: 'Block' },
  { id: 'arpup', label: 'Arp ↑' },
  { id: 'arpdown', label: 'Arp ↓' },
]

/** One note event relative to its chord start (seconds). */
export interface StyleNote {
  midi: number
  off: number
  dur: number
  vel: number
}

/** The demo's _chord(): rolled chord with the velocity taper and .1 s duration floor. */
export function rolledChord(midis: readonly number[], off: number, dur: number, vel: number, roll = 0): StyleNote[] {
  return midis.map((m, i) => ({
    midi: m,
    off: off + i * roll,
    dur: Math.max(.1, dur - i * roll),
    vel: vel * (i === 0 ? 1 : .9),
  }))
}

/** All note events for one chord in the given style, offsets relative to chord start. */
export function styleEvents(style: StyleId, v: Voicing, beat: number): StyleNote[] {
  const cd = 2 * beat
  const e8 = beat / 2
  if (style === 'block') return rolledChord(v.all, 0, cd * .98, .6, .012)
  if (style === 'pulse') {
    const out: StyleNote[] = []
    for (let k = 0; k < 4; k++) {
      const vel = k === 0 ? .72 : k === 2 ? .6 : .42
      out.push(...rolledChord(v.all, k * e8, e8 * .55, vel, .004))
    }
    return out
  }
  const up = [...v.uppers].sort((a, b) => a - b)
  const seq = style === 'arpdown' ? [...up].reverse() : up
  const out: StyleNote[] = [{ midi: v.bass, off: 0, dur: cd * .95, vel: .5 }]
  for (let k = 0; k < 4; k++) {
    out.push({ midi: seq[k % seq.length]!, off: k * e8, dur: e8 * 1.6, vel: k === 0 ? .6 : .45 })
  }
  return out
}

/** Audition (brief §4.3): soft block, 15 ms roll, low velocity, +20 ms start. */
export function auditionEvents(midis: readonly number[]): StyleNote[] {
  return rolledChord(midis, .02, 1.7, .4, .015)
}

/** Engine velocity (0–1) → smplr velocity (0–127), clamped. */
export function midiVelocity(vel: number): number {
  return Math.max(0, Math.min(127, Math.round(vel * 127)))
}
