# D I V O R A W A V E — Implementation Plan (Phase B)

**Status:** Draft v1 · 2026-07-26
**Owner:** Nick · **Executor:** Claude Code
**Source of truth:** [mockup/divorawave-design-brief.md](mockup/divorawave-design-brief.md) (v2, all §12 decisions resolved) + [mockup/HANDOFF.md](mockup/HANDOFF.md) (Phase A → B handoff). Where this plan and those docs disagree, the docs win — except where §7 "Decisions made during planning" below records a deliberate deviation with its reason.

---

## 1. What we're building

A static single-page web app that conjures synthwave chord progressions: press **Conjure** for a loop-shaped 4/8-chord progression, or type your chords and watch six ranked next-chord suggestions condense out of a vaporwave dreamscape as glowing orbs — every chord instantly audible on a piano soundfont. A hybrid engine (music-theory rules generate candidates, corpus statistics rank them) with an **Adventurousness** dial. Pure HTML/CSS/JS after a Vite build, deployed to GitHub Pages. No backend, no accounts, no API keys.

Phase A (design) is complete and approved: the mockup folder contains a live hi-fi prototype, the binding token sheet, a motion spec, and a style tile. Phase B (this plan) builds the real app.

## 2. Source-of-truth documents

| File | Role |
|---|---|
| `mockup/divorawave-design-brief.md` | The contract: goals, non-goals (§2 — anti-scope-creep list), interaction spec, engine spec, milestones, acceptance script |
| `mockup/HANDOFF.md` | Phase A→B handoff: module map, "demo vs real" list, frozen calibration constants, UI details to keep exactly |
| `mockup/Divorawave Tokens.dc.html` | **Binding**: the `:root` block is copied verbatim into `src/styles/tokens.css` |
| `mockup/Divorawave Motion Spec.dc.html` | The 8 motions, easings, stagger, reduced-motion matrix, 3 Hz floor, ambience mapping |
| `mockup/Divorawave Prototype.dc.html` | Visual + interaction reference for all four states; styles are ported literally |
| `mockup/Divorawave Style Tile.dc.html` | Concept, palette, type-roles, materials, and copy-voice reference; where it overlaps the Tokens sheet or prototype, those take precedence |
| `mockup/engine.js`, `mockup/piano.js` | Reference implementations; §5 below says what ports verbatim vs. what's replaced |
| `mockup/support.js` | Mockup-viewer scaffolding only (generated dc-runtime bundle). **Nothing in it is ported.** |

## 3. Verified facts (checked 2026-07-26 — pin these, don't re-guess)

