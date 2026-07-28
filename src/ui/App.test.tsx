// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/preact'
import { App } from './App.tsx'

/* Phase 1 placeholder test — proves the vitest + jsdom + testing-library pipeline.
   Real engine/UI suites land in Phases 2–4. */
describe('App (phase 1 placeholder)', () => {
  it('renders the wordmark and the loading line', () => {
    const { getByRole, getByText } = render(<App />)
    expect(getByRole('img', { name: 'DIVORAWAVE' })).toBeTruthy()
    expect(getByText('tuning the ether…')).toBeTruthy()
  })
})
