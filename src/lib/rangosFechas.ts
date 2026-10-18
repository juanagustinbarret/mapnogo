// src/lib/rangosFechas.ts
//
// Rangos de días (en hora de Argentina) para filtrar métricas: atajos
// ("hoy", "últimos 7 días", "este mes"...) y el período anterior para
// comparar. Todas las fechas son 'YYYY-MM-DD' de calendario argentino.

import { diasEntre, hoyArgentina, sumarDias } from './fechasArgentina';

export type AtajoPeriodo = 'hoy' | '7d' | '30d' | 'mes' | 'mes_anterior' | 'personalizado';

export interface RangoFechas {
  desde: string;
  hasta: string;
}

export const ATAJOS_PERIODO: Array<{ atajo: Exclude<AtajoPeriodo, 'personalizado'>; etiqueta: string }> = [
  { atajo: 'hoy', etiqueta: 'Hoy' },
  { atajo: '7d', etiqueta: 'Últimos 7 días' },
  { atajo: '30d', etiqueta: 'Últimos 30 días' },
  { atajo: 'mes', etiqueta: 'Este mes' },
  { atajo: 'mes_anterior', etiqueta: 'Mes anterior' },
];

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const primerDiaDelMes = (fecha: string) => `${fecha.slice(0, 7)}-01`;
const ultimoDiaDelMes = (fecha: string) => sumarDias(primerDiaDelMes(sumarDias(primerDiaDelMes(fecha), 32)), -1);

/** Rango de un atajo, contando "hoy" en Argentina. */
export function rangoDeAtajo(atajo: Exclude<AtajoPeriodo, 'personalizado'>, hoy: string = hoyArgentina()): RangoFechas {
  switch (atajo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'mes':
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
    case 'mes_anterior': {
      const finAnterior = sumarDias(primerDiaDelMes(hoy), -1);
      return { desde: primerDiaDelMes(finAnterior), hasta: finAnterior };
    }
  }
}

/** Cantidad de días del rango, incluyendo ambos extremos. */
export const diasDelRango = (r: RangoFechas) => diasEntre(r.desde, r.hasta) + 1;

const esMesCompleto = (r: RangoFechas) =>
  r.desde === primerDiaDelMes(r.desde) && r.hasta === ultimoDiaDelMes(r.desde);

/**
 * Período anterior para comparar. Si el rango es un mes calendario completo,
 * se compara con el mes completo anterior; si no, con la misma cantidad de
 * días inmediatamente antes ("últimos 7 días" vs. los 7 anteriores).
 */
export function rangoAnterior(r: RangoFechas): RangoFechas {
  if (esMesCompleto(r)) {
    const finAnterior = sumarDias(r.desde, -1);
    return { desde: primerDiaDelMes(finAnterior), hasta: finAnterior };
  }
  const hasta = sumarDias(r.desde, -1);
  return { desde: sumarDias(hasta, -(diasDelRango(r) - 1)), hasta };
}

const ddmmaaaa = (f: string) => f.split('-').reverse().join('/');

/** "del 01/10/2026 al 31/10/2026" o "el 18/10/2026" si es un solo día. */
export function describirRango(r: RangoFechas): string {
  return r.desde === r.hasta ? `el ${ddmmaaaa(r.desde)}` : `del ${ddmmaaaa(r.desde)} al ${ddmmaaaa(r.hasta)}`;
}

/** Devuelve un mensaje de error o null si el rango sirve. */
export function validarRango(r: Partial<RangoFechas>, hoy: string = hoyArgentina()): string | null {
  if (!r.desde || !r.hasta || !SOLO_FECHA.test(r.desde) || !SOLO_FECHA.test(r.hasta)) return 'Elegí las dos fechas.';
  if (r.desde > r.hasta) return 'La fecha "desde" tiene que ser anterior a "hasta".';
  if (r.desde > hoy) return 'El período no puede empezar en el futuro.';
  if (diasDelRango(r as RangoFechas) > 366) return 'El período puede tener como máximo un año.';
  return null;
}

/** Lee ?desde=&hasta= de la URL (link del mensaje de WhatsApp). */
export function rangoDesdeUrl(busqueda: string): RangoFechas | null {
  const parametros = new URLSearchParams(busqueda);
  const rango = { desde: parametros.get('desde') ?? '', hasta: parametros.get('hasta') ?? '' };
  return validarRango(rango) ? null : rango;
}
