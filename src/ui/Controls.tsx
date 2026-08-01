/** The control bar (brief §4.1): KEY (root × mode), NOTATION toggle, the
 *  Adventurousness dial, TEMPO, STYLE, and the Clear / ✦ Conjure / Play⇄Stop
 *  actions. All interaction math is ported from the prototype: dial drag
 *  Δ·(dx − dy)·.55 with pointer capture, arc dasharray /141.4 of 188.5, needle
 *  −135° + 2.7°·v, arrows ±5, aria-valuetext bands at 34/67. */
import { ROOTS } from '../engine/rules.ts'
import { STYLES, type StyleId } from '../audio/styles.ts'
import type { AppState } from './state.ts'

export function Controls({ state: s }: { state: AppState }) {
  const dial = s.dial.value
  const disabled = s.uiDisabled.value
  const playing = s.playing.value
  const dialText = `${dial} of 100 — ${dial < 34 ? 'FM radio' : dial < 67 ? 'mid ether' : 'deep ether'}`
  const onDialDown = (e: PointerEvent): void => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.focus()
    try { el.setPointerCapture(e.pointerId) } catch { /* older engines */ }
    const v0 = s.dial.value, x0 = e.clientX, y0 = e.clientY
    const mv = (ev: PointerEvent): void => {
      if (ev.buttons === 0) return // belt-and-braces: never drag from a released pointer
      s.setDial(v0 + ((ev.clientX - x0) - (ev.clientY - y0)) * .55)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', mv)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up) // touch drags can cancel without a pointerup
    }
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  return (
    <section aria-label="Controls" data-wrap class="dv-controls" style={{ opacity: s.loading.value ? '.55' : '1' }}>
      <div class="dv-ctl-group">
        <span class="dv-ctl-label">KEY</span>
        <div class="dv-ctl-row">
          <select
            class="dv-select"
            value={s.root.value}
            onChange={e => s.setRoot((e.currentTarget as HTMLSelectElement).value)}
            disabled={disabled}
            aria-label="Key root"
          >
            {ROOTS.map(r => <option key={r.n} value={r.n}>{r.n}</option>)}
          </select>
          <button class={`dv-seg${s.mode.value === 'minor' ? ' is-on' : ''}`} aria-pressed={s.mode.value === 'minor'} disabled={disabled} onClick={() => s.setMode('minor')}>MINOR</button>
          <button class={`dv-seg${s.mode.value === 'major' ? ' is-on' : ''}`} aria-pressed={s.mode.value === 'major'} disabled={disabled} onClick={() => s.setMode('major')}>MAJOR</button>
        </div>
      </div>
      <span aria-hidden="true" class="dv-divider" />
      <div class="dv-ctl-group">
        <span class="dv-ctl-label">NOTATION</span>
        <div class="dv-ctl-row">
          <button class={`dv-seg${s.notation.value === 'names' ? ' is-on' : ''}`} aria-pressed={s.notation.value === 'names'} disabled={disabled} onClick={() => s.setNotation('names')}>ABC</button>
          <button class={`dv-seg${s.notation.value === 'roman' ? ' is-on' : ''}`} aria-pressed={s.notation.value === 'roman'} disabled={disabled} onClick={() => s.setNotation('roman')}>I–IV</button>
        </div>
      </div>
      <span aria-hidden="true" class="dv-divider" />
      <div class="dv-dial-group">
        <div class="dv-dial-row">
          <span aria-hidden="true" class="dv-dial-end dv-dial-fm">FM<br />RADIO</span>
          <div
            role="slider"
            tabindex={0}
            aria-label="Adventurousness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={dial}
            aria-valuetext={dialText}
            class="dv-dial"
            onPointerDown={onDialDown}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); s.setDial(s.dial.value + 5) }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); s.setDial(s.dial.value - 5) }
            }}
          >
            <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
              <defs>
                <linearGradient id="dvdial" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stop-color="#B967FF" />
                  <stop offset="1" stop-color="#FF71CE" />
                </linearGradient>
              </defs>
              <circle cx="37" cy="37" r="22" fill="rgba(16,2,40,.85)" stroke="rgba(1,205,254,.25)" stroke-width="1" />
              <circle cx="37" cy="37" r="30" fill="none" stroke="rgba(244,240,255,.12)" stroke-width="4" stroke-linecap="round" stroke-dasharray="141.4 188.5" transform="rotate(135 37 37)" />
              <circle cx="37" cy="37" r="30" fill="none" stroke="url(#dvdial)" stroke-width="4" stroke-linecap="round" stroke-dasharray={`${(141.4 * dial / 100).toFixed(1)} 188.5`} transform="rotate(135 37 37)" />
              <g transform={`rotate(${Math.round(-135 + 2.7 * dial)} 37 37)`}>
                <line x1="37" y1="20" x2="37" y2="12" stroke="#FFFB96" stroke-width="2.5" stroke-linecap="round" />
              </g>
              <text x="37" y="42" text-anchor="middle" font-family="Space Mono, monospace" font-size="14" fill="#FFFB96">{dial}</text>
            </svg>
          </div>
          <span aria-hidden="true" class="dv-dial-end dv-dial-deep">DEEP<br />ETHER</span>
        </div>
        <span class="dv-dial-caption">ADVENTUROUSNESS</span>
      </div>
      <span aria-hidden="true" class="dv-divider" />
      <div class="dv-ctl-group dv-tempo-group">
        <span class="dv-ctl-label">TEMPO</span>
        <div class="dv-ctl-row dv-tempo-row">
          <input
            type="range"
            min={60}
            max={160}
            step={1}
            value={s.bpm.value}
            onInput={e => { s.bpm.value = +(e.currentTarget as HTMLInputElement).value }}
            disabled={disabled}
            aria-label="Tempo"
            class="dv-tempo"
          />
          <span class="dv-bpm">{s.bpm.value} BPM</span>
        </div>
      </div>
      <span aria-hidden="true" class="dv-divider" />
      <div class="dv-ctl-group">
        <span class="dv-ctl-label">STYLE</span>
        <select
          class="dv-select"
          value={s.style.value}
          onChange={e => { s.style.value = (e.currentTarget as HTMLSelectElement).value as StyleId }}
          disabled={disabled}
          aria-label="Performance style"
        >
          {STYLES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
        </select>
      </div>
      <span aria-hidden="true" class="dv-spacer" />
      <div class="dv-actions">
        <button class="dv-btn-ghost" disabled={s.playDisabled.value} onClick={() => s.clear()}>CLEAR</button>
        <button class="dv-btn-conjure" disabled={disabled} onClick={() => s.conjure()}>✦ CONJURE</button>
        <button
          class={`dv-btn-play${playing ? ' is-stop' : ''}`}
          disabled={s.playDisabled.value}
          onClick={() => { if (playing) s.stop(); else s.play() }}
        >
          {playing ? '■ STOP' : '▸ PLAY'}
        </button>
      </div>
    </section>
  )
}
