// src/lib/avisosPromociones.ts
//
// Llamadas a la Edge Function notificar-promociones (el envío de las
// notificaciones push lo hace el servidor con la clave VAPID privada; acá no
// hay ninguna clave). Ver supabase/functions/notificar-promociones.

import { supabase } from './supabase';
import { obtenerSuscripcionPushActual, solicitarPermisoNotificacionesPush, mensajeFalloPush } from './pushNotifications';

export const FUNCION_AVISOS = 'notificar-promociones';

/**
 * Después de publicar: pedir que se avise a los suscriptos. El servidor
 * decide si corresponde (vigente, límite diario…) y espera los envíos antes de
 * responder. Si falla, el cron de cada 5 minutos la vuelve a tomar.
 */
export async function pedirAvisoDePublicaciones(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke(FUNCION_AVISOS, { body: { modo: 'pendientes' } });
    if (error) console.warn('[avisos] El servidor no pudo procesar el aviso ahora; lo reintenta el cron.', error);
  } catch (e) {
    console.warn('[avisos] No se pudo pedir el aviso ahora; lo reintenta el cron.', e);
  }
}

export type ResultadoPrueba = { ok: true; texto: string } | { ok: false; texto: string };

/**
 * Solo admin: manda una notificación de prueba ÚNICAMENTE a este dispositivo.
 * Si todavía no está suscripto, primero pide el permiso.
 */
export async function probarNotificacionEnEsteDispositivo(): Promise<ResultadoPrueba> {
  let suscripcion = await obtenerSuscripcionPushActual();
  if (!suscripcion) {
    const alta = await solicitarPermisoNotificacionesPush();
    if (!alta.ok) return { ok: false, texto: mensajeFalloPush(alta) };
    suscripcion = alta.suscripcion;
  }
  const { data, error } = await supabase.functions.invoke(FUNCION_AVISOS, { body: { modo: 'prueba', endpoint: suscripcion.endpoint } });
  if (error) {
    let detalle = error.message;
    try {
      const cuerpo = await (error as { context?: Response }).context?.json();
      if (cuerpo?.error) detalle = cuerpo.error;
    } catch {
      /* sin cuerpo */
    }
    return { ok: false, texto: `No se pudo enviar la prueba: ${detalle}` };
  }
  const r = data as { enviadas?: number; errores?: { motivo: string; detalle?: string }[] };
  if (r?.enviadas) return { ok: true, texto: 'Listo: en unos segundos tendría que llegarte la notificación de prueba a este dispositivo.' };
  const motivo = r?.errores?.[0];
  if (motivo?.motivo === 'claves') return { ok: false, texto: 'El servicio de notificaciones rechazó las claves VAPID: la clave privada del servidor no corresponde a la pública de la app.' };
  return { ok: false, texto: `El servicio de notificaciones no la aceptó (${motivo?.motivo ?? 'sin detalle'}${motivo?.detalle ? `: ${motivo.detalle}` : ''}).` };
}
