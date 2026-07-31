/** THE ETHER — the upper field where suggestions condense (brief §4.1/§5.1).
 *  Heading carries the ink-halo treatment (cyan-on-sunset AA fix, from the
 *  prototype, not the tokens sheet); orbs materialize with the 400 ms pop ease
 *  staggered 60 ms by rank (CSS); loading shimmer with real sample progress;
 *  gesture toast; aria-hidden katakana texture. */
import { Orb } from './Orb.tsx'
import type { AppState } from './state.ts'

export function Ether({ state: s }: { state: AppState }) {
  const sugg = s.sugg.value
  return (
    <main class="dv-main">
      <div class="dv-ether-head-row">
        <span aria-hidden="true" class="dv-head-dot">·</span>
        <span aria-hidden="true" class="dv-head-spark">✦</span>
        <h2 class="dv-ether-head">THE ETHER</h2>
        <span aria-hidden="true" class="dv-head-spark">✦</span>
        <span aria-hidden="true" class="dv-head-dot">·</span>
      </div>
      <div class="dv-ether" role="group" aria-label="The Ether — ranked chord suggestions">
        <div aria-hidden="true" class="dv-kat-rail dv-kat-right">エーテルより</div>
        <div aria-hidden="true" class="dv-kat-rail dv-kat-left">ドリーム・コード</div>
        {s.loading.value && (
          <div class="dv-loading">
            <div class="dv-shimmer" data-anim>
              {s.loadPct.value >= 0 ? `tuning the ether… ${s.loadPct.value}%` : 'tuning the ether…'}
            </div>
          </div>
        )}
        {sugg.map((ch, i) => (
          <Orb
            key={`${ch.name}·${s.deck.value.length}·${s.root.value}${s.mode.value}`}
            ch={ch}
            i={i}
            total={sugg.length}
            state={s}
          />
        ))}
        {s.toast.value && <div role="status" class="dv-toast">{s.toast.value}</div>}
      </div>
    </main>
  )
}
