// DIVORAWAVE — Phase A approximated piano (plain WebAudio, no deps).
// Phase B replaces the oscillator voice with smplr SplendidGrandPiano (§8.2); the chain shape
// (dry + noise-decay convolver reverb, analyser tapped at master → --pulse) carries over per §8.5.
export class EtherPiano {
  constructor() {
    this.ctx = null; this.playing = false; this.onPulse = null;
    this._raf = 0; this._kraf = 0; this._sm = 0; this._idx = -1; this._bus = null;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = .9;
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
      this.conv = c.createConvolver(); this.conv.buffer = this._ir(c, 1.9, 2.6);
      this.wet = c.createGain(); this.wet.gain.value = .27;
      this.master.connect(this.analyser);
      this.master.connect(this.conv); this.conv.connect(this.wet); this.wet.connect(this.analyser);
      this.analyser.connect(c.destination);
      this._buf = new Float32Array(this.analyser.fftSize);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx.state === 'running';
  }
  _ir(c, dur, decay) {
    const rate = c.sampleRate, len = Math.floor(rate * dur), buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  _note(out, midi, t, dur, vel) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + .006);
    g.gain.setTargetAtTime(vel * .3, t + .01, .4);
    g.gain.setTargetAtTime(0, t + dur, .07);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = Math.min(9500, f * 5 + 600); fl.Q.value = .4;
    g.connect(fl); fl.connect(out);
    const end = t + dur + .6;
    [['triangle', f, -4, 1], ['triangle', f, 4, .7], ['sine', f * 2, 0, .28], ['sine', f * 3, 0, .1]].forEach(([type, fr, det, amp]) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det;
      const og = c.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(end);
    });
  }
  _chord(out, midis, t, dur, vel, roll = 0) {
    midis.forEach((m, i) => this._note(out, m, t + i * roll, Math.max(.1, dur - i * roll), vel * (i === 0 ? 1 : .9)));
  }
  audition(midis) { // §4.3: soft block, 15 ms roll, low velocity
    if (!this.ensure()) return false;
    this._chord(this.master, midis, this.ctx.currentTime + .02, 1.7, .4, .015);
    this._kick(2);
    return true;
  }
  play(voicings, { bpm, style, onChord, onEnd }) { // §4.4/§8.4: one pass, two beats per chord
    if (!this.ensure()) return false;
    this.stop(true);
    const c = this.ctx, beat = 60 / bpm, cd = 2 * beat, e8 = beat / 2;
    const bus = c.createGain(); bus.connect(this.master);
    const t0 = c.currentTime + .12, marks = [];
    voicings.forEach((v, i) => {
      const t = t0 + i * cd; marks.push({ t, i });
      const up = [...v.uppers].sort((a, b) => a - b);
      if (style === 'block') this._chord(bus, v.all, t, cd * .98, .6, .012);
      else if (style === 'pulse') {
        for (let k = 0; k < 4; k++) { const vel = k === 0 ? .72 : k === 2 ? .6 : .42; this._chord(bus, v.all, t + k * e8, e8 * .55, vel, .004); }
      } else {
        const seq = style === 'arpdown' ? [...up].reverse() : up;
        this._note(bus, v.bass, t, cd * .95, .5);
        for (let k = 0; k < 4; k++) this._note(bus, seq[k % seq.length], t + k * e8, e8 * 1.6, k === 0 ? .6 : .45);
      }
    });
    const endT = t0 + voicings.length * cd + .35;
    this.playing = true; this._bus = bus; this._idx = -1;
    const tick = () => {
      if (!this.playing) return;
      const now = c.currentTime;
      let idx = -1;
      for (const m of marks) if (now >= m.t - .04) idx = m.i;
      if (idx >= 0 && idx !== this._idx) { this._idx = idx; onChord && onChord(idx); }
      this._pulse();
      if (now >= endT) { this.playing = false; this._idx = -1; this._pulseTo0(); onEnd && onEnd(); return; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    return true;
  }
  _kick(dur) { // short pulse loop so auditions breathe too
    if (this.playing || !this.onPulse) return;
    const c = this.ctx, end = c.currentTime + dur;
    cancelAnimationFrame(this._kraf);
    const tick = () => {
      if (this.playing) return;
      this._pulse();
      if (c.currentTime < end) this._kraf = requestAnimationFrame(tick); else this._pulseTo0();
    };
    this._kraf = requestAnimationFrame(tick);
  }
  _pulse() { // rAF-throttled RMS → onPulse (attack fast, release slow; keeps everything under 3 Hz)
    if (!this.onPulse) return;
    this.analyser.getFloatTimeDomainData(this._buf);
    let s = 0;
    for (let i = 0; i < this._buf.length; i += 4) s += this._buf[i] * this._buf[i];
    const rms = Math.sqrt(s / (this._buf.length / 4));
    const target = Math.min(1, rms * 3.2);
    this._sm += (target - this._sm) * (target > this._sm ? .3 : .07);
    this.onPulse(this._sm);
  }
  _pulseTo0() { this._sm = 0; this.onPulse && this.onPulse(0); }
  stop(silent) {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    if (this._bus) {
      const b = this._bus;
      b.gain.setTargetAtTime(0, this.ctx.currentTime, .06);
      setTimeout(() => b.disconnect(), 400);
      this._bus = null;
    }
    this._idx = -1;
    if (!silent) this._pulseTo0();
  }
}
