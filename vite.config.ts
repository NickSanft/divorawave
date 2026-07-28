/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  // project page at https://nicksanft.github.io/divorawave/
  base: '/divorawave/',
  test: {
    // node is the default environment (engine/theory tests);
    // UI test files opt into jsdom with a `// @vitest-environment jsdom` docblock
  },
})
