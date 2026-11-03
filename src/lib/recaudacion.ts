// src/lib/recaudacion.ts

export interface Recaudacion {
  total: number;
  /** Primer y último día del mes (aaaa-mm-dd) */
  desde: string;
  hasta: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function leerRecaudacion(datos: unknown): Recaudacion | null {
  const d = datos as { total?: unknown; total_centavos?: unknown; desde?: unknown; hasta?: unknown } | null;
  const valor = Number(d?.total ?? d?.total_centavos);
  
  if (!d || !Number.isSafeInteger(valor) || valor < 0) return null;
  if (typeof d.desde !== 'string' || !FECHA.test(d.desde) || typeof d.hasta !== 'string' || !FECHA.test(d.hasta)) return null;
  
  return { total: valor, desde: d.desde, hasta: d.hasta };
}

/** "noviembre de 2026" a partir del primer día del mes */
export const nombreDelMes = (desde: string): string =>
  new Date(`${desde}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });