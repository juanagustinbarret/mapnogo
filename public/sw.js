// public/sw.js
const CACHE_NAME = 'nogoyork-v6';

// 1. Recursos base
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo peticiones GET al propio dominio (ignorar extensiones de Chrome y APIs externas)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // A) NAVEGACIÓN SPA (Rutas HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // B) RECURSOS Y SCRIPTS (archivos .js, .css, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Si el JS/CSS ya está en caché, entregarlo inmediatamente (evita la pantalla en blanco)
      if (cachedResponse) {
        // En segundo plano busca si hay versión nueva si hay red
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Offline */});

        return cachedResponse;
      }

      // Si no está en caché, ir a buscarlo a la red y guardarlo para la próxima
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
