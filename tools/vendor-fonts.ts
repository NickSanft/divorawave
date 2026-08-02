/** Vendor the three product fonts into the bundle (PLAN §9 follow-up): fetches the
 *  same Google css2 stylesheet the mockups link, keeps the latin + latin-ext
 *  subsets, downloads the woff2 files into src/assets/fonts/, and emits
 *  src/styles/fonts.css with relative url()s so Vite fingerprints and
 *  base-prefixes them. Idempotent; run via `npm run vendor:fonts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const FONTS_DIR = fileURLToPath(new URL('../src/assets/fonts', import.meta.url))
const CSS_OUT = fileURLToPath(new URL('../src/styles/fonts.css', import.meta.url))

const CSS2_URL =
  'https://fonts.googleapis.com/css2?family=Audiowide&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap'
/** a modern-browser UA makes Google return woff2 sources */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const KEEP_SUBSETS = new Set(['latin', 'latin-ext'])

export interface FontFace {
  subset: string
  family: string
  style: string
  weight: string
  url: string
  unicodeRange: string
}

/** Parse Google's css2 response: subset comments (`/* latin *​/`) followed by @font-face blocks. */
export function parseCss2(css: string): FontFace[] {
  const faces: FontFace[] = []
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g
  for (const m of css.matchAll(re)) {
    const subset = m[1]!
    const body = m[2]!
    const get = (prop: string): string => body.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1]?.trim() ?? ''
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1] ?? ''
    faces.push({
      subset,
      family: get('font-family').replace(/['"]/g, ''),
      style: get('font-style'),
      weight: get('font-weight'),
      url,
      unicodeRange: get('unicode-range'),
    })
  }
  return faces
}

export const fontFileName = (f: FontFace): string =>
  `${f.family.toLowerCase().replace(/\s+/g, '-')}-${f.weight}-${f.subset}.woff2`

async function main(): Promise<void> {
  const res = await fetch(CSS2_URL, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`css2 fetch failed: HTTP ${res.status}`)
  const faces = parseCss2(await res.text()).filter(f => KEEP_SUBSETS.has(f.subset))
  if (!faces.length) throw new Error('no latin/latin-ext @font-face blocks parsed — did the css2 format change?')
  mkdirSync(FONTS_DIR, { recursive: true })
  const blocks: string[] = []
  for (const f of faces) {
    if (!f.url) throw new Error(`no woff2 url for ${f.family} ${f.weight} ${f.subset} — UA sniffing changed?`)
    const file = fontFileName(f)
    const buf = Buffer.from(await (await fetch(f.url)).arrayBuffer())
    writeFileSync(`${FONTS_DIR}/${file}`, buf)
    console.log(`  ${file} · ${(buf.length / 1024).toFixed(1)} KB`)
    blocks.push(
      `/* ${f.family} ${f.weight} — ${f.subset} */\n` +
      `@font-face {\n` +
      `  font-family: '${f.family}';\n` +
      `  font-style: ${f.style};\n` +
      `  font-weight: ${f.weight};\n` +
      `  font-display: swap;\n` +
      `  src: url('../assets/fonts/${file}') format('woff2');\n` +
      `  unicode-range: ${f.unicodeRange};\n` +
      `}\n`,
    )
  }
  const header =
    `/* DIVORAWAVE fonts — vendored first-party (PLAN §7.19; regenerate: npm run vendor:fonts).\n` +
    `   Same faces/weights the Phase A mockups load, latin + latin-ext subsets, woff2 only.\n` +
    `   Vite fingerprints the relative url()s and applies the Pages base path. */\n\n`
  writeFileSync(CSS_OUT, header + blocks.join('\n'), 'utf8')
  console.log(`✓ ${faces.length} @font-face blocks → src/styles/fonts.css`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
