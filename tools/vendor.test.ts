/** Vendoring guards (PLAN §7.19): the shipped sample set must cover exactly what
 *  the installed smplr version will request, and the vendored fonts must back
 *  every @font-face the stylesheet declares. Lives in tools/ (node-typed world,
 *  outside the app's tsc program); vitest picks it up by its default glob.
 *  NOTE: sample names contain '#' — paths are joined as plain strings, never via
 *  new URL(), which would truncate at the fragment. */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractSampleNames, FORMATS } from './vendor-samples.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const p = (...rel: string[]): string => join(root, ...rel)

describe('vendored piano samples', () => {
  const names = extractSampleNames(readFileSync(p('node_modules', 'smplr', 'dist', 'index.mjs'), 'utf8'))

  it('the smplr LAYERS table still parses to a plausible sample list', () => {
    expect(names.length).toBeGreaterThanOrEqual(200)
    expect(names).toContain('PP C4')
    expect(names.some(n => n.includes('#'))).toBe(true) // sharp names — the %23 fetch path
  })

  it('every sample smplr can request exists on disk in both formats, non-empty', () => {
    for (const name of names) {
      for (const fmt of FORMATS) {
        const file = p('public', 'samples', 'splendid-grand-piano', `${name}.${fmt}`)
        expect(existsSync(file), `${name}.${fmt} missing`).toBe(true)
        expect(statSync(file).size, `${name}.${fmt} empty`).toBeGreaterThan(0)
      }
    }
  })

  it('the manifest matches the sample list, and every on-disk size matches its recorded bytes', () => {
    const manifest = JSON.parse(readFileSync(p('public', 'samples', 'splendid-grand-piano', 'manifest.json'), 'utf8'))
    expect(manifest.sampleNames).toBe(names.length)
    expect(manifest.fileCount).toBe(names.length * FORMATS.length)
    expect(manifest.files.length).toBe(manifest.fileCount)
    // torn/corrupted files can't hide behind a size>0 check — bytes must match exactly
    for (const f of manifest.files as Array<{ file: string; bytes: number }>) {
      expect(statSync(p('public', 'samples', 'splendid-grand-piano', f.file)).size, `${f.file} size drift`).toBe(f.bytes)
    }
  })
})

describe('vendored fonts', () => {
  const css = readFileSync(p('src', 'styles', 'fonts.css'), 'utf8')

  it('every declared woff2 exists, and all product faces/weights are covered', () => {
    const refs = [...css.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map(m => m[1]!)
    expect(refs.length).toBeGreaterThanOrEqual(10)
    for (const ref of refs) {
      const file = p('src', 'assets', 'fonts', ref)
      expect(existsSync(file), `${ref} missing`).toBe(true)
      expect(statSync(file).size, `${ref} empty`).toBeGreaterThan(0)
    }
    for (const face of ['audiowide-400', 'space-grotesk-400', 'space-grotesk-500', 'space-grotesk-700', 'space-mono-400', 'space-mono-700']) {
      expect(refs.some(r => r.startsWith(face)), `${face} not declared`).toBe(true)
    }
  })

  it('no third-party font origin remains in the page shell', () => {
    const html = readFileSync(p('index.html'), 'utf8')
    expect(html.includes('fonts.googleapis.com')).toBe(false)
    expect(html.includes('gstatic')).toBe(false)
  })
})
