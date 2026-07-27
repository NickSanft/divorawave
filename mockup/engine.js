// DIVORAWAVE — Phase A demo engine (mini rules layer + hand-tuned demo stats).
// Phase B replaces STATS with the Chordonomicon distill (§7) and splits this into src/theory + src/engine.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LSEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const ROOTS = [
  { n: 'C', pc: 0 }, { n: 'C♯', pc: 1 }, { n: 'D', pc: 2 }, { n: 'E♭', pc: 3 },
  { n: 'E', pc: 4 }, { n: 'F', pc: 5 }, { n: 'F♯', pc: 6 }, { n: 'G', pc: 7 },
  { n: 'A♭', pc: 8 }, { n: 'A', pc: 9 }, { n: 'B♭', pc: 10 }, { n: 'B', pc: 11 },
];
const Q = {
  maj: { ints: [0, 4, 7], suf: '' },
  min: { ints: [0, 3, 7], suf: 'm' },
  dim: { ints: [0, 3, 6], suf: 'dim' },
  dom7: { ints: [0, 4, 7, 10], suf: '7' },
  min7: { ints: [0, 3, 7, 10], suf: 'm7' },
  maj7: { ints: [0, 4, 7, 11], suf: 'maj7' },
  halfdim: { ints: [0, 3, 6, 10], suf: 'm7♭5' },
  sus2: { ints: [0, 2, 7], suf: 'sus2' },
  sus4: { ints: [0, 5, 7], suf: 'sus4' },
  add9: { ints: [0, 4, 7, 14], suf: 'add9' },
  madd9: { ints: [0, 3, 7, 14], suf: 'm(add9)' },
};
function c(semis, quality, roman, lo, func, spice, statsId) {
  return { semis, quality, roman, lo, func, spice, statsId: statsId || roman };
}
// Candidate classes per §6.2 — mode-aware, aeolian center of gravity. func: T tonic / S subdominant / D dominant.
const MINOR = [
  c(0, 'min', 'i', 0, 'T', 0),
  c(0, 'madd9', 'i(add9)', 0, 'T', .12, 'i'),
  c(2, 'dim', 'ii°', 1, 'S', .1),
  c(2, 'halfdim', 'iiø7', 1, 'S', .18, 'ii°'),
  c(3, 'maj', '♭III', 2, 'T', 0),
  c(5, 'min', 'iv', 3, 'S', 0),
  c(5, 'sus2', 'ivsus2', 3, 'S', .12, 'iv'),
  c(7, 'min', 'v', 4, 'D', .05),
  c(8, 'maj', '♭VI', 5, 'S', 0),
  c(8, 'add9', '♭VIadd9', 5, 'S', .12, '♭VI'),
  c(10, 'maj', '♭VII', 6, 'D', 0),
  c(7, 'maj', 'V', 4, 'D', .2),
  c(7, 'dom7', 'V7', 4, 'D', .25),
  c(5, 'maj', 'IV', 3, 'S', .45),
  c(0, 'maj', 'I', 0, 'T', .5),
  c(10, 'dom7', 'V/♭III', 6, 'D', .6),
  c(3, 'dom7', 'V/♭VI', 2, 'D', .6),
  c(5, 'dom7', 'V/♭VII', 3, 'D', .62),
  c(0, 'dom7', 'V/iv', 0, 'D', .6),
  c(1, 'maj', '♭II', 1, 'S', .8),
  c(1, 'dom7', '♭II7', 1, 'D', .9),
];
const MAJOR = [
  c(0, 'maj', 'I', 0, 'T', 0),
  c(0, 'add9', 'Iadd9', 0, 'T', .12, 'I'),
  c(2, 'min', 'ii', 1, 'S', 0),
  c(2, 'min7', 'ii7', 1, 'S', .1, 'ii'),
  c(4, 'min', 'iii', 2, 'T', .12),
  c(5, 'maj', 'IV', 3, 'S', 0),
  c(5, 'add9', 'IVadd9', 3, 'S', .12, 'IV'),
  c(7, 'maj', 'V', 4, 'D', 0),
  c(7, 'dom7', 'V7', 4, 'D', .1, 'V'),
  c(9, 'min', 'vi', 5, 'T', 0),
  c(11, 'dim', 'vii°', 6, 'D', .2),
  c(5, 'min', 'iv', 3, 'S', .45),
  c(8, 'maj', '♭VI', 5, 'S', .5),
  c(10, 'maj', '♭VII', 6, 'D', .4),
  c(9, 'dom7', 'V/ii', 5, 'D', .6),
  c(0, 'dom7', 'V/IV', 0, 'D', .55),
  c(2, 'dom7', 'V/V', 1, 'D', .6),
  c(4, 'dom7', 'V/vi', 2, 'D', .6),
  c(1, 'dom7', '♭II7', 1, 'D', .9),
];
// Demo order-1 transition table — hand-tuned synthwave consensus. Phase B swaps in the trained JSON.
const STATS = {
  minor: {
    START: { i: .34, '♭VI': .18, iv: .14, '♭VII': .10, '♭III': .08, v: .06, 'ii°': .02, V: .03 },
    i: { '♭VI': .24, '♭VII': .17, iv: .15, v: .09, '♭III': .09, V: .06, 'ii°': .03, IV: .02 },
    'ii°': { V: .26, v: .18, i: .16, '♭III': .08, '♭VI': .08 },
    '♭III': { '♭VII': .22, '♭VI': .20, iv: .14, i: .13, v: .06, V: .04 },
    iv: { i: .22, '♭VI': .17, '♭VII': .14, v: .12, V: .08, '♭III': .08 },
    v: { i: .30, '♭VI': .18, '♭VII': .12, iv: .10, '♭III': .06 },
    V: { i: .52, '♭VI': .11, iv: .06, '♭III': .04 },
    '♭VI': { '♭VII': .26, i: .18, iv: .12, '♭III': .12, V: .08, v: .06 },
    '♭VII': { i: .35, '♭VI': .16, iv: .10, '♭III': .10, v: .06, V: .05 },
    IV: { i: .2, '♭VI': .15, '♭VII': .12, v: .1 },
    I: { iv: .2, '♭VI': .2, '♭VII': .15 },
    '♭II': { i: .28, V: .22, v: .1 },
    '♭II7': { i: .5, '♭III': .06 },
    'V/♭III': { '♭III': .6 }, 'V/♭VI': { '♭VI': .6 }, 'V/♭VII': { '♭VII': .6 }, 'V/iv': { iv: .6 },
  },
  major: {
    START: { I: .3, vi: .16, IV: .14, V: .1, ii: .08, '♭VII': .03, iii: .03 },
    I: { IV: .2, V: .18, vi: .16, ii: .09, iii: .05, '♭VII': .04, iv: .02 },
    ii: { V: .3, IV: .12, I: .12, 'vii°': .05, vi: .08 },
    iii: { vi: .22, IV: .2, ii: .1 },
    IV: { I: .22, V: .2, vi: .1, ii: .08, iv: .05, '♭VII': .04 },
    V: { I: .4, vi: .18, IV: .08, ii: .04 },
    vi: { IV: .22, V: .14, ii: .12, I: .12, iii: .06 },
    'vii°': { I: .4, iii: .1 },
    iv: { I: .3, V: .12 },
    '♭VI': { '♭VII': .3, I: .2 },
    '♭VII': { I: .4, '♭VI': .12, IV: .1 },
    'V/ii': { ii: .6 }, 'V/IV': { IV: .6 }, 'V/V': { V: .6 }, 'V/vi': { vi: .6 },
    '♭II7': { I: .5 },
  },
};

