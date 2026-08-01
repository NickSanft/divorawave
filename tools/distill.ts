/** DIVORAWAVE corpus distiller (PLAN.md Phase 5.1, brief §7) — build-time only.
 *
 *  Run manually: `npm run distill` (tsx). Reads the Chordonomicon CSV from
 *  tools/.cache/ (downloaded separately, never committed), filters by the tiered
 *  genre regex, normalizes each song to statsId sequences via the SAME theory code
 *  the app ships (parseName → classify snap), estimates keys with a Krumhansl
 *  profile match, counts order-2/order-1/unigram transitions plus the START opener
 *  distribution, and emits public/data/synthwave.transitions.json with provenance.
 *  Prints its tier and row counts loudly on every run (brief §7 requirement);
 *  Tier 3 requires an explicit --allow-tier3 flag — never a silent fallback.
 */
import { createReadStream, existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { makeKey, type Key, parseName } from '../src/theory/chords.ts'
import { candidates } from '../src/engine/rules.ts'
import {
  countSong, emitMode, emptyModeCounts, estimateKey, isSectionMarker,
  normalizeToken, parseCsvLine, SECONDARY_ROWS, EMIT_DEFAULTS, type ModeCounts,
} from './core.ts'

/** Deep-shelf statsIds per mode: excluded as row TARGETS — the demo consensus table
 *  never targets them; the spice term is their entry path. The family is spice ≥ .6
 *  OR any secondary dominant ('/' in the statsId) — major V/IV sits at spice .55 and
 *  would otherwise slip under a bare threshold (Phase 5 review). */
function spiceShelf(mode: 'minor' | 'major'): Set<string> {
  return new Set(
    candidates(makeKey('C', mode))
      .filter(c => c.spice >= .6 || c.statsId.includes('/'))
      .map(c => c.statsId),
  )
}

/** Runtime-reachable TARGET vocabulary per mode: the candidate statsIds. Corpus
 *  targets outside it (classify-synthesized romans like 'IVmaj7') can never be
 *  suggested — as targets they only waste row slots and, worse, an all-unreachable
 *  row zeroes the stats term entirely under row-level backoff (Phase 5 review).
 *  Row SOURCES stay open: typed chords reach them via the same classify snap. */
function targetVocabulary(mode: 'minor' | 'major'): Set<string> {
  return new Set(candidates(makeKey('C', mode)).map(c => c.statsId))
}

const CSV_PATH = new URL('./.cache/chordonomicon_v2.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT_PATH = new URL('../public/data/synthwave.transitions.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const TIER1 = /synthwave|darksynth|outrun|spacewave|vaporwave|chillwave|darkwave|dark wave/i
// 'new wave(?! of )' keeps out the 'new wave of <metal>' family (measured: 58 rows)
const TIER2_EXTRA = /synthpop|new romantic|new wave(?! of )|permanent wave|electropop|italo disco|nu disco/i
const TIER3 = /electro|synth|wave|disco|dance/i
const MIN_USABLE_SONGS = 300
const KEY_MARGIN_MIN = 0.02
const MIN_MAPPED_CHORDS = 4

interface Row { chords: string; genres: string; decade: number | null }

async function collectRows(): Promise<{ tier1: Row[]; tier2Extra: Row[]; tier3: Row[]; total: number }> {
  const tier1: Row[] = []
  const tier2Extra: Row[] = []
  const tier3: Row[] = []
  let total = 0
  const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: 'utf8' }), crlfDelay: Infinity })
  let header: string[] | null = null
  let iChords = 1, iGenres = 3, iDecade = 4
  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line)
      iChords = header.indexOf('chords')
      iGenres = header.indexOf('genres')
      iDecade = header.indexOf('decade')
      if (iChords < 0 || iGenres < 0) throw new Error(`unexpected CSV header: ${line.slice(0, 200)}`)
      continue
    }
    total++
    // cheap prefilter on the raw line before the full CSV parse
    if (!TIER1.test(line) && !TIER2_EXTRA.test(line) && !TIER3.test(line)) continue
    const cols = parseCsvLine(line)
    const genres = cols[iGenres] ?? ''
    if (!genres) continue
    const row: Row = {
      chords: cols[iChords] ?? '',
      genres,
      decade: cols[iDecade] ? Number(cols[iDecade]) : null,
    }
    if (TIER1.test(genres)) tier1.push(row)
    else if (TIER2_EXTRA.test(genres)) tier2Extra.push(row)
    else if (TIER3.test(genres) && row.decade !== null && row.decade >= 1980 && row.decade < 1990) tier3.push(row)
  }
  return { tier1, tier2Extra, tier3, total }
}

