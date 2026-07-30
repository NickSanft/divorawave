/** DEV-ONLY audio harness (PLAN.md Phase 3 exit criteria): load the piano, audition
 *  any candidate chord, and play a deck in all four styles at 60–160 BPM.
 *  Mounted only in dev builds via `?audio` (see main.tsx) — never ships.
 */
import { makeKey, candidates } from '../engine/rules.ts'
import { voice, type Voicing } from '../theory/voicing.ts'
import { parseName } from '../theory/chords.ts'
import { EtherPiano } from '../audio/player.ts'
import { STYLES, type StyleId } from '../audio/styles.ts'
import { createReactive, type Reactive } from '../viz/reactive.ts'

export function mountAudioHarness(): void {
  const key = makeKey('A', 'minor')
  const player = new EtherPiano()
  let reactive: Reactive | null = null

  const deckSymbols = ['Am', 'F', 'C', 'G']
  const deckChords = deckSymbols.map(s => parseName(s, key)!)
  const deckVoicings: Voicing[] = []
  for (const ch of deckChords) {
    const prev = deckVoicings[deckVoicings.length - 1]
    deckVoicings.push(voice(ch, prev ? prev.uppers : null))
  }

  const el = document.createElement('div')
  el.id = 'audio-harness'
  el.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99', 'width:290px',
    'background:rgba(16,2,40,.92)', 'border:1px solid rgba(1,205,254,.3)', 'border-radius:14px',
    'padding:14px', 'font:12px "Space Mono", monospace', 'color:#F4F0FF',
    'display:flex', 'flex-direction:column', 'gap:8px',
  ].join(';')

  const status = document.createElement('div')
  status.style.cssText = 'color:#05FFA1;min-height:28px;white-space:pre-wrap'
  const setStatus = (s: string): void => { status.textContent = s }
  setStatus('audio harness — press LOAD')

  const row = (): HTMLDivElement => {
    const d = document.createElement('div')
    d.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center'
    return d
  }
  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = 'background:rgba(1,205,254,.12);border:1px solid rgba(1,205,254,.4);border-radius:8px;color:#F4F0FF;font:inherit;padding:5px 9px;cursor:pointer'
    b.addEventListener('click', onClick)
    return b
  }

  const controls = row()
  controls.appendChild(button('LOAD', () => {
    player.ensure()
    player.onLoadProgress = p => setStatus(`loading samples… ${p.loaded}/${p.total}`)
    void player.init().then(() => {
      setStatus(`load: ${player.loadState}${player.usingFallback ? ' (soundfont fallback)' : ''}`)
      if (player.analyser) {
        reactive = createReactive(player.analyser)
        player.onStopped = silent => reactive?.endRun(silent)
      }
    })
  }))

  const styleSel = document.createElement('select')
  styleSel.style.cssText = 'background:#1A0538;color:#F4F0FF;border:1px solid rgba(1,205,254,.4);border-radius:8px;font:inherit;padding:4px'
  for (const s of STYLES) {
    const o = document.createElement('option')
    o.value = s.id
    o.textContent = s.label
    styleSel.appendChild(o)
  }
  const bpm = document.createElement('input')
  bpm.type = 'number'
  bpm.min = '60'
  bpm.max = '160'
  bpm.value = '104'
  bpm.style.cssText = 'width:56px;background:#1A0538;color:#F4F0FF;border:1px solid rgba(1,205,254,.4);border-radius:8px;font:inherit;padding:4px'
  controls.appendChild(styleSel)
  controls.appendChild(bpm)

  const transport = row()
  transport.appendChild(button('▸ PLAY ' + deckSymbols.join('–'), () => {
    const ok = player.play(deckVoicings, {
      bpm: Math.max(60, Math.min(160, Number(bpm.value) || 104)),
      style: styleSel.value as StyleId,
      onChord: i => setStatus(`playing ${styleSel.value} @ ${bpm.value} BPM — chord ${i + 1}/${deckVoicings.length}: ${deckSymbols[i]}`),
      onEnd: () => setStatus('run ended (onEnd)'),
    })
    if (ok) reactive?.start()
    else setStatus(player.loadState !== 'ready' ? 'not ready — LOAD first' : 'tap anywhere to tune in')
  }))
  transport.appendChild(button('■ STOP', () => { player.stop(); setStatus('stopped') }))
  transport.appendChild(button('chorus ⇄', () => {
    player.setChorusBypass(!player.chorusBypassed)
    setStatus(`chorus ${player.chorusBypassed ? 'BYPASSED' : 'on'}`)
  }))

  // global pointerdown resume — the §4.6 gesture contract ("tap anywhere to tune in");
  // Phase 4's App owns the real listener, this proves the mechanism
  window.addEventListener('pointerdown', () => { player.ensure() })

  const chords = row()
  for (const cd of candidates(key)) {
    chords.appendChild(button(cd.name, () => {
      const v = voice(cd, null)
      if (player.audition(v.all)) { reactive?.kick(2); setStatus(`audition ${cd.name} (${cd.roman}) → [${v.all.join(',')}]`) }
      else setStatus(player.loadState !== 'ready' ? 'not ready — LOAD first' : 'tap anywhere to tune in')
    }))
  }

  const pulse = document.createElement('div')
  pulse.style.cssText = 'color:rgba(1,205,254,.8)'
  window.setInterval(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--pulse').trim()
    pulse.textContent = `--pulse: ${v} · ctx: ${player.playing ? 'playing' : 'idle'}`
  }, 250)

  el.append(status, controls, transport, chords, pulse)
  document.body.appendChild(el)

  // dev-only debug handle for headless verification
  ;(window as unknown as Record<string, unknown>).__divora = {
    player,
    getReactive: () => reactive,
    deckVoicings,
  }
}
