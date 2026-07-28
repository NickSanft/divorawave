/** Phase 1 placeholder App: the background scene + wordmark, proving tokens, fonts,
 *  and the Pages deploy. The real four-band layout (Ether / Deck / Controls) lands in Phase 4. */
export function App() {
  return (
    <div class="dv-root">
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
            <div class="dv-grid" />
          </div>
          <div class="dv-gridfade" />
        </div>
        <div class="dv-haze" />
        <div class="dv-grain" />
        <div class="dv-scanline" />
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
        <p class="dv-tagline">progressions condensed from the ether</p>
      </header>

      <main class="dv-main">
        <p class="dv-shimmer">tuning the ether…</p>
      </main>
    </div>
  )
}