interface SongStats {
  used: number
  droppedParse: number
  droppedMargin: number
  tokensSkipped: number
  tokensTotal: number
  minorSongs: number
  majorSongs: number
}

function processSongs(rows: Row[], counts: { minor: ModeCounts; major: ModeCounts }): SongStats {
  const stats: SongStats = { used: 0, droppedParse: 0, droppedMargin: 0, tokensSkipped: 0, tokensTotal: 0, minorSongs: 0, majorSongs: 0 }
  const cRef: Key = makeKey('C', 'major')
  const pcMemo = new Map<string, { rootPc: number; ints: readonly number[] } | null>()
  const idMemo = new Map<string, string | null>()

  for (const row of rows) {
    const rawTokens = row.chords.split(/\s+/).filter(Boolean)
    const tokens: string[] = []
    const sectionStarts = new Set<number>([0])
    for (const t of rawTokens) {
      if (isSectionMarker(t)) { sectionStarts.add(tokens.length); continue }
      tokens.push(normalizeToken(t))
    }
    stats.tokensTotal += tokens.length

    // pass 1: pitch-class histogram (key-independent — rootPc/ints don't depend on key)
    const hist = new Array<number>(12).fill(0)
    let parsed = 0
    for (const t of tokens) {
      let pcs = pcMemo.get(t)
      if (pcs === undefined) {
        const ch = parseName(t, cRef)
        pcs = ch ? { rootPc: ch.rootPc, ints: ch.ints } : null
        pcMemo.set(t, pcs)
      }
      if (!pcs) { stats.tokensSkipped++; continue }
      parsed++
      for (const i of pcs.ints) hist[(pcs.rootPc + i) % 12]!++
    }
    if (parsed < MIN_MAPPED_CHORDS) { stats.droppedParse++; continue }

    const est = estimateKey(hist)
    if (est.margin < KEY_MARGIN_MIN) { stats.droppedMargin++; continue }
    const keyName = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][est.pc]!
    const key = makeKey(keyName, est.mode)

    // pass 2: statsId sequence in the estimated key, consecutive duplicates collapsed
    const ids: string[] = []
    const starts: number[] = []
    for (let t = 0; t < tokens.length; t++) {
      const memoKey = `${tokens[t]}|${est.pc}|${est.mode}`
      let id = idMemo.get(memoKey)
      if (id === undefined) {
        const ch = parseName(tokens[t]!, key)
        id = ch ? ch.statsId : null
        idMemo.set(memoKey, id)
      }
      if (id === null) continue
      if (ids.length && ids[ids.length - 1] === id) {
        if (sectionStarts.has(t)) starts.push(ids.length - 1)
        continue
      }
      if (sectionStarts.has(t)) starts.push(ids.length)
      ids.push(id)
    }
    if (ids.length < MIN_MAPPED_CHORDS) { stats.droppedParse++; continue }

    countSong(counts[est.mode], ids, starts)
    stats.used++
    if (est.mode === 'minor') stats.minorSongs++
    else stats.majorSongs++
  }
  return stats
}

