# D I V O R A W A V E — Design & Build Brief

**Name:** DIVORAWAVE — always displayed letterspaced: D I V O R A W A V E (repo/package: `divorawave`)
**Owner:** Nick · **Date:** 2026-07-26 · **Status:** v2 — all §12 questions resolved; cleared for Phase A
**Consumers:** Claude Design executes Phase A from §1–§5 (plus §12). Claude Code executes Phase B from the full document; Phase A's approved tokens and mockups become the visual source of truth.

---

## 1. What this is

A static single-page web app that helps songwriters conjure chord progressions. The user either picks a vibe and presses **Conjure** to receive a full synthwave progression, or types the chords they already have and watches ranked next-chord suggestions condense out of a vaporwave dreamscape — each one instantly audible on a real piano soundfont. A hybrid recommendation engine (music-theory rules for candidates, real-song statistics for ranking) powers both, with an **Adventurousness** dial that slides suggestions from radio-safe toward the deep ether. Pure HTML/CSS/JS after a Vite build; deploys to GitHub Pages; no backend, no accounts, no API keys.

The product is deliberately coherent: vaporwave visuals, synthwave harmony. The site sounds like it looks.

## 2. Goals and non-goals

**POC goals.** (G1) One-click generation of a loop-shaped 4- or 8-chord synthwave progression. (G2) "Continue my chords": enter a progression as chord names *or* Roman numerals (toggleable) and receive six ranked next-chord suggestions. (G3) Everything is audible — hover/focus auditions a chord, Play performs the whole progression with a chosen performance style and tempo, all on a piano soundfont. (G4) Hybrid engine with an Adventurousness dial blending corpus statistics against rule-generated spice. (G5) A vaporwave-dreamscape interface with audio-reactive ambience and a full reduced-motion fallback. (G6) Static Vite build deployed to GitHub Pages via Actions.

**Non-goals for the POC** (decided during scoping — treat this list as the contract against scope creep):

- Loop playback (explicitly cut; Play performs one pass).
- Theory "why" annotations in the UI (the engine *records* reasons per candidate for a future release, but no explainer surface ships).
- A "surprise me" randomizer beyond Conjure.
- Claude-API-powered suggestions (breaks the static-only constraint; noted as a possible v2 layer behind a proxy).
- Genre packs beyond synthwave/retrowave (lo-fi, jazz/neo-soul, pop/rock are v1.1 candidates — the architecture must make adding a genre a data-file drop, not a code change).
- Instruments beyond piano (bass + pad layers are the obvious v1.1 for synthwave).
- MIDI/WAV export, saving, sharing, mobile-first design (must not *break* on mobile; optimized for desktop).

## 3. Two modes, one engine

**Spark mode:** land on the page, press Conjure, hear a progression, drag the dial, conjure again. **Co-writer mode:** enter Am–F–C, audition the orbs the ether offers, click one to append it, repeat as the progression grows. Internally these are the same operation — Spark is simply the co-writer engine seeded from an empty progression, sampling repeatedly instead of once. One engine, two entry points; the UI should present them as one continuous surface, not two tabs.

## 4. Interaction spec

### 4.1 Layout (single page)

```
┌──────────────────────────────────────────────────┐
│  D I V O R A W A V E              tagline        │  header — quiet
│                                                  │
│         ·   ✦   T H E   E T H E R   ✦   ·        │
│      (G)     (Dm)     (E)     (C)    (Bdim)      │  suggestion orbs —
│      big     big      med     sm      sm         │  glow/size ∝ score
│                                                  │
│  SIDE A ─────────────────────────────────── ✕    │
│  [ Am ][ F ][ C ]  ▸ awaiting next chord…        │  the Deck (timeline)
│                                                  │
│  key: A minor ▾   [ABC ⇄ I–IV]   dial ◐  104 BPM │  control bar —
│  style: Pulse ⅛ ▾        [ Conjure ] [ Play ]    │  glass, disciplined
└──────────────────────────────────────────────────┘
```

Three horizontal bands. **The Ether** (upper field) is where suggestion orbs materialize — this is the signature element (§5.1). **The Deck** ("SIDE A") is the progression timeline: one tile per chord showing name and Roman numeral, click to audition, ✕ removes the last chord, Clear empties it. **The control bar** holds: key selector (root × major/minor; default A minor), input-notation toggle (chord names ⇄ Roman numerals), Adventurousness dial (0–100; endpoint labels "FM RADIO" and "DEEP ETHER"), tempo slider (60–160 BPM, default 104), performance-style selector, and the Conjure / Play / Stop / Clear actions.

