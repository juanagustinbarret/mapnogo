// src/lib/fechasArgentina.ts
//
// Fechas de calendario en hora de Argentina (UTC-3).
// `new Date().toISOString().split('T')[0]` da la fecha en UTC: entre las 21:00
// y las 23:59 de Argentina ya devuelve el día siguiente. Con eso, por ejemplo,
// las promociones que vencían "hoy" desaparecían 3 horas antes.

const ZONA = 'America/Argentina/Buenos_Aires';

/** Fecha de hoy en Argentina, como YYYY-MM-DD. */
export function hoyArgentina(ahora: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function sumarDias(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Días de calendario entre dos fechas YYYY-MM-DD (negativo si `hasta` ya pasó). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

const ddmmaaaa = (fechaISO: string) => fechaISO.slice(0, 10).split('-').reverse().join('/');

/**
 * Texto de vencimiento de una promoción ("Vence hoy", "Vence mañana"...).
 * Antes se calculaba con horas y Math.ceil: una promo que vencía hoy decía
 * "Vence mañana" y "Vence hoy" no aparecía nunca.
 */
export function textoVencimiento(
  fechaISO?: string | null,
  hoy: string = hoyArgentina(),
): { texto: string; estaPorVencer: boolean } {
  if (!fechaISO) return { texto: '', estaPorVencer: false };
  const dias = diasEntre(hoy, fechaISO.slice(0, 10));
  if (dias < 0) return { texto: 'Vencida', estaPorVencer: true };
  if (dias === 0) return { texto: 'Vence hoy', estaPorVencer: true };
  if (dias === 1) return { texto: 'Vence mañana', estaPorVencer: true };
  if (dias <= 5) return { texto: `Vence en ${dias} días`, estaPorVencer: true };
  return { texto: `Hasta el ${ddmmaaaa(fechaISO)}`, estaPorVencer: false };
}
