/** DIVORAWAVE App shell — background scene, header (chrome wordmark, tagline,
 *  MOTION pill), the three bands (Ether / Deck / Controls), and the footer.
 *  Global listeners (Space play toggle, arrow orb-cycling, pointerdown resume)
 *  live in state.init(); reduced motion is driven by data-rm on this root
 *  (prefers-reduced-motion OR the pill — brief §5.5, motion spec RM matrix). */
import { useEffect, useMemo } from 'preact/hooks'
import { createAppState, type AppState } from './state.ts'
import { Ether } from './Ether.tsx'
import { Deck } from './Deck.tsx'
import { Controls } from './Controls.tsx'

let defaultState: AppState | null = null

export function App({ state }: { state?: AppState } = {}) {
  const s = useMemo(() => state ?? (defaultState ??= createAppState()), [state])
  useEffect(() => s.init(), [s])
  return (
    <div class="dv-root" data-rm={s.rm.value ? '1' : '0'}>
      <div class="dv-scene" aria-hidden="true">
        <div class="dv-stars" />
        <div class="dv-sunglow" />
        <div class="dv-sun">
          <div class="dv-sun-top" />
          <div class="dv-sun-bottom" />
        </div>
        <div class="dv-horizon" />
        <div class="dv-gridwrap">
          <div class="dv-gridplane">
            <div class="dv-grid" data-anim />
          </div>
          <div class="dv-gridfade" />
        </div>
        <div class="dv-haze" />
        <div class="dv-grain" />
        <div class="dv-scanline" data-anim data-rm-hide />
      </div>

      <header class="dv-header">
        <h1 class="dv-wordmark">
          <svg width="420" height="44" viewBox="0 0 560 56" role="img" aria-label="DIVORAWAVE">
            <defs>
              <linearGradient id="dvchrome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#FFFFFF" />
                <stop offset="0.34" stop-color="#FFFB96" />
                <stop offset="0.49" stop-color="#FFD1EC" />
                <stop offset="0.51" stop-color="#6E23A8" />
                <stop offset="0.72" stop-color="#B967FF" />
                <stop offset="1" stop-color="#FF71CE" />
              </linearGradient>
            </defs>
            <text
              x="280"
              y="42"
              text-anchor="middle"
              font-family="Audiowide, sans-serif"
              font-size="35"
              letter-spacing="12"
              fill="url(#dvchrome)"
              stroke="#12002E"
              stroke-width="1.2"
              paint-order="stroke"
              style="filter:drop-shadow(0 0 16px rgba(255,113,206,.5))"
            >
              DIVORAWAVE
            </text>
          </svg>
        </h1>
        <div class="dv-header-right">
          <div class="dv-tagline-block">
            <div class="dv-tagline">progressions condensed from the ether</div>
            <div aria-hidden="true" class="dv-kat-line">コード・エーテル・ウェーブ</div>
          </div>
          <button
            class="dv-pill"
            onClick={() => s.toggleRM()}
            aria-pressed={s.rm.value}
            title="Toggle reduced motion"
          >
            {s.rm.value ? 'MOTION · OFF' : 'MOTION ✦ ON'}
          </button>
        </div>
      </header>

      <Ether state={s} />
      <Deck state={s} />
      <Controls state={s} />

      <footer class="dv-footer">
        <span>{s.engineNote.value}</span>
        <span class="dv-footer-cite">
          data:{' '}
          <a href="https://huggingface.co/datasets/ailsntua/Chordonomicon" target="_blank" rel="noreferrer">
            Chordonomicon
          </a>{' '}
          (CC-BY-NC-4.0, aggregate statistics only)
        </span>
      </footer>
    </div>
  )
}
