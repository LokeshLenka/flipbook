import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: No React StrictMode here on purpose. The legacy 3D engine performs
// async DOM init (template fetch, then appends canvases/toolbars). StrictMode's
// dev-only mount → unmount → remount lets the first instance's async completion
// append a zombie copy of the legacy chrome (bottom bar, toolbox) that no
// cleanup can catch. A single mount keeps exactly one engine instance alive.
createRoot(document.getElementById('root')!).render(<App />)
