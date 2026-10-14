import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  // debug handle for automated playtests; stripped from production builds
  void Promise.all([import('./store'), import('./game/world')]).then(([store, world]) => {
    ;(window as unknown as Record<string, unknown>).__noah = { useGame: store.useGame, world }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
