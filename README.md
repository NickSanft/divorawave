# D I V O R A W A V E

*progressions condensed from the ether*

A static single-page web app that helps songwriters conjure synthwave chord progressions. Press **Conjure** for a loop-shaped 4- or 8-chord progression, or type the chords you already have and watch six ranked next-chord suggestions condense out of a vaporwave dreamscape — each one instantly audible on a real piano soundfont. A hybrid engine (music-theory rules for candidates, real-song statistics for ranking) powers both, with an **Adventurousness** dial that slides suggestions from FM RADIO toward the DEEP ETHER.

Pure HTML/CSS/JS after a Vite build · deploys to GitHub Pages · no backend, no accounts, no API keys.

## Status

- **Phase A (design):** complete — style tile, binding design tokens, motion spec, and a live hi-fi prototype live in [`mockup/`](mockup/).
- **Phase B (build):** in progress, following [`PLAN.md`](PLAN.md).

## Development

Coming in Phase 1 (Vite + Preact + TypeScript + Vitest). Until then, the prototype in `mockup/` is the reference implementation.

## Data & credits

- Corpus statistics are distilled at build time from the **Chordonomicon** dataset ([`ailsntua/Chordonomicon`](https://huggingface.co/datasets/ailsntua/Chordonomicon), CC-BY-NC-4.0). Only aggregate transition statistics ship with the app — no song data.

  > Kantarelis, S., Thomas, K., Lyberatos, V., Dervakos, E., & Stamou, G. (2024). *CHORDONOMICON: A Dataset of 666,000 Songs and their Chord Progressions.* arXiv:2410.22046.

- Piano: [smplr](https://github.com/danigb/smplr) · Music theory: [tonal](https://github.com/tonaljs/tonal).
- All visuals are original, generated CSS/SVG — vaporwave the language, not any specific artwork.

## License

MIT for the code in this repository (see [LICENSE](LICENSE)). The Chordonomicon dataset itself is CC-BY-NC-4.0 — this project is free and non-commercial; a future commercial use would need to revisit that dependency.
