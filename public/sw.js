// public/sw.js
const CACHE_NAME = 'nogoyork-v2';

// 1. Archivos esenciales del shell
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Instalación: Guardar el cascarón de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpiar cachés viejos y tomar control inmediato
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

// Intercepción de Peticiones
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo nos interesan peticiones GET dentro de nuestro dominio (no Supabase / apis externas)
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // A) NAVEGACIÓN DE RUTAS (F5 en /comercio/slug, ingresar a una sub-ruta directamente)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Si hay red, guardamos copia en caché y devolvemos la respuesta
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // SI NO HAY RED O FALLA: Retornar SIEMPRE el index.html en caché para que React Router tome la ruta
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // B) ASSETS ESTÁTICOS (JS, CSS, Imágenes, Fuentes)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolver desde el caché local inmediatamente
        return cachedResponse;
      }

      // Si no está en caché, ir a buscarlo a la red y cachearlo para la próxima
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
        .catch(() => {
          // Si el asset no está y no hay red, no podemos hacer mucho más para esa imagen/script puntual
          console.warn('Asset offline no disponible en caché:', request.url);
        });
    })
  );
});
