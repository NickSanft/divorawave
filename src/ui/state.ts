/** DIVORAWAVE UI state — @preact/signals port of the prototype's component state
 *  machine (mockup/Divorawave Prototype.dc.html, DCLogic class). Every action,
 *  guard, timing constant, and string is ported from the prototype; the module
 *  boundaries changed (engine/audio/viz are the Phase 2–3 modules), the behavior
 *  did not. Injectable deps keep the whole state machine testable in jsdom.
 */
import { computed, signal } from '@preact/signals'
import { makeKey } from '../engine/rules.ts'
import { suggest, type Suggestion } from '../engine/blend.ts'
import { conjure } from '../engine/conjure.ts'
import { chips as chipsFn, type Notation } from '../engine/chips.ts'
import { chordFrom, parseName, type Chord, type Key, type Mode } from '../theory/chords.ts'
import { parseRoman } from '../theory/roman.ts'
import { voice, type Voicing } from '../theory/voicing.ts'
import { loadStats, rulesOnlyStats, type Stats, type StatsStatus } from '../engine/stats.ts'
import { EtherPiano } from '../audio/player.ts'
import { createReactive, type Reactive } from '../viz/reactive.ts'
import type { StyleId } from '../audio/styles.ts'

/** The player surface the UI consumes — EtherPiano satisfies it; tests stub it. */
export interface PianoLike {
  loadState: 'idle' | 'loading' | 'ready' | 'failed'
  usingFallback: boolean
  onLoadProgress: ((p: { loaded: number; total: number }) => void) | null
  onStopped: ((silent: boolean) => void) | null
  readonly analyser: AnalyserNode | null
  init(): Promise<void>
  ensure(): boolean
  audition(midis: readonly number[]): boolean
  play(voicings: readonly Voicing[], opts: { bpm: number; style: StyleId; onChord?: (i: number) => void; onEnd?: () => void }): boolean
  stop(silent?: boolean): void
}

export interface AppDeps {
  piano?: PianoLike
  /** preloaded stats (tests) — skips the fetch */
  stats?: Stats
  statsUrl?: string
}

export const ORB_COUNT = 6
const DIAL_DEBOUNCE_MS = 140
const CONJURE_AUTOPLAY_MS = 460

export type AppState = ReturnType<typeof createAppState>

