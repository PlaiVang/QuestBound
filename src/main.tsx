import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installDiagnostics, diagnostics } from './diagnostics/recorder'

installDiagnostics()
createRoot(document.getElementById('root')!, { onUncaughtError: () => diagnostics.record('app.error') }).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
