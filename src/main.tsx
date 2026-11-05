import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { migrarClavesLocales } from './lib/migrarClavesLocales';
import { initSyncHandlers } from './lib/initSync';

// 1. Inicializar manejadores para la cola de sincronización offline
initSyncHandlers();

// 2. El service worker lo registra vite-plugin-pwa (registerSW.js, vite.config.ts)

// 3. Migración de claves locales previo a la lectura de datos
migrarClavesLocales();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
