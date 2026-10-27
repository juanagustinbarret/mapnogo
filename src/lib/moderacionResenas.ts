// src/lib/moderacionResenas.ts
//
// Pedidos de eliminación de reseñas. Las reglas y la decisión están en el
// servidor (supabase/functions/moderar-resenas); acá solo se leen los pedidos
// (cada uno ve lo suyo por RLS) y se llama a la función.

import { supabase } from './supabase';
import { esTablaFaltante, mensajeDeError, type Resultado } from './fotosComercio';
import type { EstadoSolicitud } from '../../supabase/functions/_shared/moderacionResenas';

export { MOTIVO_MAX, MOTIVO_MIN, NOTA_MAX, validarMotivo, type EstadoSolicitud } from '../../supabase/functions/_shared/moderacionResenas';

export const FUNCION_MODERAR_RESENAS = 'moderar-resenas';
const COLUMNAS = 'id, created_at, resena_id, comercio_id, motivo, resena_resumen, estado, nota_admin, resuelta_at';

export interface SolicitudEliminacion {
  id: string;
  created_at: string;
  resena_id: string;
  comercio_id: string;
  motivo: string;
  resena_resumen: string | null;
  estado: EstadoSolicitud;
  nota_admin: string | null;
  resuelta_at: string | null;
}

/** `disponible` es false si todavía no se corrió el SQL (la tabla no existe). */
async function leer(consulta: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>) {
  const { data, error } = await consulta;
  if (error) {
    const falta = esTablaFaltante(error) || /solicitudes_eliminacion_resena/.test(error.message ?? '');
    if (!falta) console.warn('[reseñas] No se pudieron leer los pedidos de eliminación:', error.message);
    return { disponible: !falta, solicitudes: [] as SolicitudEliminacion[] };
  }
  return { disponible: true, solicitudes: (data ?? []) as SolicitudEliminacion[] };
}

export const cargarSolicitudesDeComercio = (comercioId: string) =>
  leer(supabase.from('solicitudes_eliminacion_resena').select(COLUMNAS).eq('comercio_id', comercioId).order('created_at', { ascending: false }));

export const cargarSolicitudesPendientes = () =>
  leer(supabase.from('solicitudes_eliminacion_resena').select(COLUMNAS).eq('estado', 'pendiente').order('created_at', { ascending: true }));

export async function solicitarEliminacion(resenaId: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await supabase.functions.invoke(FUNCION_MODERAR_RESENAS, { body: { accion: 'solicitar', resena_id: resenaId, motivo } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo enviar el pedido. Probá de nuevo.') };
  return { ok: true, valor: null };
}

export async function resolverSolicitud(solicitudId: string, aprobar: boolean, nota?: string): Promise<Resultado<null>> {
  const { error } = await supabase.functions.invoke(FUNCION_MODERAR_RESENAS, { body: { accion: 'resolver', solicitud_id: solicitudId, aprobar, nota } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo guardar la decisión.') };
  return { ok: true, valor: null };
}
