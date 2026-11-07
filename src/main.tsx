import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Debug handles for automated tests (development builds only).
if (import.meta.env.DEV) {
  void Promise.all([import('./state/store'), import('./hooks/useHandTracking')]).then(([s, h]) => {
    Object.assign(window, { __holo: s.useHolo, __gestures: h.gestureRuntime });
  });
}
