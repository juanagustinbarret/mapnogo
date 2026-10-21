// public/sw.js - Service Worker de NOGOYORK (notificaciones push)
//
// Solo maneja notificaciones: no intercepta pedidos ni guarda nada en caché,
// así que no puede dejar a nadie con una versión vieja del sitio.
//
// Formato esperado del mensaje push (JSON):
//   { "title": "...", "body": "...", "url": "/comercio/slug", "tag": "promo-123", "icon": "/..." }
// Todos los campos son opcionales.

// Cambiar VERSION fuerza a los navegadores a instalar este archivo de nuevo.
const VERSION = '2026-10-18-logo-rana';
const TITULO_POR_DEFECTO = 'NOGOYORK 🏪';
const CUERPO_POR_DEFECTO = '¡Hay una nueva oferta o novedad en el directorio!';
const ICONO = '/pwa-192x192.png?v=2';
const INSIGNIA = '/badge-96x96.png?v=2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Solo se abren direcciones del propio sitio: un mensaje no puede mandar al
// vecino a una página externa.
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
    // Si no es JSON, se muestra como texto en vez de perder la notificación
    const texto = data.text();
    return texto ? { body: texto } : {};
  }
}

self.addEventListener('push', (event) => {
  // Siempre se muestra algo: con userVisibleOnly, un push sin notificación
  // hace que el navegador muestre un aviso genérico o corte la suscripción.
  const mensaje = leerMensaje(event.data);
  const titulo = typeof mensaje.title === 'string' && mensaje.title.trim() ? mensaje.title : TITULO_POR_DEFECTO;
  const opciones = {
    body: typeof mensaje.body === 'string' && mensaje.body.trim() ? mensaje.body : CUERPO_POR_DEFECTO,
    icon: typeof mensaje.icon === 'string' && mensaje.icon ? urlSegura(mensaje.icon) : ICONO,
    badge: INSIGNIA,
    vibrate: [100, 50, 100],
    data: { url: urlSegura(mensaje.url) },
  };
  // Con la misma etiqueta, una notificación reemplaza a la anterior en vez de apilarse
  if (typeof mensaje.tag === 'string' && mensaje.tag) opciones.tag = mensaje.tag;

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlAAbrir = urlSegura(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
      // Si ya está abierta en esa página, se enfoca
      const misma = ventanas.find((v) => v.url === urlAAbrir && 'focus' in v);
      if (misma) return misma.focus();

      // Si hay otra pestaña del sitio, se lleva ahí y se enfoca
      const otra = ventanas.find((v) => 'navigate' in v && 'focus' in v);
      if (otra) {
        try {
          const navegada = await otra.navigate(urlAAbrir);
          return (navegada || otra).focus();
        } catch {
          // Pestaña no controlada por este service worker: se abre una nueva
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(urlAAbrir);
      return undefined;
    }),
  );
});
