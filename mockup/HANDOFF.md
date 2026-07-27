# DIVORAWAVE — Phase A → Phase B handoff

Phase A deliverables (this project) per brief §5.9. On Nick's approval, tokens + mockups bind Phase B.

## Files
- `Divorawave Prototype.dc.html` — live hi-fi prototype, all four states reachable in use:
  empty/first-run (reload), suggesting (default), playing (Conjure/Play), reduced-motion (MOTION pill, also honors `prefers-reduced-motion`)
- `Divorawave Tokens.dc.html` — token sheet; the `:root` block is the binding export (copy verbatim)
- `Divorawave Motion Spec.dc.html` — 8 motions, easings, stagger, ambience mapping, RM matrix, 3 Hz floor
- `Divorawave Style Tile.dc.html` — concept, palette, type roles, materials, copy voice
- `engine.js` / `piano.js` — prototype logic (see "demo vs real" below)

## Prototype → §9 module map
- `engine.js` candidates/STATS/suggest/conjure → `src/engine/rules.ts`, `stats.ts`, `blend.ts`, `conjure.ts`
- `engine.js` spell/chordFrom/parseName/parseRoman → `src/theory/chords.ts`, `roman.ts` (replace hand parser with tonal.js)
- `engine.js` voice() → `src/theory/voicing.ts` (greedy min-semitone-motion; also the blend tiebreaker)
- `piano.js` → `src/audio/*` (swap oscillator voice for smplr SplendidGrandPiano; keep chain shape:
  dry + noise-decay ConvolverNode wet ≈ .27, analyser at master; add lookahead scheduler per §8.1 —
  prototype schedules all-at-once, fine for ≤8 chords, not for Phase B)
- `piano.js onPulse` → `src/viz/reactive.ts` (`--pulse`, attack ~60ms / release ~300ms, 0 under RM)
- Prototype DC template → `src/ui/App/Ether/Orb/Deck/Controls.tsx` (all styles literal; tokens in sheet)

## Demo vs real (do not ship as-is)
- STATS table is hand-tuned demo consensus, order-1 only → replace with Chordonomicon distill (§7),
  order-2 with backoff. statsId keys already match roman-degree convention.
- Blend calibration (validated in review, keep the shape): `aa = a^1.8`;
  `score = (1-aa)·P̂ + aa·(.12+.88·spice)·novelty·0.2`; `novelty = .35+.65·max(0, 1−P̂·5)`;
  one coloring variant per parent statsId in the top-6; VL smoothness tiebreak +.006·(1−d/24).
  Acceptance targets: dial ≤40 diatonic, ~50 first spicy entrant (♭II7), 60 mixed, ≥90 full deep-ether.
- Conjure: final-chord home filter (`func === 'D'`, no secondary dominants) applies to the UNfiltered
  pool and outranks the ≤2-same-function constraint — this ordering was a review fix, keep it.
- Piano is an oscillator approximation; audition = 15ms roll, vel ~.4; Pulse ⅛ gate .55, accents k=0/2.

## UI details worth keeping exactly
- Orb: diameter 86–172px ∝ rel score (clamped `min(px, 25vh)`), rank ordinal + size + glow encode rank
  (never color alone); ink text on cores; chromatic rim = ±1.6px cyan/pink rings.
- "THE ETHER" heading carries an ink halo (cyan-on-sunset fails AA — see Tokens page).
- Hover/focus audition dwell 150ms; Backspace in empty input removes last chord; Space toggles Play;
  arrows cycle orbs in rank order; Enter appends.
- First-run: "tuning the ether…" shimmer while samples load; "tap anywhere to tune in" toast if
  playback is attempted before the AudioContext gesture; stats-load failure degrades to rules-only
  with a quiet footer note (§4.6).

## Acceptance
Brief §10 script, plus the dial calibration + loop-shape targets above (both verified in review).
