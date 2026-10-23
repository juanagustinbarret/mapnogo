// public/sw.js - Service Worker de NOGOYORK (PWA Caché + Push)
const CACHE_NAME = 'nogoyork-app-v1';
const RECURSOS_ESTATICOS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png?v=2',
  '/pwa-512x512.png?v=2',
  '/favicon.svg?v=2'
];

const TITULO_POR_DEFECTO = 'NOGOYORK 🏪';
const CUERPO_POR_DEFECTO = '¡Hay una nueva oferta o novedad en el directorio!';
const ICONO = '/pwa-192x192.png?v=2';
const INSIGNIA = '/badge-96x96.png?v=2';

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

// Estrategia Stale-While-Revalidate para la interfaz (Abre al instante desde el celular)
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones de la API de Supabase o servicios externos para que siempre traigan datos frescos
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('smn.gob.ar') ||
    event.request.url.includes('openstreetmap.org')
  ) {
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
        .catch(() => respuestaCache);

      // Si tenemos la interfaz en caché, la mostramos al toque (0.1s); si no, esperamos la red
      return respuestaCache || peticionRed;
    })
  );
});

// Manejo de Notificaciones Push
function urlSegura(url) {
  try {
    const destino = new URL(url || '/', self.location.origin);
    return destino.origin === self.location.origin ? destino.href : new URL('/', self.location.origin).href;
  } catch {
    return new URL('/', self.location.origin).href;
  }
}

function leerMensaje(data) {
  if (!data) return {};
  try {
    const json = data.json();
    return json && typeof json === 'object' ? json : { body: String(json) };
  } catch {
    const texto = data.text();
    return texto ? { body: texto } : {};
  }
}

self.addEventListener('push', (event) => {
  const mensaje = leerMensaje(event.data);
  const titulo = typeof mensaje.title === 'string' && mensaje.title.trim() ? mensaje.title : TITULO_POR_DEFECTO;
  const opciones = {
    body: typeof mensaje.body === 'string' && mensaje.body.trim() ? mensaje.body : CUERPO_POR_DEFECTO,
    icon: typeof mensaje.icon === 'string' && mensaje.icon ? urlSegura(mensaje.icon) : ICONO,
    badge: INSIGNIA,
    vibrate: [100, 50, 100],
    data: { url: urlSegura(mensaje.url) },
  };
  if (typeof mensaje.tag === 'string' && mensaje.tag) opciones.tag = mensaje.tag;

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlAAbrir = urlSegura(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
      const misma = ventanas.find((v) => v.url === urlAAbrir && 'focus' in v);
      if (misma) return misma.focus();

      const otra = ventanas.find((v) => 'navigate' in v && 'focus' in v);
      if (otra) {
        try {
          const navegada = await otra.navigate(urlAAbrir);
          return (navegada || otra).focus();
        } catch {
          // Si no se puede navegar, abre ventana nueva
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(urlAAbrir);
      return undefined;
    }),
  );
});