export function makeKey(rootName, mode) {
  const r = ROOTS.find(x => x.n === rootName) || ROOTS[9];
  return { root: r.n, pc: r.pc, mode };
}
function spell(key, semis, lo) {
  const ti = LETTERS.indexOf(key.root[0]);
  const letter = LETTERS[(ti + lo) % 7];
  const target = (key.pc + semis) % 12;
  const acc = ((target - LSEMI[letter]) % 12 + 18) % 12 - 6;
  if (Math.abs(acc) > 1) { const alt = ROOTS.find(x => x.pc === target); return alt.n; }
  return letter + (acc === 1 ? '♯' : acc === -1 ? '♭' : '');
}
export function chordFrom(cls, key) {
  const q = Q[cls.quality];
  return { ...cls, ints: q.ints, name: spell(key, cls.semis, cls.lo) + q.suf, rootPc: (key.pc + cls.semis) % 12 };
}
export function candidates(key) {
  return (key.mode === 'minor' ? MINOR : MAJOR).map(cl => chordFrom(cl, key));
}

// Voice-leading-aware voicing (§8.3): bass root in octave 2, 3-4 uppers ~C3-C5, minimize semitone motion.
export function voice(ch, prevUppers) {
  const bass = 36 + ch.rootPc;
  const pcs = [...new Set(ch.ints.map(i => (ch.rootPc + i) % 12))];
  const upperPcs = pcs.length > 3 ? pcs.slice(1) : pcs;
  const n = upperPcs.length;
  const opts = [];
  for (let r = 0; r < n; r++) {
    const rot = upperPcs.slice(r).concat(upperPcs.slice(0, r));
    for (let base = 48; base <= 62; base++) {
      if (base % 12 !== rot[0]) continue;
      const notes = [base];
      for (let k = 1; k < n; k++) { let m = notes[k - 1] + 1; while (m % 12 !== rot[k]) m++; notes.push(m); }
      if (notes[notes.length - 1] > 76) continue;
      opts.push(notes);
    }
  }
  let best = opts[0], bd = 1e9;
  for (const o of opts) {
    let d;
    if (prevUppers && prevUppers.length) {
      const a = [...o].sort((x, y) => x - y), b = [...prevUppers].sort((x, y) => x - y);
      const len = Math.max(a.length, b.length); d = 0;
      for (let i = 0; i < len; i++) d += Math.abs(a[Math.min(i, a.length - 1)] - b[Math.min(i, b.length - 1)]);
    } else {
      const mean = o.reduce((x, y) => x + y, 0) / o.length;
      d = Math.abs(mean - 59) * 1.5 + (o[0] < 50 ? 2 : 0);
    }
    if (d < bd) { bd = d; best = o; }
  }
  return { bass, uppers: best, all: [bass, ...best], dist: bd };
}

