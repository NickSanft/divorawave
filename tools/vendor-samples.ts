/** Vendor the SplendidGrandPiano samples into public/samples/ (PLAN §9 follow-up,
 *  brief §8.2) so GitHub Pages serves everything first-party.
 *
 *  The sample list is extracted from the INSTALLED smplr bundle's LAYERS table —
 *  self-synchronizing: we vendor exactly what this smplr version will request
 *  (`${baseUrl}/${name}.${format}`; smplr percent-encodes '#' and spaces at fetch
 *  time, and static hosts decode them back to the literal filenames we save).
 *  Both formats ship: ogg (Chrome/Firefox) and m4a (Safari skips ogg entirely —
 *  smplr's findFirstSupportedFormat). Idempotent; run via `npm run vendor:samples`.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SMPLR_BUNDLE = fileURLToPath(new URL('../node_modules/smplr/dist/index.mjs', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/samples/splendid-grand-piano', import.meta.url))
const CDN = 'https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples'
export const FORMATS = ['ogg', 'm4a'] as const

/** Pull the unique sample names out of smplr's embedded LAYERS table. */
export function extractSampleNames(bundleText: string): string[] {
  const start = bundleText.indexOf('var LAYERS = [')
  if (start < 0) throw new Error('LAYERS table not found in the smplr bundle — did smplr change?')
  const end = bundleText.indexOf('\n];', start)
  if (end < 0) throw new Error('LAYERS table end not found')
  const block = bundleText.slice(start, end)
  const names = new Set<string>()
  for (const m of block.matchAll(/\[\s*\d+\s*,\s*"([^"]+)"\s*\]/g)) names.add(m[1]!)
  if (names.size < 100) throw new Error(`suspiciously few sample names (${names.size}) — parser drift?`)
  return [...names].sort()
}

/** Streams to `${dest}.part`, then renames into place — an interrupted run can
 *  never leave a truncated file that later runs would skip as complete. */
async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  const part = `${dest}.part`
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(part))
  const expected = Number(res.headers.get('content-length') ?? -1)
  const actual = statSync(part).size
  if (expected >= 0 && actual !== expected) throw new Error(`short read for ${url}: ${actual}/${expected} bytes`)
  renameSync(part, dest)
  return actual
}

async function main(): Promise<void> {
  const names = extractSampleNames(readFileSync(SMPLR_BUNDLE, 'utf8'))
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`vendoring ${names.length} samples × ${FORMATS.length} formats from the smplr LAYERS table`)
  const jobs: Array<{ name: string; fmt: string }> = []
  for (const name of names) for (const fmt of FORMATS) jobs.push({ name, fmt })
  const files: Array<{ file: string; bytes: number }> = []
  let done = 0
  let skipped = 0
  const workers = Array.from({ length: 8 }, async () => {
    while (jobs.length) {
      const job = jobs.pop()!
      const file = `${job.name}.${job.fmt}`
      const dest = `${OUT_DIR}/${file}`
      if (existsSync(dest) && statSync(dest).size > 0) {
        files.push({ file, bytes: statSync(dest).size })
        skipped++
      } else {
        const url = `${CDN}/${encodeURIComponent(job.name)}.${job.fmt}`
        let bytes = 0
        for (let attempt = 1; ; attempt++) {
          try { bytes = await download(url, dest); break } catch (e) {
            if (attempt >= 3) throw e
            await new Promise(r => setTimeout(r, 500 * attempt))
          }
        }
        files.push({ file, bytes })
      }
      done++
      if (done % 50 === 0) console.log(`  ${done}/${names.length * FORMATS.length}`)
    }
  })
  await Promise.all(workers)
  files.sort((a, b) => a.file.localeCompare(b.file))
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0)
  const manifest = {
    source: CDN,
    note: 'SplendidGrandPiano samples (smpldsnds/sfzinstruments-splendid-grand-piano) vendored first-party per PLAN §7.19; list extracted from the installed smplr LAYERS table.',
    generated_at: new Date().toISOString().slice(0, 10),
    sampleNames: names.length,
    formats: FORMATS,
    fileCount: files.length,
    totalBytes,
    files,
  }
  writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 1) + '\n', 'utf8')
  console.log(`✓ ${files.length} files (${skipped} already present) · ${(totalBytes / 1048576).toFixed(1)} MB · manifest written`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