### 4.2 Chord entry (both notations, toggleable)

Chords are stored dual-natured — absolute spelling *and* key-relative Roman degree — so the toggle is a re-render, never a lossy conversion. **Names mode:** a text input with autocomplete chips (Am, F, Cmaj7, Dsus2, E7…), parsed by tonal.js; unparseable input gets a gentle shake and an inline hint, never a modal. **Roman mode:** numerals entered relative to the selected key, rendered per mode convention (in A minor: i, ii°, ♭III, iv, v, ♭VI, ♭VII, plus V when borrowed). Changing key re-labels the Deck and re-voices playback; the stored progression is the source of truth.

### 4.3 Audition (click-a-chord)

Hovering an orb or Deck tile for 150 ms plays its current voicing as a soft block chord (15 ms roll, low velocity); keyboard focus does the same. Clicking an orb appends it to the Deck *and* plays it. This is the core feel of the product — suggestions must be effortless to taste.

### 4.4 Playback

Play performs the Deck once, left to right, two beats per chord, in the selected style at the selected tempo (no loop — cut in scoping). A playhead highlight travels across Deck tiles in sync; the ambience reacts (§5.5). Styles for the POC: **Block** (sustained chords), **Arp ↑**, **Arp ↓** (eighth-note arpeggios through the voicing), and **Pulse ⅛** (staccato eighths with accents on beats 1 and 3 — the synthwave default). Even though playback doesn't loop, Conjure-generated progressions must be *loop-shaped*: they end on a chord whose function pulls back to i, because synthwave is cyclical music.

### 4.5 Keyboard and accessibility

Tab reaches every control; arrow keys cycle orbs in rank order; Enter appends the focused orb; Space toggles Play/Stop. All controls carry labels (decorative katakana/fullwidth text is `aria-hidden`). Orb ranking is never communicated by color alone — size, glow, *and* a small rank ordinal encode it. `prefers-reduced-motion` swaps all ambience for a static scene (§5.5). Text and control contrast meets WCAG AA (§5.6).

### 4.6 First run and edge states

Browsers suspend audio until a user gesture: on first interaction the AudioContext resumes; if a user hits Play before that, show "tap anywhere to tune in." While piano samples load, controls render disabled with a "tuning the ether…" shimmer (reduced-motion: static text). An empty Deck seeds the Ether with common synthwave openers (i, ♭VI, iv…) so the page is never blank. If the stats table fails to load, the engine degrades to rules-only and says so quietly in the footer — never a blocking error.

## 5. Visual direction — Phase A (Claude Design)

### 5.1 Concept and signature

The concept is **ideas sprung from the ether**, rendered as a vaporwave dreamscape: a perpetual neon sunset over a slow perspective grid, haze on the horizon. The **signature element — spend all the boldness here — is the Ether field**: chord suggestions condense out of the horizon haze as glowing orbs, each a small sun with a chromatic-aberration rim, scaled and brightened by its score; committing one pulls it down into the Deck like a captured thought. Everything else (Deck, control bar) stays quiet and disciplined — dark glass panels, restrained neon accents — so the Ether owns the page.

### 5.2 Color tokens (starting palette — Claude Design may tune, must keep AA)

- `--vw-pink: #FF71CE` — accent, orb cores, active states
- `--vw-cyan: #01CDFE` — grid lines, secondary accent
- `--vw-mint: #05FFA1` — success/confirm, playhead
- `--vw-violet: #B967FF` — dial, tertiary accent
- `--vw-cream: #FFFB96` — focus rings, warm highlights
- `--vw-ink: #12002E → #2A0A4A` — background gradient, deepening toward the top
- `--vw-body: #F4F0FF` — body text (neon hues are for accents, never paragraphs)

### 5.3 Type roles

Three roles, chosen deliberately: a **display face** with retro-future chrome character for the wordmark and section marks (candidates: Audiowide, Monoton, Orbitron — or a bespoke SVG chrome wordmark, which is encouraged); a **UI/body face** that is plain and legible (a humanist sans or a clean grotesk); and a **data face** — a monospace for chord symbols, Roman numerals, and BPM, where fixed width keeps the Deck rhythmic (candidates: Space Mono, IBM Plex Mono). Display face is used with restraint: wordmark, "THE ETHER," "SIDE A," and nothing else. The wordmark is the letterspaced name — D I V O R A W A V E — set in the display face or drawn as a bespoke chrome SVG; the letterspacing is canonical, not optional.

