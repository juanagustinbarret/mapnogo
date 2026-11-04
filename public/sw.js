// public/sw.js
const CACHE_NAME = 'nogoyork-v4';

// Recursos base de la App Shell
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forzar activación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Filtrar peticiones no GET o externas (Supabase, Leaflet CDN, etc.)
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // A) NAVEGACIÓN SPA (Rutas de la App: /comercio/algo, /favoritos, etc.)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Si estás offline o la red falla, SIEMPRE sirve index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // B) ASSETS Y CHUNKS JS / CSS / IMÁGENES
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Si ya lo tenemos guardado en caché local, usarlo directamente
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Si no está en caché, ir a buscarlo a la red y guardar una copia para el futuro
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('Asset no disponible offline:', request.url, err);
        });
    })
  );
});
