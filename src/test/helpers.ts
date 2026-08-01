/** Shared test helpers — seeded RNG, the frozen demo-stats FIXTURE (golden parity
 *  against mockup/engine.js), and the SHIPPED transitions table (calibration +
 *  conjure constraints must hold on whatever actually ships). */
import { createStats, type TransitionTable } from '../engine/stats.ts'
import demoFixture from './demo.transitions.json'
import shipped from '../../public/data/synthwave.transitions.json'

/** mulberry32 — tiny deterministic PRNG for conjure tests (the injectable rng seam). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The demo STATS in shipped-schema form — a frozen FIXTURE (src/test/), because
 *  golden parity is against the demo engine regardless of what ships. */
export const demoTable = demoFixture as TransitionTable
export const demoStats = createStats(demoTable)

/** Whatever public/data/synthwave.transitions.json currently ships (the Phase 5
 *  distill once it lands) — calibration and conjure constraints run on THIS. */
export const shippedTable = shipped as TransitionTable
export const shippedStats = createStats(shippedTable)
