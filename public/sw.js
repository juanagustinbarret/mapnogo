// public/sw.js - Service Worker de NOGOYORK (PWA Caché)
const CACHE_NAME = 'nogoyork-app-v4';
const RECURSOS_ESTATICOS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.svg'
];

// Instalar y precargar la carcasa estática de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(RECURSOS_ESTATICOS);
    })
  );
  self.skipWaiting();
});

// Limpiar cachés viejas al activar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptor de peticiones
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('smn.gob.ar') ||
    event.request.url.includes('openstreetmap.org')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html').then((response) => response || Response.error());
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const respuestaCache = await cache.match(event.request);

      const peticionRed = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed.ok && event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, respuestaRed.clone());
          }
          return respuestaRed;
        })
        .catch(() => undefined);

      const respuestaRedFinal = await peticionRed;

      return respuestaRedFinal || respuestaCache || Response.error();
    })
  );
});