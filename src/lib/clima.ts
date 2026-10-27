// src/lib/clima.ts
//
// Clima de Nogoyá para el widget del inicio.
//
// Fuente: MET Norway (api.met.no, servicio meteorológico público de Noruega).
// Es gratis también para uso comercial, con licencia CC BY 4.0 (hay que dar
// crédito). Open-Meteo, que se usaba antes, solo es gratis para uso no
// comercial, y NOGOYORK cobra suscripciones.
//
// MET Norway pide identificarse (User-Agent) y no repetir la consulta antes
// de que venza, cosas que el navegador no puede hacer bien. Por eso el
// navegador le pide el clima a /api/clima (función propia en Cloudflare
// Pages o Vercel), que consulta a MET Norway como mucho cada 1 hora para
// todos los visitantes y devuelve ya interpretado (ClimaData).

export const COORDENADAS_NOGOYA = { lat: -32.3942, lon: -59.7881 }; // MET Norway pide 4 decimales como máximo
export const URL_MET_NOGOYA =
  `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${COORDENADAS_NOGOYA.lat}&lon=${COORDENADAS_NOGOYA.lon}`;
export const USER_AGENT_CLIMA = 'NOGOYORK/1.0 (+https://mapnogo.vercel.app; juanagustinbarret@gmail.com)';
export const ENDPOINT_CLIMA = '/api/clima';
export const LICENCIA_MET = 'https://api.met.no/doc/License';
// Cada cuánto se actualiza el pronóstico: el widget, la caché de la CDN y la
// consulta a MET Norway (que igual nunca se repite antes de su Expires).
export const INTERVALO_CLIMA_SEGUNDOS = 3600;
// Aviso de viento fuerte: velocidad media prevista desde este valor en las
// próximas horas. 50 km/h es el comienzo de la fuerza 7 de Beaufort ("viento
// fuerte", 50-61 km/h). MET Norway no trae ráfagas para Argentina.
export const UMBRAL_VIENTO_KMH = 50;
export const HORAS_AVISO_VIENTO = 12;

