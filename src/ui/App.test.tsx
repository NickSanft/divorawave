// @vitest-environment jsdom
/** UI smoke suite (PLAN.md Phase 4): renders all bands; orbs appear from the real
 *  engine over a stubbed piano; click appends + deck updates; notation toggle
 *  re-labels; typed roman entry works in I–IV mode; key change re-labels; the
 *  keyboard orb-cycling path works; error + disabled states behave. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact'

// vitest runs without injected globals, so Testing Library's auto-cleanup never
// arms itself — without this, every test's App stays mounted and queries collide
afterEach(cleanup)
import { App } from './App.tsx'
import { createAppState, type PianoLike } from './state.ts'
import { createStats, type TransitionTable } from '../engine/stats.ts'
// UI flow tests run on the frozen demo fixture — deterministic regardless of
// what the Phase 5 distiller ships in public/data/
import table from '../test/demo.transitions.json'

function fakePiano(): PianoLike {
  return {
    loadState: 'ready',
    usingFallback: false,
    onLoadProgress: null,
    onStopped: null,
    analyser: null,
    init: async () => {},
    ensure: () => true,
    audition: () => true,
    play: () => true,
    stop: () => {},
  }
}

async function mount() {
  const state = createAppState({ piano: fakePiano(), stats: createStats(table as TransitionTable) })
  const utils = render(<App state={state} />)
  await waitFor(() => expect(state.ready.value).toBe(true))
  await waitFor(() => expect(utils.container.querySelectorAll('[data-orb]').length).toBe(6))
  return { state, ...utils }
}

describe('App (phase 4)', () => {
  it('renders all bands with six orbs from the live engine', async () => {
    const { getByRole, getByText, container } = await mount()
    expect(getByRole('img', { name: 'DIVORAWAVE' })).toBeTruthy()
    expect(getByRole('group', { name: /The Ether/ })).toBeTruthy()
    expect(getByText('THE ETHER')).toBeTruthy()
    expect(getByText('SIDE A')).toBeTruthy()
    expect(getByRole('slider', { name: 'Adventurousness' })).toBeTruthy()
    expect(getByText(/the deck is empty/)).toBeTruthy()
    // landing state (A minor, dial 38): rank 1 is the tonic
    const first = container.querySelector('[data-orb]')!
    expect(first.textContent).toContain('Am')
    expect(first.getAttribute('aria-label')).toBe('Am, suggestion 1 of 6')
  })

  it('clicking an orb appends the chord to the deck and re-suggests', async () => {
    const { state, container } = await mount()
    const rank1Before = state.sugg.value[0]!.roman // 'i' on the START row
    fireEvent.click(container.querySelector('[data-orb]')!)
    expect(state.deck.value.map(c => c.roman)).toEqual(['i'])
    await waitFor(() => {
      const tile = container.querySelector('.dv-tile')!
      expect(tile.textContent).toContain('Am')
    })
    expect(container.querySelectorAll('[data-orb]').length).toBe(6)
    // resuggest actually ran: rank 1 must have changed (i is filtered as a literal repeat)
    expect(state.sugg.value[0]!.roman).not.toBe(rank1Before)
    expect(state.sugg.value.some(c => c.roman === 'i')).toBe(false)
    // ✕ appears once the deck is non-empty
    expect(container.querySelector('.dv-x')).toBeTruthy()
  })

  it('notation toggle re-labels tiles and orbs (a re-render, never a conversion)', async () => {
    const { state, container, getByRole } = await mount()
    fireEvent.click(container.querySelector('[data-orb]')!)
    fireEvent.click(getByRole('button', { name: 'I–IV' }))
    await waitFor(() => {
      expect(container.querySelector('.dv-tile .dv-tile-name')!.textContent).toBe('i')
    })
    // orbs re-label too: the primary line now shows the roman
    expect(container.querySelector('[data-orb] .dv-orb-name')!.textContent).toBe(state.sugg.value[0]!.roman)
    expect(container.querySelector('[data-orb] .dv-orb-rom')!.textContent).toBe(state.sugg.value[0]!.name)
    expect(state.deck.value.length).toBe(1) // stored progression untouched
  })

  it('typed entry works in both notations, with the error path for garbage', async () => {
    const { state, container, getByRole, findByText } = await mount()
    const input = container.querySelector<HTMLInputElement>('[data-chordinput]')!
    // names mode
    fireEvent.input(input, { target: { value: 'Am' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(state.deck.value.map(c => c.roman)).toEqual(['i'])
    // roman mode
    fireEvent.click(getByRole('button', { name: 'I–IV' }))
    fireEvent.input(input, { target: { value: '♭VI' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(state.deck.value.map(c => c.roman)).toEqual(['i', '♭VI'])
    // garbage → verbatim error copy, deck untouched
    fireEvent.input(input, { target: { value: 'xyz' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await findByText('Couldn’t read that numeral — try i, ♭VI, or V7.')).toBeTruthy()
    expect(state.deck.value.length).toBe(2)
    // Backspace on empty input pops the deck
    fireEvent.input(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(state.deck.value.map(c => c.roman)).toEqual(['i'])
  })

  it('key change re-labels and preserves the stored progression (brief §4.2)', async () => {
    const { state, container, getByRole } = await mount()
    const input = container.querySelector<HTMLInputElement>('[data-chordinput]')!
    for (const sym of ['Am', 'F', 'C']) {
      fireEvent.input(input, { target: { value: sym } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    fireEvent.change(getByRole('combobox', { name: 'Key root' }), { target: { value: 'E' } })
    await waitFor(() => {
      const names = [...container.querySelectorAll('.dv-tile .dv-tile-name')].map(el => el.textContent)
      expect(names).toEqual(['Em', 'C', 'G'])
    })
    expect(state.deck.value.map(c => c.roman)).toEqual(['i', '♭VI', '♭III'])
  })

  it('arrow keys cycle orb focus in rank order with wraparound', async () => {
    const { container } = await mount()
    const orbs = [...container.querySelectorAll<HTMLElement>('[data-orb]')]
    // real keyboard events target the focused element or body — never window
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(orbs[0])
    fireEvent.keyDown(orbs[0]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(orbs[1])
    fireEvent.keyDown(orbs[1]!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(orbs[0])
    fireEvent.keyDown(orbs[0]!, { key: 'ArrowLeft' }) // wraparound
    expect(document.activeElement).toBe(orbs[5])
  })

  it('Play/Clear are disabled on an empty deck (§7.16) and Conjure fills + autoplays', async () => {
    const { state, getByRole } = await mount()
    expect((getByRole('button', { name: '▸ PLAY' }) as HTMLButtonElement).disabled).toBe(true)
    expect((getByRole('button', { name: 'CLEAR' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('button', { name: '✦ CONJURE' }))
    expect([4, 8]).toContain(state.deck.value.length)
    const last = state.deck.value[state.deck.value.length - 1]!
    expect(last.func).toBe('D') // loop-shaped
    await waitFor(() => expect(state.playing.value).toBe(true), { timeout: 1500 }) // 460ms autoplay
  })

  it('MOTION pill toggles data-rm and its label', async () => {
    const { container, getByRole } = await mount()
    const pill = getByRole('button', { name: 'MOTION ✦ ON' })
    fireEvent.click(pill)
    expect(container.querySelector('.dv-root')!.getAttribute('data-rm')).toBe('1')
    expect(getByRole('button', { name: 'MOTION · OFF' })).toBeTruthy()
  })

  it('shows the quiet degraded note when stats fail (§4.6)', async () => {
    const state = createAppState({
      piano: fakePiano(),
      stats: { status: 'rules-only', p: () => 0 },
    })
    const { findByText } = render(<App state={state} />)
    expect(await findByText(/engine: rules only/)).toBeTruthy()
  })

  it('footer names the corpus from the shipped provenance (demo vs distill)', async () => {
    const demoState = createAppState({ piano: fakePiano(), stats: createStats(table as TransitionTable) })
    const demo = render(<App state={demoState} />)
    expect(await demo.findByText(/corpus: interim demo table/)).toBeTruthy()
    demo.unmount()
    const distilled = createStats({
      ...(table as TransitionTable),
      provenance: { source: 'ailsntua/Chordonomicon', filter_tier: 1, songs_used: 865 },
    })
    const distState = createAppState({ piano: fakePiano(), stats: distilled })
    const dist = render(<App state={distState} />)
    expect(await dist.findByText(/corpus: Chordonomicon distill — tier 1, 865 songs/)).toBeTruthy()
  })

  it('audio failure keeps the engine alive: controls enabled, Play disabled, quiet note (§7.17)', async () => {
    const piano = fakePiano()
    piano.loadState = 'failed'
    const state = createAppState({ piano, stats: createStats(table as TransitionTable) })
    const { container, findByText, getByRole } = render(<App state={state} />)
    await waitFor(() => expect(state.ready.value).toBe(true))
    expect(await findByText(/piano samples unavailable — auditions muted/)).toBeTruthy()
    // engine controls stay usable…
    expect((getByRole('button', { name: '✦ CONJURE' }) as HTMLButtonElement).disabled).toBe(false)
    expect(container.querySelectorAll('[data-orb]').length).toBe(6)
    fireEvent.click(container.querySelector('[data-orb]')!)
    expect(state.deck.value.length).toBe(1)
    // …but Play is disabled and Space never raises the misleading gesture toast
    expect((getByRole('button', { name: '▸ PLAY' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(state.toast.value).toBe('')
  })
})
