import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker for PWA/offline (M10)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Var der allerede en SW i kontrol? Sä en controllerchange senere = EN RIGTIG opdatering
    // (ikke foerstegangs-install) -> genlaes sä den nye build taes i brug (review 06: verificer opdateringer).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/Timeline/sw.js').catch((err) => console.error('SW-registrering fejlede', err));
  });
}
