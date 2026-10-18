import { supabase } from '@/lib/supabase';

// Clave pública VAPID fija de respaldo
const VAPID_PUBLIC_KEY_FALLBACK =
  'BFjU2t_4zHJBLGlfY4UTdp-f6aHfI_X5GR-R6OaA0a_Tkep9IBMLn5ST1Sxtow3d1atu48SBpH4BLYWWK4zhsTA';

// Función auxiliar para convertir ArrayBuffer a Base64 de forma limpia y segura
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convertir clave VAPID pública de base64 URL-safe a BufferSource compatible con PushManager
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as BufferSource;
}

export async function solicitarPermisoNotificacionesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Las notificaciones Push no están soportadas en este navegador.');
    return null;
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    console.warn('El usuario denegó los permisos de notificaciones.');
    return null;
  }

  try {
    const registro = await navigator.serviceWorker.ready;

    // Obtener la clave VAPID desde las variables de entorno o usar la clave predeterminada
    const vapidPublicKey =
      import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_FALLBACK;

    if (!vapidPublicKey) {
      console.warn('No se pudo obtener la clave VAPID pública.');
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Suscribir al PushManager
    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Extraer claves p256dh y auth de forma segura
    const p256dhKey = suscripcion.getKey('p256dh');
    const authKey = suscripcion.getKey('auth');

    const p256dh = arrayBufferToBase64(p256dhKey);
    const auth = arrayBufferToBase64(authKey);

    // Guardar o actualizar la suscripción en la tabla de Supabase
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: suscripcion.endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Error al guardar la suscripción Push en Supabase:', error);
    }

    return suscripcion;
  } catch (error) {
    console.error('Error al solicitar notificaciones push:', error);
    return null;
  }
}