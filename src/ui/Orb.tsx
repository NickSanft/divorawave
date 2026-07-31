/** A suggestion orb — the signature element (brief §5.1). All rendering rules are
 *  ported from the prototype: diameter 86 + rel·86 px clamped min(px, 25vh); rank
 *  ordinal + size + glow encode rank (never color alone); ink text on the core;
 *  chromatic rim = ±1.6 px cyan/pink rings (CSS pseudo-elements); 150 ms hover AND
 *  focus audition dwell; click appends AND auditions (brief §4.3) + the append arc. */
import type { Suggestion } from '../engine/blend.ts'
import type { AppState } from './state.ts'

/** Percent x/y slots for up to 8 orbs, by rank (prototype layout table). */
const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [50, 36], [30, 30], [70, 32], [17, 56], [83, 58], [38, 70], [62, 72], [50, 14],
]

export function Orb({ ch, i, total, state: s }: { ch: Suggestion; i: number; total: number; state: AppState }) {
  const size = Math.round(86 + ch.rel * 86)
  const [x, y] = SLOTS[i] ?? [50, 50]
  const primary = s.notation.value === 'names' ? ch.name : ch.roman
  const secondary = s.notation.value === 'names' ? ch.roman : ch.name
  const nameFs = Math.round(Math.max(15, Math.min(26, size * .16)))
  const romFs = Math.round(Math.max(10, Math.min(13, size * .10)))
  const ord = String(i + 1).padStart(2, '0')
  const glow = (.35 + ch.rel * .4).toFixed(2)
  return (
    <div class="dv-orb-slot" style={{ left: `${x}%`, top: `${y}%` }}>
      <div class="dv-orb-anim" style={{ animationDelay: `${i * 60}ms` }}>
        <button
          data-orb
          class="dv-orb"
          aria-label={`${primary}, suggestion ${i + 1} of ${total}`}
          style={{ width: `min(${size}px, 25vh)`, height: `min(${size}px, 25vh)`, '--orb-glow': glow }}
          onMouseEnter={() => s.dwell.orbEnter(ch)}
          onMouseLeave={() => s.dwell.orbLeave()}
          onFocus={() => s.dwell.orbFocus(ch)}
          onBlur={() => s.dwell.orbBlur()}
          onClick={e => s.append(ch, e.currentTarget as HTMLElement)}
        >
          <span aria-hidden="true" class="dv-orb-ord">{ord}</span>
          <span class="dv-orb-name" style={{ fontSize: `${nameFs}px` }}>{primary}</span>
          <span class="dv-orb-rom" style={{ fontSize: `${romFs}px` }}>{secondary}</span>
        </button>
      </div>
    </div>
  )
}
