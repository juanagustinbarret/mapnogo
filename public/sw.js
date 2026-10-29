// public/sw.js - Service Worker de NOGOYORK (PWA Caché)
const CACHE_NAME = 'nogoyork-app-v3';
const RECURSOS_ESTATICOS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png?v=2',
  '/pwa-512x512.png?v=2',
  '/favicon.svg?v=2'
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
  // 1. Ignorar métodos que no sean GET o llamadas a API externas
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('smn.gob.ar') ||
    event.request.url.includes('openstreetmap.org')
  ) {
    return;
  }

  // 2. Manejar Navegación SPA (React Router)
  // Si se solicita una ruta HTML (como /panel, /admin, /comercio/slug)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si falla la red (offline/error), se sirve la cáscara /index.html precargada
        return caches.match('/index.html').then((response) => response || Response.error());
      })
    );
    return;
  }

  // 3. Estrategia Stale-While-Revalidate para assets estáticos (CSS, JS, imágenes)
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