async function main(): Promise<void> {
  if (!existsSync(CSV_PATH)) {
    console.error(`✗ dataset not found at ${CSV_PATH}`)
    console.error('  download it first (never committed — tools/.cache/ is gitignored):')
    console.error('  https://huggingface.co/datasets/ailsntua/Chordonomicon/resolve/main/chordonomicon_v2.csv')
    process.exit(1)
  }
  console.log('─'.repeat(64))
  console.log('DIVORAWAVE distiller — Chordonomicon → synthwave.transitions.json')
  console.log('─'.repeat(64))
  const { tier1, tier2Extra, tier3, total } = await collectRows()
  console.log(`scanned ${total.toLocaleString()} rows`)
  console.log(`tier 1 (wave-core):      ${tier1.length.toLocaleString()} rows`)
  console.log(`tier 2 (wave-adjacent): +${tier2Extra.length.toLocaleString()} rows`)
  console.log(`tier 3 (80s electronic): ${tier3.length.toLocaleString()} rows`)

  const attempt = (rows: Row[], tierLabel: string, tierNum: number) => {
    const counts = { minor: emptyModeCounts(), major: emptyModeCounts() }
    const stats = processSongs(rows, counts)
    console.log(`\n[tier ${tierNum}: ${tierLabel}] usable songs: ${stats.used}` +
      ` (dropped: ${stats.droppedParse} parse, ${stats.droppedMargin} key-margin;` +
      ` tokens skipped: ${stats.tokensSkipped}/${stats.tokensTotal})` +
      ` · minor ${stats.minorSongs} / major ${stats.majorSongs}`)
    return { counts, stats }
  }

  let tierUsed = 1
  let { counts, stats } = attempt(tier1, 'wave-core', 1)
  if (stats.used < MIN_USABLE_SONGS) {
    console.log(`\n⚠ tier 1 below the ${MIN_USABLE_SONGS}-song threshold — WIDENING to tier 2 (brief §7)`)
    tierUsed = 2
    ;({ counts, stats } = attempt([...tier1, ...tier2Extra], 'wave-core + adjacent', 2))
  }
  if (stats.used < MIN_USABLE_SONGS) {
    if (!process.argv.includes('--allow-tier3')) {
      console.error(`\n✗ tier 2 still below ${MIN_USABLE_SONGS} usable songs.`)
      console.error('  Tier 3 (1980s electronic-adjacent) must be EXPLICIT: rerun with --allow-tier3')
      process.exit(1)
    }
    console.log('\n⚠⚠ WIDENING to tier 3 (1980s electronic-adjacent) — explicitly allowed')
    tierUsed = 3
    ;({ counts, stats } = attempt([...tier1, ...tier2Extra, ...tier3], 'all tiers', 3))
  }

  const minor = emitMode(counts.minor, { ...EMIT_DEFAULTS, excludeTargets: spiceShelf('minor'), vocabulary: targetVocabulary('minor') })
  const major = emitMode(counts.major, { ...EMIT_DEFAULTS, excludeTargets: spiceShelf('major'), vocabulary: targetVocabulary('major') })
  // §7.5: hand-authored secondary-dominant resolution rows layer over the distill.
  // Corpus order-2 rows sourced FROM a secondary would shadow them under row-level
  // backoff (the runtime prefers order2) — delete those so the hand rows govern
  // resolution in the normal ≥2-chord flow (Phase 5 review).
  for (const [k, v] of Object.entries(SECONDARY_ROWS.minor)) minor.order1[k] = v
  for (const [k, v] of Object.entries(SECONDARY_ROWS.major)) major.order1[k] = v
  for (const key of Object.keys(minor.order2)) {
    if (key.split('|')[1]! in SECONDARY_ROWS.minor) delete minor.order2[key]
  }
  for (const key of Object.keys(major.order2)) {
    if (key.split('|')[1]! in SECONDARY_ROWS.major) delete major.order2[key]
  }

  const table = {
    version: 1,
    provenance: {
      source: 'ailsntua/Chordonomicon',
      license: 'CC-BY-NC-4.0',
      note: 'Aggregate transition statistics only — no song data. Distilled by tools/distill.ts; secondary-dominant resolution rows are hand-authored (PLAN §7.5); deep-shelf statsIds (spice ≥ .6) are excluded as row targets and rows are Laplace add-k smoothed (PLAN §7.18).',
      generated_at: new Date().toISOString().slice(0, 10),
      filter_tier: tierUsed,
      rows_matched: tier1.length + (tierUsed >= 2 ? tier2Extra.length : 0) + (tierUsed >= 3 ? tier3.length : 0),
      songs_used: stats.used,
      songs_minor: stats.minorSongs,
      songs_major: stats.majorSongs,
      dropped_parse: stats.droppedParse,
      dropped_key_margin: stats.droppedMargin,
      emit: EMIT_DEFAULTS,
    },
    minor,
    major,
  }
  const json = JSON.stringify(table, null, 1)
  writeFileSync(OUT_PATH, json + '\n', 'utf8')
  console.log(`\n✓ emitted ${OUT_PATH}`)
  console.log(`  ${(json.length / 1024).toFixed(1)} KB · tier ${tierUsed} · ${stats.used} songs` +
    ` · minor rows: start ${Object.keys(minor.start).length}, o1 ${Object.keys(minor.order1).length}, o2 ${Object.keys(minor.order2).length}` +
    ` · major rows: start ${Object.keys(major.start).length}, o1 ${Object.keys(major.order1).length}, o2 ${Object.keys(major.order2).length}`)
  console.log('─'.repeat(64))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
