// src/lib/clima.ts
//
// Interpreta la respuesta de Open-Meteo (bloque "current") para el widget del
// clima. Antes solo se miraba "rain": las tormentas convectivas vienen como
// "showers" y el código de tiempo 95-99 (tormenta eléctrica), así que una
// tormenta podía no disparar el aviso.

export const URL_CLIMA_NOGOYA =
  'https://api.open-meteo.com/v1/forecast?latitude=-32.3942&longitude=-59.7881' +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m' +
  '&timezone=America%2FArgentina%2FBuenos_Aires';

export interface ClimaData {
  temp: number;
  sensacion: number;
  humedad: number;
  vientoVelocidad: number;
  rafagas: number;
  lluvia: number;
  esLluvia: boolean;
  alertaViento: boolean;
  alertaTormenta: boolean;
}

const CODIGOS_TORMENTA = new Set([95, 96, 99]);
const esCodigoDeLluvia = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);

export function interpretarClima(respuesta: unknown): ClimaData | null {
  const actual = (respuesta as { current?: Record<string, unknown> } | null)?.current;
  if (!actual || typeof actual.temperature_2m !== 'number') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  const codigo = num(actual.weather_code);
  const lluvia = Math.max(num(actual.precipitation), num(actual.rain) + num(actual.showers));
  const vientoVelocidad = Math.round(num(actual.wind_speed_10m));
  const rafagas = Math.round(num(actual.wind_gusts_10m));

  const alertaTormenta = CODIGOS_TORMENTA.has(codigo) || lluvia >= 5 || (lluvia > 0 && vientoVelocidad >= 30);
  const alertaViento = vientoVelocidad >= 35 || rafagas >= 60;

  return {
    temp: Math.round(num(actual.temperature_2m)),
    sensacion: Math.round(num(actual.apparent_temperature)),
    humedad: Math.round(num(actual.relative_humidity_2m)),
    vientoVelocidad,
    rafagas,
    lluvia,
    esLluvia: lluvia > 0 || esCodigoDeLluvia(codigo),
    alertaViento,
    alertaTormenta,
  };
}
