// public/sw.js
const CACHE_NAME = 'nogoyork-v7';

// Archivos estáticos fundamentales del cascarón
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

  // Omitir peticiones que no sean GET o que vayan fuera de tu dominio (Supabase, Leaflet, etc.)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // A) NAVEGACIÓN SPA (Rutas HTML como /comercio/slug)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla el fetch por estar offline, capturamos el error y devolvemos index.html del caché
          return caches.match('/index.html').then((response) => response || caches.match('/'));
        })
    );
    return;
  }

  // B) ASSETS Y SCRIPTS JS/CSS
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Si ya está en la memoria caché, devolverlo al instante (sin ir a la red)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Si no está en caché, intentamos buscarlo en la red
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          // CAPTURA DEL ERROR: Evita el "Uncaught (in promise) TypeError: Failed to fetch"
          console.warn('Recurso no disponible offline:', request.url);
          // Retornar una respuesta vacía válida (204 No Content) para que la consola no explote
          return new Response(null, { status: 204, statusText: 'Offline No Content' });
        });
    })
  );
});
