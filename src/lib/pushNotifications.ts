import { supabase } from './supabase';

// Notificaciones push del navegador (Web Push con claves VAPID).
//
// Flujo: App.tsx registra public/sw.js al cargar → el vecino toca "Recibir
// Ofertas" → el navegador pide permiso → se crea la suscripción y se guarda
// en la tabla push_subscriptions. El envío lo tiene que hacer el servidor con
// la clave VAPID privada (todavía no existe en el repo).

// Clave pública VAPID de respaldo (la pública se puede exponer; la privada
// no). Antes el respaldo era el texto 'TU_VAPID_PUBLIC_KEY': si faltaba la
// variable en Vercel, atob() fallaba y el botón solo decía "no se pudo".
const VAPID_PUBLIC_KEY_FALLBACK =
  'BFjU2t_4zHJBLGlfY4UTdp-f6aHfI_X5GR-R6OaA0a_Tkep9IBMLn5ST1Sxtow3d1atu48SBpH4BLYWWK4zhsTA';

const RUTA_SERVICE_WORKER = '/sw.js';
// Si el service worker no queda listo en este tiempo, se avisa en vez de
// dejar el botón en "Activando..." para siempre.
const ESPERA_MAXIMA_MS = 10_000;

export type MotivoFalloPush =
  | 'no_soportado' // navegador sin Push API
  | 'ios_sin_instalar' // iPhone/iPad: solo funciona con la app agregada a la pantalla de inicio
  | 'denegado' // el usuario bloqueó las notificaciones
  | 'descartado' // cerró el cartel de permiso sin elegir
  | 'sin_clave' // falta la clave VAPID
  | 'error_servicio' // el service worker no se registró o no respondió
  | 'error_push_navegador' // el servicio push del navegador (FCM, etc.) rechazó la suscripción
  | 'error_guardado'; // el navegador se suscribió pero no se pudo guardar en la base

export type ResultadoPush =
  | { ok: true; suscripcion: PushSubscription }
  // `detalle` es el código técnico (ej. 42703 de Postgres) para poder diagnosticar
  | { ok: false; motivo: MotivoFalloPush; detalle?: string };

export const MENSAJES_FALLO_PUSH: Record<MotivoFalloPush, string> = {
  no_soportado: 'Este navegador no permite recibir notificaciones.',
  ios_sin_instalar:
    'En iPhone las notificaciones funcionan solo si agregás NOGOMAP a la pantalla de inicio (Compartir → "Agregar a inicio") y la abrís desde ahí.',
  denegado:
    'Las notificaciones están bloqueadas para este sitio. Podés habilitarlas desde la configuración del navegador (el candado junto a la dirección).',
  descartado: 'No se activaron las notificaciones. Podés volver a intentarlo cuando quieras.',
  sin_clave: 'Las notificaciones no están configuradas todavía. Probá más tarde.',
  error_servicio: 'No pudimos activar las notificaciones en este momento. Probá de nuevo en unos minutos.',
  error_push_navegador:
    'El servicio de notificaciones de tu navegador no respondió. Si usás Brave, activá "Usar los servicios de Google para mensajería push" en la configuración; si no, probá con Chrome.',
  error_guardado: 'No pudimos registrar tu suscripción en el servidor. Probá de nuevo en unos minutos.',
};

/** Mensaje para el usuario, con el código técnico si lo hay (sirve para soporte). */
export const mensajeFalloPush = (resultado: { motivo: MotivoFalloPush; detalle?: string }) =>
  MENSAJES_FALLO_PUSH[resultado.motivo] + (resultado.detalle ? ` (código: ${resultado.detalle})` : '');

// Log estructurado en la consola del navegador: etapa, código y detalle del
// error, en vez de solo el mensaje genérico.
function registrarErrorPush(etapa: string, error: unknown) {
  const e = (error ?? {}) as { name?: string; code?: string; message?: string; details?: string; hint?: string };
  console.error(`[push] Falló: ${etapa}`, {
    nombre: e.name,
    codigo: e.code,
    mensaje: e.message,
    detalle: e.details,
    pista: e.hint,
    navegador: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
}

// La tabla real (verificado en producción el 18/10) tiene las columnas
// id, endpoint, p256dh, auth y created_at.
const filaDeSuscripcion = (suscripcion: PushSubscription) => {
  const { endpoint, keys } = suscripcion.toJSON();
  return { endpoint: endpoint ?? '', p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' };
};

const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function pushSoportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Clave VAPID en base64 URL-safe → bytes, como la pide PushManager
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const mismaClave = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.byteLength) return false;
  const vista = new Uint8Array(a);
  return vista.every((byte, i) => byte === b[i]);
};

function conTiempoLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(Object.assign(new Error('Tiempo de espera agotado'), { name: 'TimeoutError' })), ms);
    promesa.then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      (error) => {
        clearTimeout(reloj);
        rechazar(error);
      },
    );
  });
}

// App.tsx ya registra el service worker al cargar; por si ese registro falló
// o todavía no terminó, se reintenta acá. `ready` no tiene tiempo límite
// propio: si el registro falla se queda esperando para siempre.
async function obtenerRegistro(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration('/');
  if (!existente) await navigator.serviceWorker.register(RUTA_SERVICE_WORKER, { scope: '/' });
  return conTiempoLimite(navigator.serviceWorker.ready, ESPERA_MAXIMA_MS);
}

/** Suscripción actual de este navegador, sin pedir permisos ni registrar nada. */
export async function obtenerSuscripcionPushActual(): Promise<PushSubscription | null> {
  if (!pushSoportado() || Notification.permission !== 'granted') return null;
  try {
    const registro = await navigator.serviceWorker.getRegistration('/');
    return (await registro?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** ¿Este dispositivo ya está suscripto? (para mostrar el estado del botón) */
export async function verificarEstadoSuscripcionPush(): Promise<boolean> {
  return (await obtenerSuscripcionPushActual()) !== null;
}

export async function solicitarPermisoNotificacionesPush(): Promise<ResultadoPush> {
  if (!pushSoportado()) {
    return { ok: false, motivo: esIOS() ? 'ios_sin_instalar' : 'no_soportado' };
  }
  if (Notification.permission === 'denied') return { ok: false, motivo: 'denegado' };

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_FALLBACK;
  if (!vapidPublicKey) return { ok: false, motivo: 'sin_clave' };

  // El permiso se pide primero, mientras dura el "toque" del usuario: Safari
  // y Firefox lo exigen.
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') return { ok: false, motivo: 'denegado' };
  if (permiso !== 'granted') return { ok: false, motivo: 'descartado' };

  let suscripcion: PushSubscription;
  try {
    let registro: ServiceWorkerRegistration;
    try {
      registro = await obtenerRegistro();
    } catch (error) {
      registrarErrorPush('registro del service worker', error);
      return { ok: false, motivo: 'error_servicio', detalle: (error as Error)?.name };
    }
    const clave = urlBase64ToUint8Array(vapidPublicKey);

    // Reusar la suscripción que ya tenga este navegador (el upsert de abajo
    // la vuelve a guardar si en la base no estaba). Rehacerla siempre, como en
    // la versión anterior, dejaba en la base la fila vieja con un endpoint que
    // ya no sirve. Solo se rehace si se creó con otra clave VAPID.
    const actual = await registro.pushManager.getSubscription();
    if (actual && mismaClave(actual.options?.applicationServerKey, clave)) {
      suscripcion = actual;
    } else {
      if (actual) {
        const viejo = actual.endpoint;
        await actual.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', viejo);
      }
      suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
    }
  } catch (error) {
    registrarErrorPush('alta en el servicio push del navegador', error);
    const nombre = (error as Error)?.name;
    if (nombre === 'NotAllowedError') return { ok: false, motivo: 'denegado', detalle: nombre };
    return { ok: false, motivo: 'error_push_navegador', detalle: nombre };
  }

  // Causa del error en producción (18/10): el commit "Se agregaron
  // notificaciones" pasó a guardar { subscription_json, user_agent }, pero la
  // tabla no tiene esas columnas → Postgres 42703 "column ... does not exist"
  // y el mensaje "No pudimos registrar tu suscripción".
  // ignoreDuplicates (ON CONFLICT DO NOTHING) solo necesita permiso de INSERT:
  // si el endpoint ya estaba guardado no hace falta actualizarlo.
  const fila = filaDeSuscripcion(suscripcion);
  if (!fila.endpoint || !fila.p256dh || !fila.auth) {
    registrarErrorPush('lectura de claves de la suscripción', { message: 'faltan endpoint/p256dh/auth' });
    return { ok: false, motivo: 'error_push_navegador', detalle: 'sin_claves' };
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(fila, { onConflict: 'endpoint', ignoreDuplicates: true });

  if (error) {
    registrarErrorPush('guardado en push_subscriptions', error);
    await suscripcion.unsubscribe().catch(() => undefined);
    return { ok: false, motivo: 'error_guardado', detalle: error.code || String(error.message ?? '') };
  }

  return { ok: true, suscripcion };
}

/** Dar de baja las notificaciones en este dispositivo. */
export async function cancelarSuscripcionNotificacionesPush(): Promise<boolean> {
  const suscripcion = await obtenerSuscripcionPushActual();
  if (!suscripcion) return true;
  const { endpoint } = suscripcion;
  try {
    // Con la baja en el navegador, la suscripción deja de servir: aunque el
    // borrado de la fila falle, a este dispositivo ya no le llegan avisos.
    await suscripcion.unsubscribe();
  } catch (error) {
    registrarErrorPush('baja en el navegador', error);
    return false;
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  if (error) registrarErrorPush('borrado en push_subscriptions (la baja en el navegador sí se hizo)', error);
  return true;
}
