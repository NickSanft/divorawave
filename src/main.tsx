import { render } from 'preact'
import './styles/tokens.css'
import './styles/app.css'
import { App } from './ui/App.tsx'

render(<App />, document.getElementById('app')!)

// dev-only audio harness (?audio) — dead-code-eliminated from production builds
if (import.meta.env.DEV && new URLSearchParams(location.search).has('audio')) {
  void import('./dev/audio-harness.ts').then(m => m.mountAudioHarness())
}
