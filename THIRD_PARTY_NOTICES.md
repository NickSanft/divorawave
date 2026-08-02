# Third-party notices

DIVORAWAVE's own code is MIT-licensed (see [LICENSE](LICENSE)). The repository
additionally redistributes the following third-party assets, vendored so the
deployed site serves everything first-party.

## Fonts (SIL Open Font License 1.1)

Vendored as woff2 subsets in `src/assets/fonts/` (regenerate: `npm run vendor:fonts`):

- **Audiowide** — Copyright © Astigmatic (AOETI)
- **Space Grotesk** — Copyright © 2020 The Space Grotesk Project Authors (Florian Karsten)
- **Space Mono** — Copyright © 2016 Google Inc. (designed by Colophon Foundry)

All three are licensed under the **SIL Open Font License, Version 1.1**. The
full license text is available at <https://openfontlicense.org> and alongside
each family on Google Fonts. Per the OFL, the fonts are used and redistributed
here unmodified apart from standard woff2 subsetting; they are not sold
separately, and their names are not used to promote this software.

## Piano samples

`public/samples/splendid-grand-piano/` (452 files; regenerate:
`npm run vendor:samples`) redistributes, unmodified, the **Splendid Grand
Piano** sample set as published by the
[smpldsnds mirror](https://github.com/smpldsnds/sfzinstruments-splendid-grand-piano)
of the [SFZ Instruments](https://sfzinstruments.github.io/) project — the same
set the [smplr](https://github.com/danigb/smplr) library loads by default from
that mirror's public CDN. See those repositories for the sample set's licensing
and provenance details.

## Data

Corpus statistics in `public/data/synthwave.transitions.json` are *aggregate
transition probabilities* derived from the
[Chordonomicon dataset](https://huggingface.co/datasets/ailsntua/Chordonomicon)
(CC-BY-NC-4.0); no song data is redistributed. Full citation in
[README.md](README.md).
