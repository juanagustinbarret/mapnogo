// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSyncHandlers } from './lib/initSync';

// 1. Inicializar manejadores de sincronización offline
initSyncHandlers();

// 2. Registrar el Service Worker de la PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker cargado:', reg.scope))
      .catch((err) => console.error('Error al registrar Service Worker:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