### 5.4 Texture and materials

Perspective grid floor drifting slowly toward the viewer; a low banded sun behind the Ether; VHS grain at ≤4% opacity; occasional scanline shimmer, subtle enough to miss. Panels are glassmorphic — 12–16 px blur, 1 px neon border at low alpha. All texture is generated (CSS gradients, SVG turbulence) rather than photographic.

### 5.5 Motion

Orb materialization: scale 0.6→1 with blur 8→0 over ~400 ms, staggered by rank. Append: the chosen orb arcs down into the Deck. Playback ambience: sun glow and grid brightness keyed to an AnalyserNode RMS value (the site literally pulses with the music, our "ether breathes" moment). Idle: the grid drifts, nothing else moves. **Reduced-motion variant is a first-class deliverable:** static sunset, crossfade-only transitions, ambience off. No element may flash faster than 3 Hz under any circumstance (photosensitivity floor).

### 5.6 Guardrails

WCAG AA contrast for all text and interactive elements against their actual backgrounds (check neon-on-gradient combinations specifically — pure `--vw-cyan` on the sunset band will fail; darken or outline as needed). Visible focus rings (`--vw-cream` works on ink). Hit targets ≥ 40 px. The page must degrade gracefully to a single-column stack on narrow viewports even though desktop is the design target.

### 5.7 Copy voice

Dreamy retro-computer skin over plain-verb bones. Flavor lives in *nouns and labels* ("THE ETHER," "SIDE A," "DEEP ETHER," "tuning the ether…"); *actions say exactly what they do* ("Conjure," "Play," "Stop," "Clear" — never "Submit," never mystery verbs). Errors explain and point forward without apologizing ("Couldn't read that chord — try Am, F#m7, or Csus2."). Decorative katakana/fullwidth text is welcome as texture, always `aria-hidden`, never load-bearing.

### 5.8 Asset rules

Every asset is original — no borrowed statues, album art, logos, or screenshots of other software. Prefer SVG/CSS-generated art; any raster texture must be self-made. (The vaporwave *language* is the reference, not any specific vaporwave *artwork*.)

### 5.9 Phase A deliverables and acceptance

Deliverables: (1) style tiles / moodboard grounded in §5.1–5.4; (2) high-fidelity mockups of the single page in four states — empty/first-run, suggesting (orbs live), playing (playhead + ambience), and reduced-motion; (3) a design-token sheet as CSS custom properties (final palette, type scale, spacing, radii, blur values); (4) a one-page motion spec (durations, easings, stagger, the append arc, the ambience mapping); (5) optionally a static HTML/CSS prototype of the suggesting state. Acceptance: Nick approves the style tiles and the four-state mockups; approved tokens then bind Phase B.

---

## 6. Recommendation engine — Phase B

### 6.1 Chord representation

Every chord is stored as `{ root, quality, extensions, bass?, romanDegree, function }` with both absolute and key-relative forms populated via tonal.js at entry time. The engine reasons in key-relative space (roman degree + quality) so one stats table serves every key; audio always renders absolute pitches in the current key.

### 6.2 Stage 1 — rules (candidate generation)

A curated functional-harmony layer, mode-aware and tuned for synthwave's aeolian center of gravity. Candidate classes, each emitted with `{ class, spice: 0–1, reason }` (reason strings are stored but not surfaced — they feed a future "why" UI):

- Diatonic triads and sevenths of the natural minor (spice ≈ 0): i, ii°/ii°7, ♭III, iv, v, ♭VI, ♭VII, with sus2/add9 colorings offered on i, iv, ♭VI (synthwave loves them).
- Harmonic-minor dominant V and V7 (spice ≈ 0.2) — the "pull home" option.
- Modal borrowals from parallel major and dorian: IV (dorian brightening of iv), and a cadential picardy I (spice ≈ 0.4–0.5).
- Secondary dominants V/♭III, V/♭VI, V/♭VII, V/iv (spice ≈ 0.6).
- ♭II (Neapolitan flavor) and the tritone substitute of V (spice ≈ 0.8–0.9) — the deep-ether shelf.

