import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { migrarClavesLocales } from './lib/migrarClavesLocales';

// Antes de que la app lea sus datos guardados (cambio de nombre a NOGOYORK)
migrarClavesLocales();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);