/** Shared test helpers — seeded RNG and the interim demo-stats table. */
import { createStats, type TransitionTable } from '../engine/stats.ts'
import table from '../../public/data/synthwave.transitions.json'

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

export const demoTable = table as TransitionTable

/** Stats built from the committed interim JSON (the demo STATS in shipped-schema form). */
export const demoStats = createStats(demoTable)