// §6.4 blend: score = (1-a)·P̂stats + a·spice·novelty, VL smoothness as tiebreaker.
export function suggest(deck, key, dial, count = 6, prevUppers = null) {
  const a = dial / 100;
  const cands = candidates(key);
  const T = STATS[key.mode];
  const last = deck[deck.length - 1];
  const prev2 = deck[deck.length - 2];
  const row = (last ? T[last.statsId] : T.START) || {};
  const list = cands.filter(ch => !(last && ch.semis === last.semis && ch.quality === last.quality));
  const sameFunc = last && prev2 && last.func === prev2.func ? last.func : null;
  const raw = list.map(ch => {
    let p = (row[ch.statsId] || 0) + .004;
    if (sameFunc && ch.func === sameFunc) p *= .25;
    return p;
  });
  const sum = raw.reduce((x, y) => x + y, 0);
  const scored = list.map((ch, i) => {
    const Pn = raw[i] / sum;
    const novelty = .35 + .65 * Math.max(0, 1 - Pn * 5);
    const aa = Math.pow(a, 1.8); // curved: spice ENTERS the top-6 near DEEP ETHER, doesn't own the default
    let s = (1 - aa) * Pn + aa * (.12 + .88 * ch.spice) * novelty * .2; // spice term scaled to stats magnitude
    if (ch.statsId !== ch.roman) s *= .72; // colour variants sit below their parent
    if (prevUppers) { const d = voice(ch, prevUppers).dist; s += .006 * (1 - Math.min(d, 24) / 24); }
    return { ch, s };
  }).sort((x, y) => y.s - x.s);
  const seen = new Set(), seenStats = new Set(), top = [];
  for (const it of scored) {
    if (seen.has(it.ch.name) || seenStats.has(it.ch.statsId)) continue; // one variant per parent
    seen.add(it.ch.name); seenStats.add(it.ch.statsId); top.push(it);
    if (top.length >= count) break;
  }
  const smax = top[0].s;
  return top.map((t, i) => {
    const rel = Math.pow(t.s / smax, 1.15);
    return { ...t.ch, rel, score: t.s, rank: i + 1 };
  });
}

// §6.5 Conjure: temperature sampling over the blend, loop-shaped ending (function pulls back to i).
export function conjure(key, dial, rng = Math.random) {
  const len = rng() < .7 ? 4 : 8;
  const deck = [];
  for (let i = 0; i < len; i++) {
    let pool = suggest(deck, key, dial, 12);
    const l = deck[i - 1], p2 = deck[i - 2];
    if (i === len - 1) {
      // loop-shape rule outranks the function-repetition constraint: filter the ORIGINAL pool
      const home = pool.filter(cd => cd.func === 'D' && !cd.roman.includes('/'));
      if (home.length) pool = home;
    } else if (l && p2 && l.func === p2.func) {
      const f = pool.filter(cd => cd.func !== l.func);
      if (f.length) pool = f;
    }
    const tau = .65 + .5 * (dial / 100);
    const ws = pool.map(cd => Math.pow(Math.max(cd.score, 1e-4), 1 / tau));
    let r = rng() * ws.reduce((x, y) => x + y, 0);
    let pick = pool[0];
    for (let k = 0; k < pool.length; k++) { r -= ws[k]; if (r <= 0) { pick = pool[k]; break; } }
    deck.push(pick);
  }
  return deck;
}

