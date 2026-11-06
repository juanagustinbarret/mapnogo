// src/lib/recaudacion.ts
//
// "Recaudación activa" del panel de admin: lo cobrado en el mes en curso (hora
// de Argentina). La suma la hace el servidor a partir de la tabla pagos
// (RPC recaudacion_mes_actual, supabase/propuestas/20261103_recaudacion_pagos.sql);
// acá solo se lee y se valida la respuesta.

export interface Recaudacion {
  centavos: number;
  /** Primer y último día del mes (aaaa-mm-dd) */
  desde: string;
  hasta: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function leerRecaudacion(datos: unknown): Recaudacion | null {
  // Si Supabase devuelve un array con un objeto adentro, tomamos el primer elemento
  const d = (Array.isArray(datos) ? datos[0] : datos) as {
    total_centavos?: unknown;
    desde?: unknown;
    hasta?: unknown;
  } | null;

  const centavos = Number(d?.total_centavos);
  if (!d || !Number.isSafeInteger(centavos) || centavos < 0) return null;
  if (typeof d.desde !== 'string' || !FECHA.test(d.desde) || typeof d.hasta !== 'string' || !FECHA.test(d.hasta)) return null;
  return { centavos, desde: d.desde, hasta: d.hasta };
}

/** "noviembre de 2026" a partir del primer día del mes */
export const nombreDelMes = (desde: string): string =>
  new Date(`${desde}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });