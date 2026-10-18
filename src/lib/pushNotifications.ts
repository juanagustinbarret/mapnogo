import { supabase } from './supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Verifica si el usuario ya tiene una suscripción activa en este dispositivo
export async function verificarEstadoSuscripcionPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    return !!suscripcion;
  } catch {
    return false;
  }
}

// Activar notificaciones Push
export async function solicitarPermisoNotificacionesPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return null;

    const registro = await navigator.serviceWorker.ready;
    const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'TU_VAPID_PUBLIC_KEY';
    const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    let suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    const subJson = suscripcion.toJSON();

    await supabase
      .from('push_subscriptions')
      .upsert({
        subscription_json: subJson,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      }, { onConflict: 'subscription_json' });

    return suscripcion;
  } catch (error) {
    console.error('Error al suscribir Push:', error);
    return null;
  }
}

// Desactivar / Dar de baja notificaciones Push
export async function cancelarSuscripcionNotificacionesPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();

    if (suscripcion) {
      const subJson = suscripcion.toJSON();

      // 1. Dar de baja en el navegador
      await suscripcion.unsubscribe();

      // 2. Eliminar la suscripción de la base de datos de Supabase
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('subscription_json', JSON.stringify(subJson));

      return true;
    }
    return false;
  } catch (error) {
    console.error('Error al cancelar suscripción Push:', error);
    return false;
  }
}