export function createAppState(deps: AppDeps = {}) {
  const piano: PianoLike = deps.piano ?? new EtherPiano()
  const statsUrl = deps.statsUrl ?? `${import.meta.env.BASE_URL}data/synthwave.transitions.json`

  // --- signals (the prototype's this.state, one-to-one) ---
  const loading = signal(true)
  const ready = signal(false)
  const rm = signal(false)
  const deck = signal<Chord[]>([])
  const sugg = signal<Suggestion[]>([])
  const root = signal('A')
  const mode = signal<Mode>('minor')
  const notation = signal<Notation>('names')
  const dial = signal(38)
  const bpm = signal(104)
  const style = signal<StyleId>('pulse')
  const playing = signal(false)
  const playIdx = signal(-1)
  const input = signal('')
  const err = signal('')
  const toast = signal('')
  const statsStatus = signal<StatsStatus>('ready')
  /** §7.17: 'ok' | 'fallback' (Soundfont piano) | 'failed' (no audio — engine stays alive) */
  const audioStatus = signal<'ok' | 'fallback' | 'failed'>('ok')
  const loadPct = signal(-1) // -1 = unknown; otherwise 0..100 for the shimmer

  // --- non-reactive internals ---
  let stats: Stats | null = null
  let reactive: Reactive | null = null
  let hT: number | undefined // orb hover dwell (shared single timer — prototype _hT)
  let fT: number | undefined // orb focus dwell (prototype _fT)
  let hT2: number | undefined // deck tile dwell (prototype _hT2)
  let dT: number | undefined // dial debounce (prototype _dT)
  let disposed = false

  const key = (): Key => makeKey(root.value, mode.value)

  // --- derived ---
  const tiles = computed(() => deck.value.map(ch => chordFrom(ch, makeKey(root.value, mode.value))))
  const chipList = computed(() =>
    input.value.trim() ? chipsFn(makeKey(root.value, mode.value), notation.value, input.value) : [],
  )
  const uiDisabled = computed(() => loading.value || !ready.value)
  const playDisabled = computed(
    () => loading.value || !ready.value || deck.value.length === 0 || audioStatus.value === 'failed',
  )
  const engineNote = computed(() => {
    const statsPart = statsStatus.value === 'rules-only'
      ? 'engine: rules only — the corpus table failed to load'
      : 'engine: rules × corpus blend · corpus: interim demo table — Phase 5 distills Chordonomicon'
    const audioPart = audioStatus.value === 'fallback'
      ? ' · piano: fallback soundfont'
      : audioStatus.value === 'failed'
        ? ' · piano samples unavailable — auditions muted'
        : ''
    return statsPart + audioPart
  })

  // --- core operations (prototype method ports) ---

  /** greedy re-voicing of the whole deck (prototype _chain) */
  const chain = (): Voicing[] => {
    const k = key()
    let prev: number[] | null = null
    return deck.value.map(ch => {
      const v = voice(chordFrom(ch, k), prev)
      prev = v.uppers
      return v
    })
  }

  const resuggest = (): void => {
    if (!stats) return
    const c = chain()
    const prevUppers = c.length ? c[c.length - 1]!.uppers : null
    sugg.value = suggest(stats, deck.value, key(), dial.value, ORB_COUNT, prevUppers)
  }

  const warm = (): void => { toast.value = 'tap anywhere to tune in' }

  const audition = (ch: Chord): void => {
    if (!ready.value || audioStatus.value === 'failed') return // §7.17: silent, never a blocking error
    const c = chain()
    const prev = c.length ? c[c.length - 1]!.uppers : null
    const v = voice(chordFrom(ch, key()), prev)
    if (piano.audition(v.all)) reactive?.kick(2)
    else warm()
  }

  const auditionDeck = (i: number): void => {
    if (!ready.value || audioStatus.value === 'failed') return
    const v = chain()[i]
    if (!v) return
    if (piano.audition(v.all)) reactive?.kick(2)
    else warm()
  }

  const stop = (): void => {
    piano.stop()
    playing.value = false
    playIdx.value = -1
  }

  const play = (): void => {
    // §7.17: with audio failed, a false piano.play would raise the WRONG toast —
    // the gesture message. Bail before it; the footer note explains the silence.
    if (!deck.value.length || audioStatus.value === 'failed') return
    const ok = piano.play(chain(), {
      bpm: bpm.value,
      style: style.value,
      onChord: i => { playIdx.value = i },
      onEnd: () => { playing.value = false; playIdx.value = -1 },
    })
    if (!ok) { warm(); return }
    reactive?.start()
    playing.value = true
    playIdx.value = -1
  }

  const append = (ch: Chord, el?: HTMLElement | null): void => {
    if (playing.value) stop()
    if (!rm.value && el) arcFx(el)
    audition(ch)
    deck.value = [...deck.value, ch]
    err.value = ''
    resuggest()
  }

  const doConjure = (): void => {
    if (!stats) return
    if (playing.value) stop()
    deck.value = conjure(stats, key(), dial.value)
    err.value = ''
    resuggest()
    window.setTimeout(() => { if (!disposed) play() }, CONJURE_AUTOPLAY_MS)
  }

  const setDial = (v: number): void => {
    const clamped = Math.round(Math.max(0, Math.min(100, v)))
    if (clamped === dial.value) return
    dial.value = clamped
    window.clearTimeout(dT)
    dT = window.setTimeout(() => resuggest(), DIAL_DEBOUNCE_MS)
  }

  const parse = (txt: string): Chord | null =>
    notation.value === 'names' ? parseName(txt, key()) : parseRoman(txt, key())

  const submitInput = (): void => {
    const txt = input.value.trim()
    if (!txt || !stats) return
    const ch = parse(txt)
    if (!ch) {
      err.value = notation.value === 'names'
        ? 'Couldn’t read that chord — try Am, F♯m7, or Csus2.'
        : 'Couldn’t read that numeral — try i, ♭VI, or V7.'
      const el = document.querySelector<HTMLElement>('[data-chordinput]')
      if (el && !rm.value && typeof el.animate === 'function') {
        el.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
          { duration: 280 },
        )
      }
      return
    }
    input.value = ''
    append(ch, null)
  }

  const popDeck = (): void => {
    if (!deck.value.length) return
    deck.value = deck.value.slice(0, -1)
    resuggest()
  }

  const clear = (): void => {
    stop()
    deck.value = []
    err.value = ''
    resuggest()
  }

  const toggleRM = (): void => {
    rm.value = !rm.value
    reactive?.setReducedMotion(rm.value)
    document.documentElement.style.setProperty('--pulse', '0')
  }

  /** append-arc comet (prototype _arcFx): 44 px clone, 480 ms arc ease, apex 46 px
   *  above the midpoint, scale 1→.35 — skipped under RM (caller guards). */
  const arcFx = (orbEl: HTMLElement): void => {
    const slot = document.querySelector('[data-deck-end]')
    if (!slot || !orbEl.getBoundingClientRect) return
    const a = orbEl.getBoundingClientRect(), b = slot.getBoundingClientRect(), size = 44
    const d = document.createElement('div')
    d.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;z-index:99;background:radial-gradient(circle at 35% 30%, #FFFB96, #FF71CE 55%, rgba(185,103,255,.4) 80%, transparent);box-shadow:0 0 24px rgba(255,113,206,.7)`
    document.body.appendChild(d)
    if (typeof d.animate !== 'function') { d.remove(); return } // jsdom / ancient engines
    const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2
    const x1 = b.left + b.width / 2 - size / 2, y1 = b.top + b.height / 2 - size / 2
    const xm = (x0 + x1) / 2, ym = Math.min(y0, y1) - 46
    d.animate([
      { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${xm}px,${ym}px) scale(.75)`, opacity: .95, offset: .45 },
      { transform: `translate(${x1}px,${y1}px) scale(.35)`, opacity: .25 },
    ], { duration: 480, easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = () => d.remove()
  }

  // --- shared dwell timers (prototype _hT/_fT/_hT2 — deliberately singletons) ---
  const dwell = {
    orbEnter: (ch: Chord) => { window.clearTimeout(hT); hT = window.setTimeout(() => audition(ch), 150) },
    orbLeave: () => window.clearTimeout(hT),
    orbFocus: (ch: Chord) => { window.clearTimeout(fT); fT = window.setTimeout(() => audition(ch), 150) },
    orbBlur: () => window.clearTimeout(fT),
    tileEnter: (i: number) => { window.clearTimeout(hT2); hT2 = window.setTimeout(() => auditionDeck(i), 150) },
    tileLeave: () => window.clearTimeout(hT2),
    // brief §4.3 + motion-spec footnote: keyboard focus dwells on deck tiles too
    // (the prototype omitted this; the docs win)
    tileFocus: (i: number) => { window.clearTimeout(hT2); hT2 = window.setTimeout(() => auditionDeck(i), 150) },
    tileBlur: () => window.clearTimeout(hT2),
  }

  // --- global listeners (prototype componentDidMount) ---
  const onPointerDown = (): void => {
    piano.ensure()
    if (toast.value) toast.value = ''
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target instanceof HTMLElement ? e.target : null
    const tag = target?.tagName ?? ''
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag)) {
      e.preventDefault()
      if (playing.value) stop()
      else play()
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
      const orbs = [...document.querySelectorAll<HTMLElement>('[data-orb]')]
      if (!orbs.length) return
      const i = orbs.indexOf(document.activeElement as HTMLElement)
      if (i === -1 && e.target !== document.body && !target?.hasAttribute('data-orb')) return
      e.preventDefault()
      orbs[(i === -1 ? 0 : i + (e.key === 'ArrowRight' ? 1 : -1) + orbs.length) % orbs.length]!.focus()
    }
  }

  /** Mount: RM detection (live — the OS setting is honored mid-session too), pulse
   *  seed, sample + stats load, listeners. Returns dispose; init/dispose pairs
   *  balance, so a remount of the same state machine works. */
  const init = (): (() => void) => {
    disposed = false
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    if (mq?.matches) rm.value = true
    const onMqChange = (e: MediaQueryListEvent): void => {
      rm.value = e.matches
      reactive?.setReducedMotion(e.matches)
      document.documentElement.style.setProperty('--pulse', '0')
    }
    mq?.addEventListener?.('change', onMqChange)
    document.documentElement.style.setProperty('--pulse', '0')
    piano.onLoadProgress = p => { loadPct.value = p.total > 0 ? Math.round((p.loaded / p.total) * 100) : -1 }
    piano.onStopped = silent => reactive?.endRun(silent)
    const statsPromise = deps.stats ? Promise.resolve(deps.stats) : loadStats(statsUrl)
    void Promise.all([statsPromise, piano.init()])
      .then(([st]) => {
        if (disposed) return
        stats = st
        statsStatus.value = st.status
        audioStatus.value = piano.loadState === 'ready' ? (piano.usingFallback ? 'fallback' : 'ok') : 'failed'
        if (piano.analyser) {
          reactive = createReactive(piano.analyser)
          reactive.setReducedMotion(rm.value)
        }
        loading.value = false
        ready.value = true // §7.17: the engine always works once the load settles
        resuggest()
      })
      .catch(() => {
        // prototype parity: a failed bootstrap still reveals the page, degraded (§4.6)
        if (disposed) return
        if (!stats) { stats = rulesOnlyStats; statsStatus.value = 'rules-only' }
        audioStatus.value = 'failed'
        loading.value = false
        ready.value = true
        resuggest()
      })
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      disposed = true
      mq?.removeEventListener?.('change', onMqChange)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(hT); window.clearTimeout(fT); window.clearTimeout(hT2); window.clearTimeout(dT)
      piano.stop()
      reactive?.dispose()
    }
  }

  return {
    // signals
    loading, ready, rm, deck, sugg, root, mode, notation, dial, bpm, style,
    playing, playIdx, input, err, toast, statsStatus, audioStatus, loadPct,
    // derived
    tiles, chipList, uiDisabled, playDisabled, engineNote,
    // actions
    init, resuggest, audition, auditionDeck, append, popDeck, clear, stop, play,
    conjure: doConjure, setDial, submitInput, parse, toggleRM, dwell,
    // key helpers for components
    setRoot: (v: string) => { root.value = v; resuggest() },
    setMode: (m: Mode) => { mode.value = m; resuggest() },
    setNotation: (n: Notation) => { notation.value = n },
  }
}
