// public/sw.js
const CACHE_NAME = 'nogoyork-v8';

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

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // 1. Navegación SPA (páginas HTML)
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
          return caches.match('/index.html').then((res) => res || caches.match('/'));
        })
    );
    return;
  }

  // 2. Assets (JS, CSS, Imágenes)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback con cabeceras MIME válidas para evitar errores de consola en el navegador
          if (request.url.endsWith('.js')) {
            return new Response('/* Script no disponible offline */', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          if (request.url.endsWith('.css')) {
            return new Response('/* Estilo no disponible offline */', {
              status: 200,
              headers: { 'Content-Type': 'text/css' }
            });
          }
          return new Response(null, { status: 204, statusText: 'Offline No Content' });
        });
    })
  );
});