// Chord-name parsing (names mode). Phase B: tonal.js.
const SUFQ = [
  ['m7♭5', 'halfdim'], ['m7b5', 'halfdim'], ['ø7', 'halfdim'], ['m(add9)', 'madd9'], ['madd9', 'madd9'],
  ['maj7', 'maj7'], ['add9', 'add9'], ['sus2', 'sus2'], ['sus4', 'sus4'],
  ['dim7', 'dim'], ['dim', 'dim'], ['°', 'dim'], ['o', 'dim'],
  ['min7', 'min7'], ['m7', 'min7'], ['min', 'min'], ['maj', 'maj'],
  ['7', 'dom7'], ['m', 'min'], ['M', 'maj'], ['', 'maj'],
];
export function parseName(str, key) {
  const m = /^\s*([A-Ga-g])([#♯b♭]?)(.*?)\s*$/.exec(str);
  if (!m) return null;
  let pc = LSEMI[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') pc++;
  if (m[2] === 'b' || m[2] === '♭') pc--;
  pc = (pc + 12) % 12;
  const suf = m[3].trim();
  const e = SUFQ.find(([s]) => s.toLowerCase() === suf.toLowerCase());
  if (!e) return null;
  return classify((pc - key.pc + 12) % 12, e[1], key);
}
function classify(semis, quality, key) {
  const hit = candidates(key).find(cd => cd.semis === semis && cd.quality === quality);
  if (hit) return { ...hit };
  const M = { 0: ['I', 0], 1: ['♭II', 1], 2: ['II', 1], 3: ['♭III', 2], 4: ['III', 2], 5: ['IV', 3], 6: ['♭V', 4], 7: ['V', 4], 8: ['♭VI', 5], 9: ['VI', 5], 10: ['♭VII', 6], 11: ['VII', 6] };
  const [lab, lo] = M[semis];
  const minorish = ['min', 'min7', 'dim', 'halfdim', 'madd9'].includes(quality);
  let roman = minorish ? lab.replace(/[IV]+/, s => s.toLowerCase()) : lab;
  if (quality === 'dim') roman += '°';
  if (quality === 'halfdim') roman += 'ø7';
  if (quality === 'dom7' || quality === 'min7') roman += '7';
  if (quality === 'maj7') roman += 'maj7';
  if (['sus2', 'sus4', 'add9', 'madd9'].includes(quality)) roman += Q[quality].suf.replace('m(', '(');
  const func = [0, 3, 4, 9].includes(semis) ? 'T' : [7, 10, 11].includes(semis) ? 'D' : 'S';
  return chordFrom({ semis, quality, roman, lo, func, spice: .5, statsId: roman }, key);
}
export function parseRoman(str, key) {
  const s = str.trim().replace(/b(?=[IViv])/g, '♭');
  const direct = candidates(key).find(cd => cd.roman.toLowerCase() === s.toLowerCase());
  if (direct) return { ...direct };
  const m = /^(♭?)([ivIV]+)(°|ø|o)?(maj7|7|sus2|sus4|add9)?$/.exec(s);
  if (!m) return null;
  const NUM = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
  const base = NUM[m[2].toLowerCase()];
  if (base === undefined) return null;
  const semis = (base + (m[1] ? -1 : 0) + 12) % 12;
  const lower = m[2] === m[2].toLowerCase();
  let quality = lower ? 'min' : 'maj';
  if (m[3]) quality = 'dim';
  if (m[4] === '7') quality = m[3] ? 'halfdim' : lower ? 'min7' : 'dom7';
  if (m[4] === 'maj7') quality = 'maj7';
  if (m[4] === 'sus2') quality = 'sus2';
  if (m[4] === 'sus4') quality = 'sus4';
  if (m[4] === 'add9') quality = lower ? 'madd9' : 'add9';
  return classify(semis, quality, key);
}
export function chips(key, notation, input) {
  const cands = candidates(key);
  const pool = [...new Map(cands.map(cd => [notation === 'names' ? cd.name : cd.roman, cd])).keys()];
  const q = input.trim().toLowerCase().replace(/#/g, '♯');
  const list = q ? pool.filter(nm => nm.toLowerCase().startsWith(q) || nm.toLowerCase().startsWith(q.replace(/♯/g, '#'))) : pool.slice(0, 8);
  return list.slice(0, 8);
}
