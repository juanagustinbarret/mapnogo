// public/sw.js - Service Worker para Nogoyá Cerca

// 1. Escuchar eventos de instalación y activación
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. Escuchar la llegada de notificaciones Push enviadas desde Supabase / VAPID
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Nogoyá Cerca 🏪';
    const options = {
      body: data.body || '¡Hay una nueva oferta o novedad en el directorio!',
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Error al procesar el mensaje Push entrante:', err);
  }
});

// 3. Controlar la interacción cuando el vecino hace clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlAAbrir = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta en una pestaña, le enfoca la pantalla
      for (const client of clientList) {
        if (client.url === urlAAbrir && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta, abre una ventana nueva con la oferta/comercio
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlAAbrir);
      }
    })
  );
});