**Local environment:** Windows 11 · git 2.45.1 · gh CLI 2.87.3, authenticated as **NickSanft** (scopes include `repo` + `workflow` — sufficient to create the repo and push workflow files) · Node 22.13.1 / npm 10.9.2 (meets Vite 8's 20.19+/22.12+ requirement).

**Dependency versions (npm `latest`, verified against the registry):**

| Package | Version | Notes that affect this plan |
|---|---|---|
| `vite` | 8.1.5 | Rolldown-based. Don't write `rollupOptions`/`esbuild` config keys. Scaffold via `create-vite` `preact-ts` template |
| `typescript` | template pins ~6.0.2 | `strict` is now the *default* in TS 6/7; we still set it explicitly. TS 7 (native, GA 2026-07-08) is a later drop-in upgrade |
| `vitest` | 4.1.10 | v5 is beta-only — pin `^4.1.10`. Supports Vite 8 since 4.1 |
| `preact` / `@preact/signals` / `@preact/preset-vite` | 10.29.7 / 2.10.0 / 2.10.6 | Signals peer-dep satisfied |
| `tonal` | 6.4.3 | v6: `Chord.get` returns **pitch classes only**; `Chord.tokenize` returns `[tonic, type, bass]`; slash-bass supported. **`Progression.toRomanNumerals` is mode-agnostic** (always uppercase + literal suffix, degrees relative to the *major* scale) — it cannot produce our minor-key convention (i, ♭VI, ♭VII) directly; see Phase 2 §2.1 |
| `smplr` | 1.0.0 (2026-06-13) | 1.0 API: factory style `SplendidGrandPiano(ctx, opts)` (no `new`), `await piano.ready`, `destination` option for custom FX routing, `output.volume` 0–127. Samples: Splendid ≈ **19–23 MB** full load (5 velocity layers; trim with `notesToLoad`), Soundfont `acoustic_grand_piano` ≈ 2.3 MB. Default CDNs are GitHub Pages (rate-limited — use `CacheStorage()` in dev) |
| `jsdom` / `@testing-library/preact` | 29.1.1 / 3.2.4 | For the UI smoke test |
| GitHub Actions | `actions/checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` | Per Vite's Pages guide, except setup-node bumped to v7 (guide shows v6; v7.0.0 verified on the action repo) |

**Chordonomicon (Hugging Face `ailsntua/Chordonomicon`) — measured, not assumed:**

- 679,807 rows; single CSV (264 MB) or auto-converted single parquet shard (**92 MB**); no auth needed. License **CC-BY-NC-4.0** (data; we ship aggregate statistics only — see §7.6).
- Columns: `id, chords, release_date, genres, decade, rock_genre, artist_id, main_genre, spotify_song_id, spotify_artist_id`. No key/tonality field — key must be inferred.
- Chords string: absolute symbols with `s` for sharp (`Cs`, `A/Cs`), `b` for flat, `min`/`7`/`maj7`/`min7`/sus/dim/aug qualities, slash bass, and structural markers like `<verse_1>` (not on all rows). Consecutive duplicates already collapsed.
- **Genre reality check** (substring counts in `genres`): `synthwave` 111 · `retrowave` **0 (tag doesn't exist)** · `spacewave` 10 · `vaporwave` 24 · `chillwave` 494 · `darkwave`+`dark wave` ~347 · `synthpop` 3,883 (**no-hyphen spelling; `synth-pop` matches 0**) · `new wave` 9,314 · `new romantic` 3,844 · `permanent wave` 9,400 · `electropop` 2,252 · italo disco/nu disco ~200. (`darksynth`/`outrun` were *not* measured — keep them in the regex but expect ~0 matches.) Filter on `genres`, not `main_genre` (synthwave rows usually have `main_genre` null). The brief's Tier 1 will *always* auto-widen — expected and fine; the rules layer anchors the flavor (§7 of the brief, decision #4).
- Citation (README + site footer): Kantarelis et al., *CHORDONOMICON: A Dataset of 666,000 Songs and their Chord Progressions*, arXiv:2410.22046.

## 4. Target architecture (brief §9, confirmed)

```
divorawave/
  index.html
  vite.config.ts                     # preact preset, base: '/divorawave/', vitest config
  src/
    main.tsx
    styles/tokens.css                # :root block copied VERBATIM from the Tokens sheet
    styles/app.css                   # scene, glass, grid, sun — ported from prototype
    theory/  chords.ts roman.ts voicing.ts
    engine/  rules.ts stats.ts blend.ts conjure.ts
    audio/   player.ts scheduler.ts styles.ts fx.ts
    ui/      App.tsx Ether.tsx Orb.tsx Deck.tsx Controls.tsx
    viz/     reactive.ts             # analyser RMS → --pulse; 0 under reduced motion
  public/
    data/synthwave.transitions.json  # distilled stats (committed build artifact)
  tools/
    distill.ts                       # corpus pipeline, run manually, output committed
  .github/workflows/ci.yml deploy.yml
```

## 5. Port map — what's frozen, what's replaced

The HANDOFF marks these engine behaviors as **review-validated; port verbatim, constants frozen**:

- **Blend** (`suggest` → `engine/blend.ts`): `aa = a^1.8`; `score = (1−aa)·P̂ + aa·(.12+.88·spice)·novelty·.2`; `novelty = .35+.65·max(0, 1−P̂·5)`; coloring-variant demotion ×.72 (keyed on `statsId !== roman`); VL tiebreak `+.006·(1−min(d,24)/24)` — **only when prevUppers is passed; conjure never passes it**; the Laplace floor `+.004` *and* the soft third-in-a-row same-function penalty ×.25 (arms only when the last *two* deck chords share a function) both apply to the raw probability **before** the normalizing sum, so the penalty redistributes mass to other functions; no-literal-repeat filter on `(semis, quality)`; top-6 dedupe by *both* chord name and statsId (one coloring variant per parent); display transform `rel = (s/smax)^1.15`.
- **Conjure** (`engine/conjure.ts`): pool = `suggest(deck, key, dial, 12)`; length 4 (p=.7) or 8; τ = `.65 + .5·(dial/100)`; roulette sampling on `max(score,1e-4)^(1/τ)` with `pool[0]` fallback. **The review fix:** final-chord home filter (`func === 'D' && !roman.includes('/')`) applies to the **unfiltered** pool via `if/else if` — the last chord is *exempt* from the same-function filter. Both filters fall back to the unfiltered pool if they'd empty it. `rng` stays injectable (test seam + seeded-RNG stretch goal).
- **Voicing** (`voice` → `theory/voicing.ts`): bass = MIDI 36 + rootPc; >3 distinct pitch classes → root dropped from uppers; rotations stacked from base 48–62, top capped at 76; prev-voicing cost = sum of |Δ| over sorted, index-clamped note lists; first-chord cost = `|mean−59|·1.5 + (lowest<50 ? 2 : 0)`.
- **Rules tables** (`MINOR` 21 classes / `MAJOR` 19 → `engine/rules.ts`): ported exactly, including spice values (calibrated against the blend constants — do not retune independently), `func` assignments (♭VII = D is what lets Conjure cadence on it), statsId aliasing for coloring variants, and **array order** (empty-input chips = first 8 entries = the §4.6 synthwave openers; `classify` first-match determinism). Additive change: a `reason: string` field per class (brief §6.2 — stored, never surfaced).
- **Audio chain shape** (`piano.js` → `audio/fx.ts`): master gain .9 → analyser (fftSize 1024, the summing point) → destination; master → convolver (noise IR, dur 1.9 s, decay exponent 2.6) → wet gain **.27** → analyser. (Brief §8.5 additionally specifies a subtle stereo chorus the prototype omits — reconciled in §7.11.) Style timings (→ `audio/styles.ts`): Block gate .98 vel .6 roll 12 ms · Pulse ⅛ 4×eighths gate .55, vels .72/.42/.6/.42, roll 4 ms · Arps bass gate .95 vel .5, uppers gate 1.6×eighth vels .6/.45 · audition +20 ms start, 1.7 s, vel .4, roll 15 ms. **Note content per style**: Block and Pulse roll the *full* voicing `v.all` (bass first); Arps play a sustained bass plus exactly 4 upper events over the **sorted-ascending** uppers with `seq[k % seq.length]` wraparound (3-note voicings repeat the first note on beat 4); Arp ↓ = the reversed sorted uppers. **Rolled chords**: note *i* starts at `t + i·roll` with duration `max(.1, dur − i·roll)` and velocity `vel × (i === 0 ? 1 : .9)`. Two beats per chord; lead-in .12 s; onChord fires at t−.04; end +.35 s; stop = bus fade .06 + disconnect at 400 ms (routing adaptation for smplr in §7.13).
- **Viz** (`onPulse` → `viz/reactive.ts`): RMS over every-4th analyser sample; `pulse = min(1, rms·3.2)`; asymmetric smoothing .3 attack / .07 release per rAF frame (≈60/300 ms); ambience multiplier; hard 0 under reduced motion; **on playback end and on non-silent stop, the smoothed value hard-resets to 0 and `--pulse` is written to 0 before the rAF loop parks** (demo `_pulseTo0`). Consumers: sun glow `calc(.55 + var(--pulse)*.45)`, grid brightness `calc(1 + var(--pulse)*.7)`.

**Replaced in Phase B:**

| Demo piece | Replacement |
|---|---|
| Hand chord/roman parsers (`parseName`, `SUFQ`, `parseRoman` regex) | tonal 6 parsing (`Chord.get`/`tokenize`), feeding the same `(semis, quality)` → `classify` snap. Fixes two demo bugs (§7.3) |
| `spell()` letter-offset speller with enharmonic bailout | **Retained, not replaced** (decision §7.14): the demo speller's output is the approved display surface; tonal assists parsing only |
| Hand-tuned order-1 `STATS` | Chordonomicon distill: order-2 with backoff to order-1 and unigram, Laplace-smoothed, same statsId key convention. Demo table survives as a test fixture **and as the interim shipped JSON until the Phase 5 distill replaces it** (the runtime *fetch-failure* fallback is uniform rules-only — Phase 2 §2.2) |
| All-at-once scheduling in `play()` | Lookahead scheduler (~25 ms tick, ~120 ms horizon) per brief §8.1 |
| 4-partial oscillator voice | smplr `SplendidGrandPiano` (fallback: smplr `Soundfont` `acoustic_grand_piano`) |
| DC prototype template | Preact components, styles ported literally onto the token sheet |

---

## Phase 0 — Repo bootstrap (public GitHub repo + initial commit)

**Goal:** `divorawave` exists as a public repo under NickSanft with the Phase A mockup and this plan as the initial commit.

**Steps** (from `C:\Users\nicho\Documents\GitHub\DivoraWave`):

1. `git init -b main`
2. Add `.gitignore` (Node template: `node_modules/`, `dist/`, `*.local`, `.DS_Store`, editor cruft; plus `tools/.cache/` for the corpus download — the 92–264 MB raw dataset must never be committed).
3. Add `LICENSE` — MIT, copyright Nick Sanft (code only; see §7.6 for the dataset-attribution note that goes in the README).
4. Add a stub `README.md`: one-paragraph description, letterspaced wordmark, link to `PLAN.md`, placeholder sections for the Chordonomicon citation + smplr/tonal credits, "built with Claude Code" note if desired.
5. Commit everything (mockup/, PLAN.md, README.md, LICENSE, .gitignore):
   `git add -A && git commit -m "chore: initial commit — Phase A mockup + Phase B implementation plan"`
6. Create the public repo and push (gh requires the commit to exist first):
   `gh repo create divorawave --public --source=. --push`
   (Repo/package name is `divorawave` per brief decision #3; the local folder name `DivoraWave` doesn't need to match.)
7. Verify: `gh repo view divorawave --web` shows the mockup and plan on `main`.

**Exit criteria:** public repo live; `git remote -v` points at it; mockup + plan browsable on GitHub.

---

## Phase 1 — Scaffold, tokens, CI/CD skeleton

**Goal:** a deployed (near-empty) page at `https://nicksanft.github.io/divorawave/` with the token sheet, fonts, and CI running tests on every push — so every later phase lands on a working pipeline.

1. Scaffold Vite + Preact + TS into a temp dir and merge into the repo root (create-vite balks at non-empty dirs; scaffold `npm create vite@latest divorawave-scaffold -- --template preact-ts`, move contents in, delete the temp dir). **Collision rule: keep Phase 0's `README.md` and `.gitignore`** (the `tools/.cache/` ignore is load-bearing — it keeps the 92–264 MB dataset out of git); merge template-only ignore entries (`dist/`, etc.) into ours. Template gives Vite 8.1.5, TS ~6.0.2 project-references config, `tsc -b && vite build`.
2. `vite.config.ts`: `@preact/preset-vite`, **`base: '/divorawave/'`**, and inline Vitest config with `/// <reference types="vitest/config" />` at the top. Test environment stays the **node default** (engine/theory tests); UI test files opt into jsdom individually via a `// @vitest-environment jsdom` docblock (or, if that gets unwieldy, two Vitest `projects` — `workspace` was removed in Vitest 4). Do not add `rollupOptions`/`esbuild` keys (Vite 8/Rolldown).
3. tsconfig: keep template flags (`verbatimModuleSyntax`, `jsx: react-jsx` + `jsxImportSource: preact`, `noUnusedLocals`, …); add explicit `"strict": true` and `"noUncheckedIndexedAccess": true`.
4. Dependencies: `tonal@^6.4.3`, `smplr@^1.0.0`; dev: `vitest@^4.1.10`, `jsdom`, `@testing-library/preact`. Add `"engines": { "node": ">=22" }` and a `"test": "vitest"` script (the template has none), plus one trivial placeholder test (e.g. tokens.css parses / App mounts) so `vitest --run` doesn't exit 1 on zero test files — replaced by real tests in Phase 2.
5. `src/styles/tokens.css`: copy the `:root` block **character-for-character** from the Tokens sheet (it includes color, materials, type, spacing, radii, motion tokens, and the `--pulse` contract). `src/styles/app.css` starts with the background scene (sky gradient, stars, banded sun, horizon, perspective grid, grain, scanline) ported from the prototype — this makes the Phase 1 deploy visually real enough to validate tokens on actual gradients.
6. Fonts: Google Fonts `<link>` with preconnect — Audiowide, Space Grotesk 400/500/700, Space Mono 400/700, `display=swap` (exactly as the mockups load them). Self-hosting is a pre-launch follow-up alongside sample vendoring (§9).
7. `.github/workflows/ci.yml`: on push/PR → checkout@v7, setup-node@v7 (node 22, npm cache), `npm ci`, `npm test -- --run`, `npm run build`.
8. `.github/workflows/deploy.yml`: on push to main + `workflow_dispatch` → build job (checkout, setup-node, `npm ci`, `npm run build`, `configure-pages@v6`, `upload-pages-artifact@v5` with `path: ./dist`) → deploy job (`needs: build`, `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`, `deploy-pages@v5` as `id: deployment`). Permissions: `contents: read, pages: write, id-token: write`.
9. Enable Pages with Actions as the source (one-time; `gh repo edit` can't do this):
   `gh api repos/NickSanft/divorawave/pages -X POST -f build_type=workflow`
10. Push; verify the deployed page renders the sunset scene with correct fonts at the project URL.

**Exit criteria:** CI green; Pages URL serves the token-styled scene; `npm test` and `npm run build` work locally and in CI.

---

## Phase 2 — Theory + engine core (brief M1)

**Goal:** the complete recommendation engine as pure, dependency-injected TypeScript with unit tests — no UI, no audio.

### 2.1 `src/theory/`

- `chords.ts` — the dual-natured Chord type (brief §6.1): `{ root, quality, extensions, bass?, romanDegree, function, semis, statsId, spice, ints, name, rootPc, reason }`. Keep the demo's 11-quality vocabulary `Q` with its interval sets (add9/madd9 use **14**, not 2) as the voicing input. Parse chord names with tonal `Chord.get`, then **collapse onto the Q vocabulary** and run the `classify` snap (below). tonal v6 caveats baked into tests: `Chord.get` returns pitch classes only (we keep our own `rootPc + ints` midi math); `Chord.get("C4")` parses "4" as a chord type — never feed bare tonic+octave strings; slash bass comes from `tokenize`'s third element, and **quality/`ints` always derive from tokenize's root-position type element, never from `Chord.get`'s notes/intervals arrays (which tonal rotates for member-bass inversions like `A/C♯`)**. **Normalization contract:** tonal parses ASCII only, and our display strings, chips, ROOTS spellings, and statsIds are all unicode — so map `♯→#`, `♭→b` (and `°`/`ø` to tonal-safe aliases) before *every* tonal call; a round-trip test proves every chip label and statsId parses. **Q-collapse policy** (§7.12): qualities tonal accepts but Q lacks map onto Q where a natural parent exists (9th→matching 7th, 6/m6→triad, dim7→dim, 7sus4→sus4); anything else takes the error-string path exactly like the demo's rejects.
- `roman.ts` — roman parsing and labeling **in our own convention** (minor: i, ii°, ♭III, iv, v, ♭VI, ♭VII, V when borrowed). tonal's `Progression`/`RomanNumeral` are mode-agnostic (uppercase-only output, major-scale degrees) so they can assist parsing, but the label authority is our candidate tables + `classify`. Port `classify` faithfully: snap `(semis, quality)` to an existing candidate class first (this is what keeps user-entered chords connected to the stats rows); otherwise synthesize (degree-map roman, case per quality, func heuristic T{0,3,4,9}/D{7,10,11}/else S, spice .5, statsId = roman).
- `voicing.ts` — `voice()` ported verbatim (§5 constants). Sevenths, sus2/4, add9 must voice correctly (test each).

### 2.2 `src/engine/`

- `rules.ts` — `MINOR`/`MAJOR` tables verbatim + `reason` strings; `candidates(key)`; `ROOTS`; `makeKey` (keep the A-fallback, but make it explicit/logged).
- `stats.ts` — the stats interface: `p(next: StatsId, prev1?: StatsId, prev2?: StatsId): number` implementing **order-2 → order-1 → unigram backoff** over the shipped JSON, plus `START` handling for the empty deck. Async loader for `public/data/synthwave.transitions.json` (fetch relative to `import.meta.env.BASE_URL`); on fetch/parse failure → rules-only mode (uniform stats via the .004 floor) + an exported status flag the footer note consumes (§4.6 of the brief). **This phase also converts the demo STATS table into the shipped JSON schema and commits it as the interim `public/data/synthwave.transitions.json`** (order-1 rows work through the backoff interface; Phase 5's distill overwrites the file) — this is what Phase 4's "with demo stats" exit criterion runs on. Unknown source ids degrade to empty rows, never throw. Rows may be sub-stochastic; the runtime must not assume normalization.
- `blend.ts` — `suggest()` ported verbatim; the *only* structural change from the demo is the row lookup becoming the order-2 backoff query. The single swap point is the full demo line `const row = (last ? T[last.statsId] : T.START) || {};` — both branches route through the backoff query (`START` = the empty-deck query), and `prev2` is already in scope.
- `conjure.ts` — ported verbatim, if/else-if ordering intact, `rng` injectable.
- `chips.ts` (or a helper in `ui/`) — autocomplete pool from candidate labels; empty input → first 8 pool entries (the seeded openers). Chips stay candidate-derived so every chip is guaranteed parseable.

### 2.3 Tests (Vitest, node environment — this phase is the test-depth center of gravity)

- Candidate sets: exact A-minor and C-major candidate lists (romans, spice, func) against the frozen tables.
- Blend math golden tests: with the demo STATS as fixture, pin exact scores/rankings for known decks; verify floor and ×.25 penalty (both pre-normalization), the penalty arming rule, ×.72 demotion, one-variant-per-parent dedupe, rel^1.15. **Golden values are generated by executing `mockup/engine.js` directly** (it's pure, dependency-free ESM importable in node) — never hand-computed.
- **Dial calibration acceptance (HANDOFF targets):** dial ≤40 → top-6 fully diatonic; ~50 → first spicy entrant is ♭II7; 60 → mixed; ≥90 → full deep-ether. These run against the *shipped* stats too, in Phase 5.
- Conjure with seeded rng: ends on `func==='D'` non-secondary; no literal repeats; ≤2 consecutive same-function (except the exempt final chord); 4/8 length split; conjure never applies the VL tiebreak (no prevUppers).
- Voicing: correct pitch-class content for all 11 qualities; register bounds (bass octave 2, uppers within 48–76); min-motion choice between known voicings; 3-vs-4-note distance clamping.
- Parser: names + romans round-trip in both notations across keys; unicode/ASCII accidental equivalence (every chip label and statsId parses); `CM` → C major (demo-bug regression test, §7.3); case-sensitive roman match (`V` ≠ `v`, `I` ≠ `i` in minor — §7.3); slash-bass accepted and stored in `bass` with root-position semis pinned for `A/C♯` and `Cmaj7/B` (voicing may ignore bass for POC — §7.4); Q-collapse policy pinned for `C9`, `C6`, `Cdim7`, `C7sus4` and a reject case (§7.12).
- Key change: re-labeling a stored progression from A minor to E minor preserves identity (the stored progression is the source of truth; the toggle is a re-render).

**Exit criteria:** M1 done — `npm test` covers the above and is green; engine is importable standalone with zero DOM/audio dependencies.

---

## Phase 3 — Audio engine (brief M2)

**Goal:** piano loads, chords sound right, all four styles play in time at any tempo, audition feels instant.

- `audio/fx.ts` — build the chain per §5 (master .9 → analyser 1024 → destination; master → conv(IR 1.9 s/2.6) → wet .27 → analyser), plus the brief-§8.5 **subtle stereo chorus** inserted where the dry and wet paths sum, before the analyser (§7.11): two short modulated delays (~2–4 ms depth, slow LFO ≲0.8 Hz — well under the 3 Hz floor) panned L/R at a shallow mix, with a bypass flag if it muddies the piano. Expose the FX input node and the analyser.
- `audio/player.ts` — smplr 1.0 API: smplr's `destination` is fixed at construction, so the demo's per-run bus is adapted (§7.13 as revised): `const piano = SplendidGrandPiano(ctx, { destination: out, onLoadProgress })` where `out` is one **permanent** routing gain → fx.input; stop fades it (τ .06) with `piano.stop()` underneath, and the gain parks at 0 until the next audition/play restores it. Every note carries `ampRelease: .07` — the demo's per-note release τ. `await piano.ready` drives the "tuning the ether…" shimmer state; wrap in `CacheStorage()` (dev hot-reload hits GitHub Pages rate limits otherwise). Velocity map: engine 0–1 → smplr 0–127. `ensure()` semantics from the prototype: lazy create, `ctx.resume()`, return whether running (drives the "tap anywhere to tune in" toast); global pointerdown resumes. Fallback: if Splendid fails to load (offline CDN, brief §11 risk), retry with `Soundfont(ctx, { instrument: 'acoustic_grand_piano', destination })` (~2.3 MB) and surface the same quiet-footer degradation pattern. Audition API per frozen constants.
- `audio/scheduler.ts` — lookahead scheduler: `setInterval` ~25 ms tick; each tick schedules note events whose time falls within `ctx.currentTime + 0.12` horizon; two beats per chord; `onChord(i)` marks fired at t−.04 from a rAF loop (UI sync stays frame-accurate); `onEnd` at endT+.35; stop = cease scheduling + `piano.stop()` under the routing-gain fade (§7.13). **Starting a run silently stops any prior run first** (demo `stop(true)` semantics — *without* the pulse reset); with the τ .07 note release, old tails die on the demo timescale so Conjure-during-playback never audibly overlaps. Tempo/style changes take effect on next Play (no live re-scheduling in POC).
- `audio/styles.ts` — the four patterns as pure functions `(voicing, t0, beat) → NoteEvent[]`, constants frozen per §5. Pure functions make them golden-testable without audio.
- `viz/reactive.ts` — per §5 (including the `_pulseTo0` hard reset on end/non-silent stop before the rAF loop parks); also `_kick(2)` behavior so auditions breathe; exported `setAmbience(0–1)` and reduced-motion guard (locks `--pulse` to 0 and cancels the rAF loop).
- Tests: style pattern golden tests (exact event lists for a voicing at 104 BPM) — `piano.js` commits WebAudio nodes and can't emit event lists, so goldens are **derived from `piano.js`'s `_chord`/`_note` math** (including the rolled-chord taper in §5), not from the §5 summary alone; scheduler unit test with a fake clock (events scheduled exactly once, inside the horizon, correct times); velocity mapping bounds. Sound quality itself is verified by ear against the §6 acceptance script (no automated audio-rendering tests in POC).

**Exit criteria:** M2 done — a dev-only test page (or console harness) can load the piano, audition any chord, and play a deck in all four styles at 60–160 BPM with correct accents; unit tests green.

---

## Phase 4 — UI per Phase A mockups (brief M3)

**Goal:** the full single-page product in Preact + signals, matching the prototype pixel-for-pixel on the approved states, with the complete keyboard flow.

- **State** (`@preact/signals`): deck, key (root+mode, **default A minor** — brief decision #5), notation, dial (default **38**), bpm (104), style (pulse), playing/playIdx, sampleLoad status, reduced-motion, toast/error, engine-degraded flag. Derived: suggestions (recomputed on deck/key/dial change; dial debounced 140 ms), chips, voicing chain (`_chain()` — greedy re-voice of the deck for playback and the VL tiebreak).
- **Components** (styles ported literally from the prototype onto tokens.css):
  - `App.tsx` — layout bands, background scene, global listeners (Space play/stop with form-element guard; ArrowLeft/Right orb cycling in rank order with the focus guard; pointerdown audio-resume), `prefers-reduced-motion` media query + MOTION pill state, conjure → 460 ms → autoplay (conjure and append both stop active playback first, per the prototype), footer (provenance line + Chordonomicon citation + degraded-mode note).
  - `Ether.tsx` — "THE ETHER" heading with its **ink-halo** text-shadow treatment (the cyan-on-sunset AA fix — take it from the prototype, not the tokens sheet), `role="group"`, 8-slot position table, orb entrance (400 ms pop ease, 60 ms rank stagger; RM: 200 ms crossfade), loading shimmer, toast pill, aria-hidden katakana texture.
  - `Orb.tsx` — diameter `86 + rel·86` px clamped `min(px, 25vh)`; rank ordinal "01"–"06"; glow `.35 + rel·.4`; chromatic rim ±1.6 px cyan/pink pseudo-elements; ink text (name + roman swap by notation, font sizes scale with diameter); 150 ms hover/focus audition dwell; click/Enter appends **and auditions the chord** (brief §4.3 — the sound-on-commit half of the core feel) and fires the append arc (44 px clone, 480 ms arc ease, apex 46 px above midpoint, scale 1→.35 — skipped under RM); `aria-label` "…, suggestion N of M".
  - `Deck.tsx` — SIDE A header + rule; ✕ remove-last (hidden when empty); tiles (name + roman, 240 ms tile-in, mint playhead treatment on playIdx); 150 ms dwell + click audition; dashed end-slot with the chord input — **parsing per active notation** (names via `chords.ts`, romans via `roman.ts`; chips show the matching label form; Enter submits, Backspace on empty input pops the deck) — chips popover, error line + 280 ms shake (skipped under RM), empty-deck hint.
  - `Controls.tsx` — KEY (12 roots, MINOR/MAJOR segments; changing key re-labels and re-voices), NOTATION (ABC ⇄ I–IV re-render), Adventurousness dial (`role="slider"`, drag `Δ·.55`, arc dasharray /141.4, needle −135°+2.7°·v, arrows ±5, `aria-valuetext` bands at 34/67, FM RADIO / DEEP ETHER endpoint labels), TEMPO 60–160 default 104, STYLE select, CLEAR / ✦ CONJURE / PLAY⇄STOP toggle, disabled states + .55 opacity while loading.
- **Copy** — canonical strings verbatim from the mockup: tagline `progressions condensed from the ether`; `tuning the ether…`; `tap anywhere to tune in`; both error strings; empty-deck hint; MOTION pill labels (`MOTION ✦ ON` / `MOTION · OFF`). (`Hover an orb to taste it. Click to keep it.` is Style-Tile copy-voice reference only — the approved four-state prototype never renders it, so neither do we.)
- **Reduced motion** — the full 8-motion matrix from the Motion Spec (materialize→crossfade, arc→skip, tile→opacity, playhead unchanged, ambience off/`--pulse` 0, grid static, scanline removed, shimmer static), driven by `prefers-reduced-motion` OR the pill; `[data-anim]`/`[data-rm-hide]` pattern from the prototype is fine. Nothing anywhere exceeds 3 Hz.
- **Tests** — UI smoke (jsdom + @testing-library/preact): renders all bands; orbs appear from a stubbed engine; click appends + deck updates; notation toggle re-labels; typed roman-numeral entry appends in I–IV mode; keyboard append path works. (Deep visual fidelity is verified against screenshots by hand, not by test.)

**Exit criteria:** M3 done — all four states reachable and matching `mockup/screenshots/01–05`; acceptance script step 2 passes end-to-end locally in *both* input modes (on the interim demo-stats JSON from Phase 2); keyboard-only flow complete.

---

## Phase 5 — Corpus pipeline, real stats, hardening, ship (brief M4)

**Goal:** real Chordonomicon-derived statistics, the a11y/reduced-motion audit, and the deployed site passing the full acceptance script.

### 5.1 `tools/distill.ts` (run manually via `npx tsx`; output committed; nothing else ships)

1. **Download** to `tools/.cache/` (gitignored): the parquet shard (92 MB) if we take a parquet dep (`hyparquet` is small), else the CSV (264 MB) streamed with `readline` — zero deps, simpler; pick CSV streaming.
2. **Filter** by tiered regex on `genres` (case-insensitive substring), tiers corrected to the measured tag reality (§3): Tier 1 `synthwave|darksynth|outrun|spacewave|vaporwave|chillwave|darkwave|dark wave` (≈900 measured rows — `darksynth`/`outrun` unmeasured, expected ~0; the broadened Tier 1 will likely *clear* the ~300-usable-songs threshold on its own, so auto-widening becomes the safety net rather than the expectation) · Tier 2 auto-widen if Tier 1 < ~300 usable songs post-parse: add `synthpop|new romantic|new wave|permanent wave|electropop|italo disco|nu disco` (≈10–17 k unique rows given heavy tag overlap) · Tier 3 fallback: `decade`-based 1980s + electronic-adjacent tags. **Print tier and row counts loudly on every run** (brief §7 requirement) and refuse to emit silently on Tier 3.
3. **Normalize**: strip `<section_N>` markers; translate corpus symbols to parseable form — the sharp substitution must be **positional** (`([A-G])s` → `$1#` applied to root and slash-bass segments only; a bare `s→#` would corrupt every sus chord: `Csus4` → `C#u#4`), `min`→`m`, keep slash bass; distiller unit tests pin `Csus4`, `Asus2`, `Fsmin`→F♯m, `A/Cs`→A/C♯. Parse via the same `theory/chords.ts` code the app uses (shared vocabulary collapse); estimate each song's key with a Krumhansl-profile match over its pitch-class histogram (major and minor profiles, pick argmax); map each chord to a statsId via the same `classify` snap in the estimated key; drop songs that fail parsing or have <4 mapped chords.
4. **Count** order-2, order-1, and unigram transitions on statsId sequences (per mode), plus the `START` opener distribution from song/section beginnings; Laplace-smooth; prune tiny counts to keep the JSON small.
5. **Emit** `public/data/synthwave.transitions.json` (~39 KB shipped) with provenance `{ source: "ailsntua/Chordonomicon", license: "CC-BY-NC-4.0", generated_at, filter_tier, rows_matched, songs_used, songs_minor/major, dropped_parse, dropped_key_margin, emit }`.
6. **Secondary-dominant policy** (the demo hides this — decision §7.5): corpus classification will rarely produce `V/x` labels, so the distiller **layers the hand-authored resolution rows** (`'V/♭III': {'♭III': .6}` etc.) over the distilled table, flagged in provenance. Their spice (.6) plus the floor already surfaces them at high dial; the layered rows make them resolve correctly once chosen.

### 5.2 Integration + hardening

- Swap the shipped JSON in; re-run the dial-calibration acceptance tests against *real* stats and re-tune **nothing in the blend** — if targets drift, the distiller's smoothing/pruning is the knob (constants are frozen).
- A11y pass: AA contrast against actual backgrounds per the tokens contrast table (cyan-on-sunset stays forbidden; `--vw-cyan-text`/ink-halo where needed); cream focus rings visible everywhere; hit targets ≥44 px — **known prototype-inherited offenders to fix with invisible hit-area expansion (transparent ::before inset), visual rendering unchanged: `.dv-x` (26 px — worst), `.dv-pill`, `.dv-seg`, `.dv-chip`, `.dv-select` (~27–31 px)**; labels on all controls; decorative text aria-hidden; keyboard-only run of acceptance steps 2+4; screen-reader spot-check of orb labels and status regions.
- Reduced-motion audit against the 8-motion matrix; 3 Hz audit (playhead at 160 BPM = 1.3 Hz — fine).
- Performance: idle CPU near zero when not playing (rAF loops must park); one-time sample load cost acknowledged with real progress in the shimmer; Lighthouse sanity pass. Narrow-viewport degrade to single-column stack (brief §5.6 — must not break; not optimized).
- README finalized: description, screenshots, Chordonomicon citation (BibTeX) + CC-BY-NC-4.0 attribution + "aggregate statistics only" note, smplr/tonal credits, dev/build/distill instructions. Site footer carries the citation + provenance line.

**Exit criteria:** M4 done — deployed site passes the full §6 acceptance.

---

## 6. POC acceptance (run on the deployed Pages site)

Brief §10 script, verbatim, plus the HANDOFF calibration targets:

1. One tap, press Conjure → a 4-chord synthwave progression appears and plays in Pulse ⅛ at 104 BPM, ending on a chord that pulls back to i.
2. Clear; Names mode: type Am, F, C → six orbs materialize; hover auditions; click appends; notation toggle shows i–♭VI–♭III (+ the new chord) in A minor; switching key to E minor re-labels and re-voices.
3. Dial to DEEP ETHER → visibly spicier candidates (♭II, a secondary dominant, or the tritone sub) enter the top six.
4. With `prefers-reduced-motion`, the scene is static and the full step-2 flow completes keyboard-only.
5. **Engine calibration** (automated, against shipped stats): dial ≤40 diatonic · ~50 first spicy entrant ♭II7 · 60 mixed · ≥90 full deep-ether; Conjure loop-shape invariant holds over 1,000 seeded runs. *Measured on the frozen demo engine (Phase 2): diatonic through 39, ♭II7 enters at exactly dial 40. Re-measured on the shipped tier-1 distill (Phase 5, §7.18): A minor — purely diatonic through 9; the corpus's own mild borrows (dorian IV, picardy I — brief §6.2's middle shelf, spice ≤ .5) share slot 6 through 41; first deep-shelf entrant is ♭II7 at exactly 42 (inside the 40–58 window, matching the HANDOFF's "~50"); 60 mixed; full deep-ether from 77. C major — first deep-shelf (♭II7) at 44; no secondary dominant before 59. The calibration tests pin the ≤41 band, the exact 42 entrant, 60, and 77+ checkpoints (a re-distill must update the pins and this record in the same commit); the landing dial 38 never shows the deep shelf in either mode.*

## 7. Decisions made during planning (deviations & resolutions — each traceable here)

1. **Deploy pipeline moves up to Phase 1** (brief lists Pages deploy under M4). Reason: every subsequent phase lands on live CI/CD; M4 keeps final deploy *verification*.
2. **Tier regex corrected against measured data** (§3): brief's Tier 1 `retrowave|new retro` tags don't exist in the corpus; `synth-pop` must be `synthpop`. Beyond removals, Tier 1 is deliberately *broadened* with measured wave-adjacent tags (spacewave 10, vaporwave 24, chillwave 494, darkwave/dark wave ~347) because pure synthwave is only 111 rows, and Tier 2 swaps the brief's `electro(?!nic rock)` for the tags that actually exist (`new romantic`, `permanent wave`, `electropop`, italo/nu disco). Consequence: Tier 1 (~900 rows) will likely satisfy the ~300-song threshold without widening. The brief's tier *mechanism* (auto-widen, loud logging) is unchanged.
3. **Two demo parser bug classes are fixed, not ported** (flagged in the engine read-through): (a) case-insensitive suffix collisions — `CM` parsed as C minor, `CM7` as Cm7; Phase B suffix matching is case-sensitive for the m/M collision family while unambiguous all-caps suffixes (`CMAJ7`, `CSUS2`, `ADIM7`, …) keep the demo's leniency via a collision-checked ci retry. (b) `parseRoman`'s case-insensitive direct match shadowing case-distinct romans — typed `V`/`I`/`IV` in minor returned v/i/iv, typed `iv` in major returned IV; Phase B does a case-sensitive match first. Scope note: typed case is honored exactly where both-case candidates exist; degrees with a single-case candidate keep the demo's ci mapping (`v7` → V7, `biii` → ♭III) — recorded in roman.ts. Regression tests pin all of it.
4. **Slash-chord bass**: tonal parses it and we store `bass` (brief §6.1 has the field), but the POC voicing engine keeps root-position bass (the demo behavior; brief §8.3 "or specified bass" becomes a backlog item). Deck displays the typed symbol faithfully. — **Superseded post-POC by §7.20**, which implements the specified bass (and fixes the deck-display half, which this entry claimed but the POC never actually delivered).
5. **Secondary-dominant stats rows**: hand-authored resolution rows layered over the distilled table (see 5.1.6) — the demo's implicit behavior made explicit.
6. **Licensing**: MIT for our code. Chordonomicon is CC-BY-NC-4.0; we ship only aggregate transition statistics with attribution in README + footer, and DIVORAWAVE is a free, non-commercial site — noted in the README so a future commercial turn knows to revisit.
7. **Play/Stop is one toggle button** (prototype behavior), not two buttons (a literal reading of brief §4.1's action list). The approved mockups win.
8. **Sun mask banding**: the *prototype scene* renders 13 px band / 7 px gap; the *Style Tile card* uses 9/5 — ship the prototype's **13/7** (the approved four-state visual wins), scaled with sun diameter.
9. **Piano samples**: default full SplendidGrandPiano load (~19–23 MB) with real progress in the shimmer; if load feel is bad on first use, trim via `notesToLoad` (velocityRange) before considering the lighter Soundfont as default. CDN per brief decision #2; vendoring stays a pre-launch follow-up (§9).
10. **Roman-numeral engine convention is ours, not tonal's** (§3 tonal row): tonal assists parsing; labels/degrees come from the candidate tables + `classify`.
11. **Stereo chorus reconciliation**: brief §8.5 specifies `piano → reverb → subtle stereo chorus → master`, but the review-validated prototype chain (HANDOFF: "keep chain shape") has no chorus at all. Resolution: keep the prototype's frozen dry/wet/analyser topology and constants, and add the brief's chorus as a subtle stage where dry+wet sum before the analyser, with a bypass flag — if it audibly muddies the piano during Phase 3 listening, it ships bypassed and moves to §9 backlog.
12. **Quality-collapse policy for tonal-parsed chords outside the 11-quality Q vocabulary** (the demo rejects `C9`/`C6`/`C7sus4` outright and lossily maps `dim7`→dim): map onto Q where a natural parent exists (9th→matching 7th, 6/m6→triad, dim7→dim, 7sus4→sus4); everything else takes the error-string path. Slightly friendlier than demo parity; pinned by parser tests.
13. **Per-run bus adapted for smplr** (revised during Phase 3 implementation): smplr fixes its output `destination` at construction, and auditions share that single output — so a per-run routing gain is unworkable (disconnecting it after a stop would mute future auditions; connecting the shared output to old + new gains doubles ringing notes). Final wiring: piano → one **permanent** routing gain → FX input; stop = cease scheduling + `piano.stop()` **under** the routing-gain fade (frozen τ .06 — the release tails die inside the closing gain, matching the demo's ring-into-the-faded-bus behavior); the gain stays parked at 0 until the next audition or play restores it. (A timed 400 ms restore was tried first and audibly resurrected release tails — measured in the browser and removed.) Additionally, every note is started with `ampRelease: .07` — the demo's own per-note release τ (piano.js `setTargetAtTime(0, t + dur, .07)`), which smplr's .5 s default had silently changed — so stopped tails die on the demo timescale and the on-demand gain restore (a 5 ms ramp, no step) is inaudible on the chaining and audition-after-stop paths. Same audible stop behavior, one persistent bus.
14. **spell() retained, not replaced** (Phase 2 review): §5's replacement table originally slated the letter-offset speller for a tonal-backed rewrite, but the demo speller's output — including its enharmonic-bailout spellings — is what the approved mockups display and what the golden parity suite pins. Verified demo-identical in all 24 keys. Tonal handles parsing; spelling stays demo-exact.
15. **Chord field names stay `roman`/`func`** (Phase 2 review): brief §6.1 names the fields `romanDegree`/`function`; the port keeps the demo's names so every ported line and the golden-parity field mapping stay verbatim. Semantics identical; renaming would touch all engine code for zero behavioral gain.
16. **play() on an empty deck returns false** (Phase 3 review): the demo scheduled a silent .35 s "run" for an empty deck; our player returns false instead. Phase 4 must disable Play whenever the deck is empty (the prototype's `playDisabled` already requires a non-empty deck), so a false return from play() unambiguously means "blocked on gesture or samples" for the toast logic.
17. **Audio failure degrades, never blocks** (Phase 4 review — the prototype had no audio-failed-with-working-engine state, so this is new behavior): if both sample sources fail, the engine UI stays fully alive (input, key, notation, dial, Conjure, orbs — suggestions and appending all work), Play is disabled, auditions are silently skipped (no misleading gesture toast), and the footer note quietly says `piano samples unavailable — auditions muted`. The Soundfont fallback likewise surfaces as `piano: fallback soundfont` in the footer. Matches the §4.6 "never a blocking error" pattern already used for stats.
18. **Distiller emission policy** (Phase 5, the "distiller is the knob" clause exercised): raw tier-1 statistics put ♭II in the landing top-6 at dial 29 (~1% of corpus songs genuinely open on the Neapolitan) — a deep-shelf chord inside the approved landing feel. The distiller-side fixes, all doc-sanctioned, without touching a single frozen blend constant: (a) **deep-shelf statsIds are excluded as row TARGETS** — the family is spice ≥ .6 **or any '/' secondary** (major V/IV sits at spice .55 and slipped a bare threshold — review catch); the demo consensus table never targets them either; the spice term is by design their only entry path (they remain row *sources*); (b) **Laplace add-k smoothing (k = .02)** per brief §6.3's literal "Laplace-smoothed", lifting the thin real-corpus consensus tail; (c) **targets are filtered to the runtime candidate vocabulary** — out-of-vocab classify labels can never be suggested, wasted row slots, and an all-unreachable row zeroes the stats term under row-level backoff; (d) **corpus order-2 rows sourced from a secondary dominant are deleted** so the §7.5 hand-authored resolution rows govern the normal ≥2-chord flow (the "corpus can't produce V/x" premise was false — classify snaps dom7s to them constantly; review catch, resolution now pinned by tests in both modes). Result (measured, §6.5): landing band clean in both modes, ♭II7 first at 42 (A minor) / 44 (C major). The dial narrative gains a real middle shelf (dorian IV / picardy I at 10–41) the demo never had — corpus reality, kept.
19. **Sample + font vendoring** (post-POC, on Nick's request — the brief §8.2 pre-launch follow-up): the SplendidGrandPiano samples ship first-party in `public/samples/splendid-grand-piano/` (452 files, 41.7 MB — **both** ogg and m4a, because smplr skips ogg entirely on Safari), with the file list extracted from the *installed* smplr bundle's LAYERS table so the vendored set is always exactly what the runtime requests (`tools/vendor-samples.ts`, manifest + completeness test). Fonts (Audiowide, Space Grotesk 400/500/700, Space Mono 400/700; latin + latin-ext subsets, woff2) are vendored into the bundle via `tools/vendor-fonts.ts` → `src/styles/fonts.css`; the Google `<link>`s are gone. The Soundfont *fallback* intentionally stays on its CDN — it only fires if our own origin fails to serve, where a second origin is the whole point. Runtime third-party requests: zero.
20. **Specified-bass voicing** (post-POC, on request — brief §8.3's "bass takes the root **or specified bass**", closing §7.4): a typed slash chord now voices its bass instead of silently reverting to root position.
    - **Key-relative storage.** The bass is stored as `bassInterval` (semitones above the chord root) + `bassLo` (letter distance), never as an absolute pitch class — so a key change transposes the inversion with the chord (A/C♯ in A minor becomes E/G♯ in E minor, verified live) and the spelling stays letter-correct through `spell()`, the same single spelling authority the root uses. Storing an absolute bass would have broken brief §4.2's "the stored progression is the source of truth".
    - **Voicing rule.** `bass = 36 + (bassPc ?? rootPc)`. A dense chord (>3 pcs) sheds one upper *only because the bass doubles it*: root position drops the root — *byte-identical to the demo's `pcs.slice(1)`, since `pcs[0]` IS the root* — and an inversion drops the doubled bass tone instead (Cmaj7/B → uppers C E G). A **foreign** bass doubles nothing, so all four uppers stay (Cmaj7/D keeps its C; dropping the root there made it sound like G6/D — review catch). Brief §8.3 explicitly allows four upper voices. The bass is pinned, not searched; the uppers still voice-lead by min-motion.
    - **Purely additive at the rules layer.** Candidates never carry a bass, so `voice()` returns byte-identical voicings for every suggestion and Conjure sample — the golden parity suite against `mockup/engine.js` passes untouched, and a reviewer proved it exhaustively (3,960 field-by-field comparisons across all qualities × roots × prev-voicings, zero mismatches). *An inverted chord in the deck does change `chain()`'s uppers, so the ≤.006 voice-leading tiebreak can reorder near-ties in the next suggestion — that is the feature working, not a regression.*
    - **Engine unaffected.** `roman`/`statsId`/`semis` stay the parent chord's, so A/C♯ counts as `I` for transitions and ranking; only `name` gains the slash. The deck shows `A/C♯` on one line and `I` on the other, so both facts are always visible.
    - **Spelling reference frame** (review catch, the subtle one): `bassLo` is measured from the root *as actually spelled*, so `chordFrom` must re-derive the bass letter from the spelled root — not from `cls.lo`, which is the pre-spelling letter and diverges wherever `spell()` takes its enharmonic fallback. Getting this wrong printed self-contradictory symbols (an A major triad labelled `A/D♭`) in 24 of 3,168 key×chord combinations. Pinned now by a sweep over all 24 keys asserting the bass letter always sits `bassLo` letters above the displayed root, that the sounding bass matches the printed one, and that every result re-parses losslessly.
    - **Known limitation (backlog).** The bass keeps the demo's fixed octave-2 band (`36 + pc`), so a stepwise bass line resets at each C — e.g. C → C/B → Am/G sounds C2 → B2 → G2. This is inherited, uniform behavior: root-position progressions already leap the same way, and smoothing only the slash case would make inversions behave unlike every other chord. A general bass-register smoother is the right fix and touches frozen demo behavior, so it waits for its own decision (§9).
    - Also fixed here: `chordFrom` was wiping `extensions` on every re-materialization (the §7.12 quality-collapse record was lost each render) and could inherit a stale `bass`/`bassPc` from its input; the now-unused `toDisplayAccidentals` helper was removed rather than left as a footgun.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Corpus skew after auto-widen (Tier 2 is new-wave/synthpop consensus) | Accepted in brief v2 decision #4 — rules layer anchors flavor; distiller prints tier loudly; calibration tests re-run on real stats |
| Key-estimation noise in the distiller pollutes transitions | Krumhansl profile is standard; drop low-confidence songs (margin threshold) before counting; provenance records the drop rate |
| smplr CDN availability / rate limiting | `CacheStorage` in dev; Soundfont fallback path; vendoring follow-up (§9) |
| Sample load weight (~20 MB) hurts first-run | Progress-driven shimmer; `notesToLoad` trim option (§7.9) |
| Neon contrast regressions during UI build | Tokens contrast table is the checklist; the two derived text tints + ink-on-bright rule are load-bearing; Phase 5 audit |
| Frozen-constant drift during the port | Golden tests against demo fixture pin every constant before any refactor |
| Scope creep | Brief §2 non-goals list is the contract: no loop playback, no "why" UI, no extra genres/instruments, no export/save/share, no Claude-API layer |

## 9. Backlog (explicitly deferred — do not build in POC)

~~Sample + font vendoring into `public/`~~ **done post-POC on Nick's request (§7.19)** · ~~specified-bass voicing~~ **done post-POC (§7.20)** · seeded-RNG easter egg (rng is already injectable) · **bass-register smoothing** — pick each chord's bass octave to minimize motion from the previous bass, so stepwise lines (C → C/B → Am/G) don't reset at every C; must apply to root-position chords too, so it changes frozen demo behavior and needs a decision (§7.20) · bass+pad layers, genre packs (data-file drop architecture is already honored by stats-as-JSON) · MIDI/WAV export, saving, sharing · mobile-first polish · theory "why" surface (reasons are recorded from Phase 2).

## 10. Working agreements

- Each phase = one or more PRs; CI green before merge; `main` is always deployable.
- `mockup/` is immutable reference material — never edited, never imported by app code.
- Any change to a frozen constant (§5) requires a PLAN.md edit with justification, because the golden tests will fail loudly.
- Commits reference the plan phase (e.g. `feat(engine): port blend + conjure [phase 2]`).
