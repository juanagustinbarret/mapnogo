// public/sw.js
const CACHE_NAME = 'nogoyork-v5';

// Recursos críticos para precachear al instalar
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// 2. ACTIVACIÓN
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

// 3. INTERCEPCIÓN DE RED (FETCH)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Omitir peticiones que no sean GET o que vayan a dominios externos (ej: Supabase, OpenStreetMap)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // A) MANEJO DE NAVEGACIÓN (Rutas SPA como /comercio/algo, /favoritos, etc.)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Si hay red, guardamos una copia de index.html actualizada
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // SI NO HAY RED (OFFLINE): Devolver siempre /index.html en caché
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // B) ASSETS ESTÁTICOS (Archivos .js, .css, .svg, .png, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Si está en caché local, servirlo al instante
      if (cachedResponse) {
        // En segundo plano actualizamos el caché si hay red (Stale-While-Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {/* Red no disponible */});

        return cachedResponse;
      }

      // 2. Si no está en caché, buscar en red y guardar una copia
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