Major-key sessions mirror this with the standard major functional graph plus borrowed iv, ♭VI, ♭VII. Constraints applied at generation: no immediate literal repeat, at most two consecutive chords of the same function, and Conjure output must end on a chord whose function resolves toward i (loop-shaped, per §4.4).

### 6.3 Stage 2 — stats (ranking)

An order-2 Markov model `P(next | prev2, prev1)` with backoff to order-1 and unigram priors, Laplace-smoothed, keyed on (romanDegree, quality). Trained offline from the Chordonomicon corpus filtered toward synthwave (pipeline in §7) and shipped as a small static JSON. At runtime the table only *ranks*; it never proposes chords the rules layer didn't generate (this keeps every suggestion theoretically nameable).

### 6.4 The blend (Adventurousness dial)

With dial value `a ∈ [0,1]`: `score(c) = (1−a) · P̂stats(c) + a · spice(c) · novelty(c)`, where `P̂stats` is the normalized stats probability and `novelty` mildly boosts candidates rare in the corpus. At `a = 0` ("FM RADIO") the ether behaves like 40,000 songs' worth of consensus; at `a = 1` ("DEEP ETHER") it favors the legal-but-strange. Top six candidates ship to the UI with normalized weights driving orb size and glow. Ties break by voice-leading smoothness from the current voicing (§8.3) — a nice, musical tiebreaker.

### 6.5 Conjure (full-progression generation)

Temperature-controlled sampling from the same blended distribution, seeded from the empty-progression opener table, length 4 or 8, with the §6.2 constraints enforced and the loop-shape rule applied to the final chord. A seeded RNG (visible seed as an easter egg) is a stretch goal, not a requirement.

## 7. Corpus pipeline — build-time only

A repo-local script (`tools/distill.ts`, Node; Python acceptable if Claude Code prefers) run manually by a developer — its output is committed, and nothing about it ships to the client except the JSON.

1. Download the Chordonomicon dataset (Hugging Face: `ailsntua/Chordonomicon` — 666k+ user-contributed song progressions with genre/sub-genre, structural-part, and release-date metadata).
2. Filter rows by a tiered genre regex. Tier 1: `synthwave|retrowave|outrun|darksynth|new retro`. Tier 2 (auto-widen if Tier 1 < ~300 usable songs, log loudly): `synth-?pop|new wave|electro(?!nic rock)`. Tier 3 fallback: 1980s-era electronic by release date.
3. Normalize each progression to roman degrees: parse chords with tonal, estimate the key with a simple Krumhansl-style profile over the progression, transpose to relative form; drop rows that fail parsing.
4. Count order-2/order-1/unigram transitions, smooth, and emit `public/data/synthwave.transitions.json` (~5–30 KB) with provenance metadata `{ rows_used, filter_tier, generated_at }`.
5. License hygiene: Chordonomicon is an open research dataset; we ship aggregate statistics only and cite the dataset in the README and site footer.

**Decided in v2 — no hand-curated seed corpus.** The tiered filter carries the data side alone. If the pipeline widens to Tier 2/3, the statistics will skew toward adjacent-genre minor-key consensus; that tradeoff is accepted because the rules layer's synthwave vocabulary (§6.2) anchors the flavor regardless. The distiller must print its tier and row count prominently on every run so we always know what we're listening to.

## 8. Audio engine — Phase B

### 8.1 Libraries

`smplr` for the instrument and `tonal` for theory — both plain Web Audio, static-friendly, ESM. (`soundfont-player` is archived and itself points to smplr.) No Tone.js by default: a hand-rolled lookahead scheduler (~25 ms tick, ~120 ms lookahead) is sufficient for chords and eighth-note patterns and keeps the bundle lean; Claude Code may swap in Tone.js only if scheduling proves genuinely hairy, documented in the PR.

### 8.2 Instrument

Primary: smplr `SplendidGrandPiano`. Lighter fallback: smplr `Soundfont` with `acoustic_grand_piano`. The POC loads from smplr's default sample CDN (decided in v2). Vendoring the subset into `public/samples/` so Pages serves everything first-party is a pre-launch follow-up, not POC work.

### 8.3 Voicing engine (voice-leading aware)

Bass takes the root (or specified bass) in octave 2–3; three to four upper voices sit in roughly C3–C5. Among candidate inversions/spacings, pick the one minimizing total semitone motion from the previous voicing (greedy is fine), which keeps progressions smooth and doubles as the §6.4 tiebreaker. Sevenths, sus2/4, and add9 must voice correctly.

