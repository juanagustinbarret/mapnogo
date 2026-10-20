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
  const fecha = fechaCalendario(fechaISO);
  const dias = diasEntre(hoy, fecha);
  if (dias < 0) return { texto: 'Vencida', estaPorVencer: true };
  if (dias === 0) return { texto: 'Vence hoy', estaPorVencer: true };
  if (dias === 1) return { texto: 'Vence mañana', estaPorVencer: true };
  if (dias <= 5) return { texto: `Vence en ${dias} días`, estaPorVencer: true };
  return { texto: `Hasta el ${ddmmaaaa(fecha)}`, estaPorVencer: false };
}

// ─── Fechas de calendario vs. instantes ─────────────────────────────────
// En la base hay dos tipos de valores:
//  - Fechas de calendario (vencimientos de promociones, de suscripciones):
//    se guardan como 'YYYY-MM-DD'. Las columnas fecha_inicio/fecha_fin de
//    promociones son timestamptz, así que Postgres las devuelve como
//    '2026-11-17T00:00:00+00:00' (medianoche UTC). Convertir eso a hora
//    argentina daría el 16 a las 21:00: el día correcto es la parte de la
//    fecha, sin conversión.
//  - Instantes (created_at, updated_at): son un momento real y se muestran
//    en hora argentina.
// Regla: 'YYYY-MM-DD' o medianoche UTC exacta = fecha de calendario; todo lo
// demás = instante.

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIANOCHE_UTC = /^\d{4}-\d{2}-\d{2}[T ]00:00:00(\.0+)?(Z|\+00(:?00)?)$/;

/** 'YYYY-MM-DD' de un valor de la base, según la regla de arriba. */
export function fechaCalendario(valor?: string | null): string {
  if (!valor) return '';
  const texto = valor.trim();
  if (SOLO_FECHA.test(texto) || MEDIANOCHE_UTC.test(texto)) return texto.slice(0, 10);
  const instante = new Date(texto);
  return Number.isNaN(instante.getTime()) ? texto.slice(0, 10) : hoyArgentina(instante);
}

/** Fecha legible en formato argentino: 17/11/2026. */
export function formatearFecha(valor?: string | null): string {
  const fecha = fechaCalendario(valor);
  return SOLO_FECHA.test(fecha) ? ddmmaaaa(fecha) : '';
}

/** Fecha y hora argentina de un instante: 17/11/2026 14:05. */
export function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '';
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return '';
  const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(instante);
  return `${ddmmaaaa(hoyArgentina(instante))} ${hora}`;
}

/**
 * ¿Sigue vigente algo que vence en `fechaFin`? Una oferta "hasta el 17" vale
 * todo el 17 en Argentina (hasta las 23:59) y deja de verse el 18.
 */
export function estaVigente(fechaFin?: string | null, hoy: string = hoyArgentina()): boolean {
  if (!fechaFin) return true;
  return fechaCalendario(fechaFin) >= hoy;
}

/**
 * Límites de un rango de días argentinos para filtrar instantes en la base:
 * desde las 00:00 del primer día hasta las 00:00 del día siguiente al último
 * (exclusivo). Argentina no usa horario de verano desde 2009: UTC-3 fijo.
 */
export function limitesDelRango(desde: string, hasta: string): { desdeISO: string; hastaISO: string } {
  return {
    desdeISO: `${desde}T00:00:00-03:00`,
    hastaISO: `${sumarDias(hasta, 1)}T00:00:00-03:00`,
  };
}

// ─── Campos <input type="datetime-local"> en hora argentina ──────────────
// Esos campos no tienen zona horaria. Antes se interpretaban con la zona del
// dispositivo: con un celular configurado en otra zona, un evento "hasta las
// 23:59" quedaba corrido varias horas.

/** '2026-10-20T21:30' (hora argentina) → instante ISO en UTC; '' si no se entiende. */
export function isoDesdeLocalArgentina(valor?: string | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(valor ?? '');
  if (!m) return '';
  const instante = new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`);
  return Number.isNaN(instante.getTime()) ? '' : instante.toISOString();
}

/** Instante de la base → '2026-10-20T21:30' en hora argentina, para un datetime-local. */
export function localArgentinaDesdeIso(valor?: string | null): string {
  if (!valor) return '';
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return '';
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(instante)
    .replace(/^24:/, '00:');
  return `${hoyArgentina(instante)}T${hora}`;
}
