/** SIDE A — the Deck: progression timeline, chord input with autocomplete chips,
 *  error line, and empty-state hint (brief §4.1/§4.2). All behavior ported from
 *  the prototype: ✕ removes the last chord (hidden when empty), tiles audition on
 *  click and on a 150 ms hover dwell, the mint playhead highlight tracks playIdx,
 *  the input parses per active notation, Backspace on an empty input pops the deck. */
import type { AppState } from './state.ts'

export function Deck({ state: s }: { state: AppState }) {
  const tiles = s.tiles.value
  const chipList = s.chipList.value
  const notation = s.notation.value
  return (
    <section aria-label="The Deck — your progression" class="dv-deck">
      <div class="dv-deck-head">
        <h2 class="dv-side-a">SIDE A</h2>
        <span aria-hidden="true" class="dv-rule" />
        {s.deck.value.length > 0 && (
          <button
            class="dv-x"
            aria-label="Remove last chord"
            title="Remove last chord"
            onClick={() => s.popDeck()}
          >
            ✕
          </button>
        )}
      </div>
      <div class="dv-tiles" data-wrap>
        {tiles.map((rc, i) => (
          <button
            key={`${i}${rc.name}`}
            class={`dv-tile${i === s.playIdx.value ? ' is-playhead' : ''}`}
            data-anim
            aria-label={`${rc.name}, chord ${i + 1} of ${tiles.length} — click to audition`}
            onClick={() => s.auditionDeck(i)}
            onMouseEnter={() => s.dwell.tileEnter(i)}
            onMouseLeave={() => s.dwell.tileLeave()}
            onFocus={() => s.dwell.tileFocus(i)}
            onBlur={() => s.dwell.tileBlur()}
          >
            <span class="dv-tile-name">{notation === 'names' ? rc.name : rc.roman}</span>
            <span class="dv-tile-rom">{notation === 'names' ? rc.roman : rc.name}</span>
          </button>
        ))}
        <div data-deck-end class="dv-endslot">
          <input
            data-chordinput
            class="dv-input"
            aria-label={`Add a chord (${notation === 'names' ? 'chord names' : 'Roman numerals'})`}
            placeholder={notation === 'names' ? 'Am, F♯m7, Csus2…' : 'i, ♭VI, V7…'}
            value={s.input.value}
            onInput={e => { s.input.value = (e.currentTarget as HTMLInputElement).value; s.err.value = '' }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); s.submitInput() }
              if (e.key === 'Backspace' && !s.input.value && s.deck.value.length) s.popDeck()
            }}
            disabled={s.uiDisabled.value}
            autocomplete="off"
            spellcheck={false}
          />
          <span aria-hidden="true" class="dv-hint">▸ awaiting next chord…</span>
        </div>
      </div>
      {chipList.length > 0 && (
        /* anchored to the deck PANEL, not the endslot: .dv-tiles scrolls
           (overflow-x:auto forces overflow-y clipping), so a popover inside it
           can never escape upward — Phase 5 review finding */
        <div class="dv-chips">
          {chipList.map(nm => (
            <button
              key={nm}
              class="dv-chip"
              onClick={() => {
                const ch = s.parse(nm)
                if (ch) { s.input.value = ''; s.append(ch, null) }
              }}
            >
              {nm}
            </button>
          ))}
        </div>
      )}
      {s.err.value && <div role="status" class="dv-err">{s.err.value}</div>}
      {!s.loading.value && s.deck.value.length === 0 && (
        <div class="dv-empty">the deck is empty — press Conjure, or type the chords you already have</div>
      )}
    </section>
  )
}
