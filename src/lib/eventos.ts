// src/lib/eventos.ts
//
// Textos de fecha y hora de los eventos. Antes la marquesina y el panel
// mostraban los valores crudos de la base ("2026-10-25", "21:00:00 a ??").

import { formatearFecha } from './fechasArgentina';

/** "21:00:00" → "21:00"; vacío si no hay hora válida. */
export function horaCorta(hora?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** "21:00 a 23:30 hs", "21:00 hs" o "" si no hay hora de inicio. */
export function textoHorarioEvento(inicio?: string | null, fin?: string | null): string {
  const desde = horaCorta(inicio);
  const hasta = horaCorta(fin);
  if (!desde) return '';
  return hasta ? `${desde} a ${hasta} hs` : `${desde} hs`;
}

/** Fecha del evento en formato argentino (dd/mm/aaaa); la cruda si no se entiende. */
export function textoFechaEvento(fecha?: string | null): string {
  return formatearFecha(fecha) || (fecha ?? '');
}
