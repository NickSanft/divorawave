/** Stats backoff + degradation tests (brief §6.3, §4.6). */
import { describe, expect, it } from 'vitest'
import { createStats, loadStats, rulesOnlyStats, type TransitionTable } from './stats.ts'
import { demoStats, demoTable, shippedStats, shippedTable } from '../test/helpers.ts'

const tiny: TransitionTable = {
  version: 1,
  minor: {
    start: { i: .5, '♭VI': .2 },
    order1: { i: { '♭VI': .4, iv: .1 }, '♭VII': { i: .35 } },
    order2: { '♭VI|♭VII': { i: .9 } },
    unigram: { i: .3, '♭VI': .15 },
  },
  major: { start: { I: .5 }, order1: { I: { IV: .2 } } },
}

describe('createStats — row-level order-2 → order-1 → unigram backoff', () => {
  const s = createStats(tiny)

  it('uses start for the empty deck', () => {
    expect(s.p('minor', 'i')).toBe(.5)
    expect(s.p('minor', 'V')).toBe(0)
  })

  it('prefers the order-2 row when (prev2, prev1) matches', () => {
    expect(s.p('minor', 'i', '♭VII', '♭VI')).toBe(.9)
  })

  it('order-2 row is authoritative once matched: missing next yields 0, no fall-through', () => {
    expect(s.p('minor', 'iv', '♭VII', '♭VI')).toBe(0)
  })

  it('falls back to order-1 when no order-2 row exists', () => {
    expect(s.p('minor', '♭VI', 'i', 'v')).toBe(.4)
    expect(s.p('minor', '♭VI', 'i')).toBe(.4) // no prev2 at all
  })

  it('falls back to unigram only when no row exists for prev1', () => {
    expect(s.p('minor', 'i', 'UNKNOWN')).toBe(.3)
    expect(s.p('minor', 'V', 'UNKNOWN')).toBe(0)
  })

  it('yields 0 for unknown rows when unigram is absent (demo parity — the fixture shape)', () => {
    expect(demoStats.p('minor', 'i', 'NO-SUCH-ROW')).toBe(0)
    expect(demoTable.minor.order2).toBeUndefined()
    expect(demoTable.minor.unigram).toBeUndefined()
  })
})

describe('the demo FIXTURE matches the demo STATS values (golden-parity substrate)', () => {
  it('spot-checks rows and start distributions', () => {
    expect(demoStats.p('minor', 'i')).toBe(.34)
    expect(demoStats.p('minor', '♭VI', 'i')).toBe(.24)
    expect(demoStats.p('minor', 'i', 'V')).toBe(.52)
    expect(demoStats.p('minor', '♭III', 'V/♭III')).toBe(.6)
    expect(demoStats.p('major', 'I')).toBe(.3)
    expect(demoStats.p('major', 'I', 'V')).toBe(.4)
    expect(demoStats.p('major', 'ii', 'V/ii')).toBe(.6)
  })
})

describe('the SHIPPED transitions table', () => {
  it('has the required shape, provenance, and the §7.5 secondary-dominant rows', () => {
    expect(shippedTable.version).toBe(1)
    expect(shippedTable.provenance).toBeTruthy()
    for (const mode of ['minor', 'major'] as const) {
      expect(Object.keys(shippedTable[mode].start).length).toBeGreaterThan(0)
      expect(Object.keys(shippedTable[mode].order1).length).toBeGreaterThan(0)
    }
    expect(shippedStats.p('minor', '♭III', 'V/♭III')).toBe(.6)
    expect(shippedStats.p('major', 'ii', 'V/ii')).toBe(.6)
    // every probability is sane
    for (const mode of ['minor', 'major'] as const) {
      for (const row of [shippedTable[mode].start, ...Object.values(shippedTable[mode].order1)]) {
        for (const v of Object.values(row)) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1) }
      }
    }
  })
})

describe('degradation (§4.6)', () => {
  it('rulesOnlyStats returns 0 everywhere with the rules-only flag', () => {
    expect(rulesOnlyStats.status).toBe('rules-only')
    expect(rulesOnlyStats.p('minor', 'i')).toBe(0)
    expect(rulesOnlyStats.p('minor', 'i', 'i', 'i')).toBe(0)
  })

  it('loadStats: valid JSON → ready', async () => {
    const url = 'data:application/json,' + encodeURIComponent(JSON.stringify(tiny))
    const s = await loadStats(url)
    expect(s.status).toBe('ready')
    expect(s.p('minor', 'i')).toBe(.5)
  })

  it('loadStats: parse failure or malformed shape → rules-only, never a throw', async () => {
    expect((await loadStats('data:application/json,notjson')).status).toBe('rules-only')
    expect((await loadStats('data:application/json,' + encodeURIComponent('{"version":1}'))).status).toBe('rules-only')
  })
})