### 8.4 Performance styles and timing

Two beats per chord, one pass, styles per §4.4. Pulse ⅛ uses ~55% gate and velocity accents on beats 1 and 3. Audition = single soft block with a 15 ms roll. Tempo slider 60–160 BPM, default 104.

### 8.5 Effects and reactivity

`piano → reverb (generated noise-decay IR into a ConvolverNode, wet ≈ 0.25) → subtle stereo chorus (slow LFO, shallow depth) → master gain → destination`, with an AnalyserNode tapped at master. A rAF-throttled loop writes the RMS into a CSS custom property (`--pulse`) that the ambience consumes (§5.5). Keep the chain cheap; this must idle politely on a laptop.

## 9. Frontend architecture — Phase B

**Stack: Vite + TypeScript (strict) + Preact + @preact/signals** — the Spec Kit playground pattern. State (deck, key, notation mode, dial, tempo, style, playback position, sample-load status) maps cleanly onto signals; stack confirmed in v2. Module layout:

```
src/
  theory/   chords.ts, roman.ts, voicing.ts        # tonal wrappers, dual representation, VL engine
  engine/   rules.ts, stats.ts, blend.ts, conjure.ts
  audio/    player.ts, scheduler.ts, styles.ts, fx.ts
  ui/       App.tsx, Ether.tsx, Orb.tsx, Deck.tsx, Controls.tsx
  viz/      reactive.ts                            # analyser → CSS vars, reduced-motion guard
public/
  data/synthwave.transitions.json
  samples/                                         # if vendored (§12.2)
tools/
  distill.ts                                       # §7 pipeline
```

Visual implementation notes for Claude Code: background gradient + SVG grid animated by `transform` only (GPU-friendly); grain via tiled SVG turbulence; every ambient effect sits behind a `prefers-reduced-motion` guard; engine and theory modules get unit tests (Vitest), UI gets a smoke test. Deploy via GitHub Actions to Pages with `base` set for the repo path — same CI/CD shape as the Minesweeper project.

## 10. Milestones and acceptance

**Phase A (Claude Design):** deliverables §5.9; done when Nick approves style tiles + four-state mockups and the token sheet is exported.

**Phase B (Claude Code):** M1 — theory + engine core with unit tests (correct candidate sets in A minor, blend math, conjure constraints). M2 — audio: piano loads, voicing engine, four styles, tempo, audition. M3 — UI per Phase A mockups; both input modes; live orbs; keyboard flow. M4 — corpus pipeline run, real stats swapped in, a11y + reduced-motion pass, Pages deploy.

**POC acceptance script:**

1. On the deployed site, one tap, press Conjure → a 4-chord synthwave progression appears and plays in Pulse ⅛ at 104 BPM, ending on a chord that pulls back to i.
2. Clear; in Names mode type Am, F, C → six orbs materialize; hovering one auditions it; clicking appends it; toggling notation shows i–♭VI–♭III (+ the new chord) in A minor; switching key to E minor re-labels and re-voices.
3. Drag the dial to DEEP ETHER → visibly spicier candidates (♭II, a secondary dominant, or the tritone sub) enter the top six.
4. With `prefers-reduced-motion` on, the scene is static and the full step-2 flow completes keyboard-only.

## 11. Risks

**Synthwave sparsity in Chordonomicon** — handled by the tiered filter alone (v2 decision), with the rules layer anchoring genre flavor if the filter widens (§7). **Neon contrast failures** — token-level AA checks are a Phase A acceptance item, not an afterthought. **Sample CDN availability** — vendoring plan, §12.2. **Scope creep** — the §2 non-goals list is the contract; loops and extra genres wait their turn.

## 12. Decisions log (v2 — 2026-07-26, all questions resolved)

1. **Stack:** Preact + @preact/signals, as specced in §9.
2. **Piano samples:** smplr's default CDN for the POC; vendoring is a pre-launch follow-up (§8.2).
3. **Name:** **DIVORAWAVE**, always displayed letterspaced — D I V O R A W A V E. Repo/package: `divorawave`.
4. **Seed corpus:** none — the tiered filter carries the data side; the rules layer anchors flavor (§7).
5. **Defaults:** A minor and 104 BPM confirmed as the landing state.
6. **Chord duration:** uniform two beats per chord in the POC; per-chord control deferred.