export interface ClimaData {
  temp: number;
  sensacion: number;
  humedad: number;
  vientoVelocidad: number; // km/h
  direccionViento: string; // de dónde viene: N, NE, E, SE, S, SO, O, NO ('' si no viene)
  vientoMaximo: number; // km/h, velocidad máxima prevista en las próximas HORAS_AVISO_VIENTO horas
  lluvia: number; // mm en la próxima hora
  esLluvia: boolean;
  alertaViento: boolean;
  alertaTormenta: boolean;
  actualizado?: string; // ISO: hora del pronóstico usado
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const PUNTOS_CARDINALES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Grados (de dónde viene el viento) a punto cardinal. */
export function puntoCardinal(grados: number | null): string {
  return grados === null ? '' : PUNTOS_CARDINALES[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
}

/**
 * Sensación térmica ("temperatura aparente" de Steadman, la que usa el
 * Servicio Meteorológico de Australia y también Open-Meteo): tiene en cuenta
 * humedad y viento. t en °C, humedad en %, viento en m/s.
 */
export function sensacionTermica(t: number, humedad: number, vientoMs: number): number {
  const vapor = (humedad / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return t + 0.33 * vapor - 0.7 * vientoMs - 4.0;
}

interface PasoMet {
  time?: string;
  data?: {
    instant?: { details?: Record<string, unknown> };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: Record<string, unknown> };
  };
}

/**
 * Interpreta la respuesta de MET Norway (locationforecast/2.0/complete).
 * Usa el paso del pronóstico de la hora actual. Devuelve null si la respuesta
 * no tiene lo mínimo.
 */
export function interpretarMetNorway(respuesta: unknown, ahora: Date = new Date()): ClimaData | null {
  const pasos = (respuesta as { properties?: { timeseries?: PasoMet[] } } | null)?.properties?.timeseries;
  if (!Array.isArray(pasos) || pasos.length === 0) return null;

  // El paso vigente: el último que empezó hace menos de una hora (o el primero)
  const limite = ahora.getTime() - 60 * 60_000;
  const paso = pasos.find((p) => p.time && new Date(p.time).getTime() >= limite) ?? pasos[0];
  const detalles = paso.data?.instant?.details ?? {};
  const t = num(detalles.air_temperature);
  if (t === null) return null;

  const humedad = num(detalles.relative_humidity) ?? 0;
  const vientoMs = num(detalles.wind_speed) ?? 0; // m/s
  const proxima = paso.data?.next_1_hours;
  const simbolo = proxima?.summary?.symbol_code ?? '';
  const lluvia = num(proxima?.details?.precipitation_amount) ?? 0;
  const probTormenta = num(proxima?.details?.probability_of_thunder) ?? 0;

  const vientoVelocidad = Math.round(vientoMs * 3.6);
  // Velocidad máxima prevista desde el paso actual hasta HORAS_AVISO_VIENTO horas después
  const inicio = paso.time ? new Date(paso.time).getTime() : ahora.getTime();
  const fin = inicio + HORAS_AVISO_VIENTO * 3600_000;
  const vientoMaximo = pasos.reduce((max, p) => {
    const t = p.time ? new Date(p.time).getTime() : NaN;
    if (!(t >= inicio && t < fin)) return max;
    return Math.max(max, Math.round((num(p.data?.instant?.details?.wind_speed) ?? 0) * 3.6));
  }, vientoVelocidad);
  const alertaTormenta = simbolo.includes('thunder') || probTormenta >= 50 || lluvia >= 5 || (lluvia > 0 && vientoVelocidad >= 30);
  const alertaViento = vientoMaximo >= UMBRAL_VIENTO_KMH;

  return {
    temp: Math.round(t),
    // MET Norway la trae calculada (apparent_air_temperature); si no viene, se calcula
    sensacion: Math.round(num(detalles.apparent_air_temperature) ?? sensacionTermica(t, humedad, vientoMs)),
    humedad: Math.round(humedad),
    vientoVelocidad,
    direccionViento: puntoCardinal(num(detalles.wind_from_direction)),
    vientoMaximo,
    lluvia,
    esLluvia: lluvia > 0 || /rain|sleet|showers/.test(simbolo),
    alertaViento,
    alertaTormenta,
    actualizado: paso.time,
  };
}

/**
 * Segundos que se puede guardar la respuesta: hasta lo que diga Expires (MET
 * Norway pide no volver a consultar antes), como mínimo INTERVALO_CLIMA_SEGUNDOS.
 */
export function segundosDeCache(expires: string | null, ahora: Date = new Date()): number {
  const vence = expires ? Date.parse(expires) : NaN;
  const segundos = Number.isNaN(vence) ? INTERVALO_CLIMA_SEGUNDOS : Math.round((vence - ahora.getTime()) / 1000);
  return Math.max(INTERVALO_CLIMA_SEGUNDOS, segundos);
}

// Última respuesta de MET Norway (mientras la función siga viva): no se vuelve
// a consultar antes de Expires ni antes de INTERVALO_CLIMA_SEGUNDOS, y después
// se pregunta con If-Modified-Since.
let ultimaMet: { datos: unknown; lastModified: string | null; expires: string | null; consultadaAt: number } | null = null;

/**
 * Lo que hace la función /api/clima en el servidor (igual en Cloudflare y en
 * Vercel): consulta a MET Norway identificándose y devuelve el clima ya
 * interpretado, con permiso para guardarlo en caché.
 */
export async function responderClima(pedirFetch: typeof fetch = fetch, ahora: Date = new Date()): Promise<Response> {
  const cabeceras = { 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const vigente =
      !!ultimaMet &&
      Math.max(Date.parse(ultimaMet.expires ?? '') || 0, ultimaMet.consultadaAt + INTERVALO_CLIMA_SEGUNDOS * 1000) > ahora.getTime();
    if (!vigente) {
      const pedido: Record<string, string> = { 'User-Agent': USER_AGENT_CLIMA, Accept: 'application/json' };
      if (ultimaMet?.lastModified) pedido['If-Modified-Since'] = ultimaMet.lastModified;
      const r = await pedirFetch(URL_MET_NOGOYA, { headers: pedido });
      if (r.status === 304 && ultimaMet) {
        ultimaMet.expires = r.headers.get('Expires');
        ultimaMet.consultadaAt = ahora.getTime();
      } else {
        if (!r.ok) throw new Error(`MET Norway respondió ${r.status}`);
        ultimaMet = { datos: await r.json(), lastModified: r.headers.get('Last-Modified'), expires: r.headers.get('Expires'), consultadaAt: ahora.getTime() };
      }
    }
    const clima = interpretarMetNorway(ultimaMet!.datos, ahora);
    if (!clima) throw new Error('Respuesta de MET Norway sin datos');
    const segundos = segundosDeCache(ultimaMet!.expires, ahora);
    return new Response(JSON.stringify(clima), {
      headers: { ...cabeceras, 'Cache-Control': `public, max-age=${segundos}, s-maxage=${segundos}, stale-while-revalidate=600` },
    });
  } catch (error) {
    console.error('[clima]', error);
    return new Response(JSON.stringify({ error: 'No se pudo obtener el clima' }), {
      status: 502,
      headers: { ...cabeceras, 'Cache-Control': 'no-store' },
    });
  }
}
