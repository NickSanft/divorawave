import { render } from 'preact'
import './styles/tokens.css'
import './styles/app.css'
import { App } from './ui/App.tsx'

render(<App />, document.getElementById('app')!)
