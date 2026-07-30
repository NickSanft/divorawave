/** DIVORAWAVE audio — the FX chain (brief §8.5, frozen shape per PLAN.md §5).
 *
 *  Demo topology (mockup/piano.js), ported with the frozen constants:
 *    input (master gain .9) ──► sum ──► [chorus] ──► analyser (fftSize 1024) ──► destination
 *    input ──► convolver (noise IR, 1.9 s, decay^2.6) ──► wet gain .27 ──► sum
 *
 *  The demo summed dry + wet directly at the analyser; the §7.11 chorus sits where
 *  they meet, before the analyser, so the pulse meter always sees what is audible.
 *  Chorus (brief §8.5: "subtle stereo chorus — slow LFO, shallow depth"): two short
 *  modulated delays panned L/R as a parallel wet path at a shallow mix, LFO rates
 *  ≤ .8 Hz. Bypassable (§7.11: if it muddies the piano it ships bypassed).
 */

export interface FxChain {
  /** route instrument output here (the demo's master, gain .9) */
  input: GainNode
  /** the ambience tap — viz/reactive.ts reads RMS from this */
  analyser: AnalyserNode
  setChorusBypass(bypass: boolean): void
  readonly chorusBypassed: boolean
  dispose(): void
}

/** Noise-decay impulse response — verbatim demo _ir(): stereo white noise with a
 *  power-law decay envelope, duration 1.9 s, exponent 2.6. */
export function noiseIR(ctx: BaseAudioContext, dur: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * dur)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

const CHORUS_MIX = .16

export function createFxChain(ctx: BaseAudioContext): FxChain {
  const input = ctx.createGain()
  input.gain.value = .9 // demo master gain

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024

  const conv = ctx.createConvolver()
  conv.buffer = noiseIR(ctx, 1.9, 2.6)
  const wet = ctx.createGain()
  wet.gain.value = .27 // frozen reverb send level

  const sum = ctx.createGain() // dry + wet meet here (the demo summed at the analyser)
  input.connect(sum)
  input.connect(conv)
  conv.connect(wet)
  wet.connect(sum)

  // §7.11 chorus — parallel wet path over a full-level dry path
  const chorusMix = ctx.createGain()
  chorusMix.gain.value = CHORUS_MIX
  const lfos: OscillatorNode[] = []
  for (const v of [
    { base: .014, rate: .5, depth: .002, pan: -.5 },
    { base: .017, rate: .62, depth: .0025, pan: .5 },
  ]) {
    const delay = ctx.createDelay(.05)
    delay.delayTime.value = v.base
    const lfo = ctx.createOscillator()
    lfo.frequency.value = v.rate // ≤ .8 Hz — slow LFO, shallow depth
    const depth = ctx.createGain()
    depth.gain.value = v.depth
    lfo.connect(depth)
    depth.connect(delay.delayTime)
    lfo.start()
    lfos.push(lfo)
    const pan = ctx.createStereoPanner()
    pan.pan.value = v.pan
    sum.connect(delay)
    delay.connect(pan)
    pan.connect(chorusMix)
  }
  sum.connect(analyser) // dry path
  chorusMix.connect(analyser) // chorus wet path
  analyser.connect(ctx.destination)

  let bypassed = false
  return {
    input,
    analyser,
    get chorusBypassed() { return bypassed },
    setChorusBypass(b: boolean) {
      bypassed = b
      chorusMix.gain.value = b ? 0 : CHORUS_MIX
    },
    dispose() {
      for (const lfo of lfos) { try { lfo.stop() } catch { /* already stopped */ } }
      for (const node of [input, sum, conv, wet, chorusMix, analyser]) node.disconnect()
    },
  }
}
