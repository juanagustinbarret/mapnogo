// Clima: interpretación de MET Norway y la función /api/clima
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarMetNorway, responderClima, segundosDeCache, sensacionTermica, USER_AGENT_CLIMA } from '../src/lib/clima.ts';

const AHORA = new Date('2026-10-20T15:20:00Z');
const paso = (time: string, instante: Record<string, unknown>, proxima: Record<string, unknown> = {}, simbolo = 'partlycloudy_day') => ({
  time,
  data: {
    instant: { details: { air_temperature: 21.4, relative_humidity: 60, wind_speed: 3, wind_speed_of_gust: 5, ...instante } },
    next_1_hours: { summary: { symbol_code: simbolo }, details: { precipitation_amount: 0, probability_of_thunder: 0, ...proxima } },
  },
});
const resp = (...pasos: unknown[]) => ({ properties: { timeseries: pasos } });

test('día tranquilo: temperatura, km/h y sin avisos', () => {
  const c = interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {})), AHORA)!;
  assert.equal(c.temp, 21);
  assert.equal(c.vientoVelocidad, 11); // 3 m/s = 10,8 km/h
  assert.equal(c.rafagas, 18);
  assert.equal(c.alertaTormenta, false);
  assert.equal(c.alertaViento, false);
  assert.equal(c.esLluvia, false);
  assert.equal(c.actualizado, '2026-10-20T15:00:00Z');
});

test('usa el paso de la hora actual, no uno viejo', () => {
  const c = interpretarMetNorway(resp(paso('2026-10-20T12:00:00Z', { air_temperature: 10 }), paso('2026-10-20T15:00:00Z', { air_temperature: 25 })), AHORA)!;
  assert.equal(c.temp, 25);
});

test('tormenta: símbolo con "thunder", probabilidad alta o lluvia fuerte', () => {
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}, {}, 'heavyrainandthunder')), AHORA)!.alertaTormenta, true);
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}, { probability_of_thunder: 60 })), AHORA)!.alertaTormenta, true);
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}, { precipitation_amount: 6 }, 'heavyrain')), AHORA)!.alertaTormenta, true);
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}, { precipitation_amount: 0.3 }, 'lightrain')), AHORA)!.esLluvia, true);
});

test('viento: sostenido >= 35 km/h o ráfagas >= 60 km/h', () => {
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_speed: 10, wind_speed_of_gust: 12 })), AHORA)!.alertaViento, true); // 36 km/h
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_speed: 5, wind_speed_of_gust: 17 })), AHORA)!.alertaViento, true); // ráfagas 61
});

test('respuesta real de MET Norway para Nogoyá (20/10/2026 11:00 UTC): sin ráfagas ni prob. de tormenta', () => {
  // Valores copiados de api.met.no para lat=-32.3942 lon=-59.7881
  const real = resp({
    time: '2026-10-20T11:00:00Z',
    data: {
      instant: { details: { air_pressure_at_sea_level: 1018.7, air_temperature: 13.1, apparent_air_temperature: 11.8, relative_humidity: 74.2, wind_from_direction: 70.5, wind_speed: 4.0 } },
      next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0.0 } },
    },
  });
  const c = interpretarMetNorway(real, new Date('2026-10-20T11:30:00Z'))!;
  assert.deepEqual(
    { temp: c.temp, sensacion: c.sensacion, humedad: c.humedad, viento: c.vientoVelocidad, rafagas: c.rafagas, tormenta: c.alertaTormenta, lluvia: c.esLluvia },
    { temp: 13, sensacion: 12, humedad: 74, viento: 14, rafagas: 14, tormenta: false, lluvia: false },
  );
});

test('sensación térmica: más calor con humedad, más frío con viento', () => {
  assert.ok(sensacionTermica(30, 80, 1) > 30);
  assert.ok(sensacionTermica(10, 50, 8) < 10);
});

test('respuestas inválidas no rompen nada', () => {
  assert.equal(interpretarMetNorway(null, AHORA), null);
  assert.equal(interpretarMetNorway({}, AHORA), null);
  assert.equal(interpretarMetNorway(resp(), AHORA), null);
  assert.equal(interpretarMetNorway(resp({ time: 'x', data: {} }), AHORA), null);
});

test('caché: respeta Expires entre 5 y 30 minutos', () => {
  assert.equal(segundosDeCache(new Date(AHORA.getTime() + 20 * 60_000).toUTCString(), AHORA), 1200);
  assert.equal(segundosDeCache(new Date(AHORA.getTime() + 3 * 3600_000).toUTCString(), AHORA), 1800);
  assert.equal(segundosDeCache(new Date(AHORA.getTime() - 60_000).toUTCString(), AHORA), 300);
  assert.equal(segundosDeCache(null, AHORA), 900);
});

test('/api/clima: se identifica ante MET Norway y devuelve el clima con caché', async () => {
  let pedido: { url: string; headers: Record<string, string> } | null = null;
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    pedido = { url, headers: init?.headers as Record<string, string> };
    return new Response(JSON.stringify(resp(paso('2026-10-20T15:00:00Z', {}))), {
      headers: { Expires: new Date(AHORA.getTime() + 20 * 60_000).toUTCString() },
    });
  }) as typeof fetch;
  const r = await responderClima(fetchFalso, AHORA);
  assert.equal(r.status, 200);
  assert.match(pedido!.url, /^https:\/\/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/complete\?lat=-32\.3942&lon=-59\.7881$/);
  assert.equal(pedido!.headers['User-Agent'], USER_AGENT_CLIMA);
  assert.match(r.headers.get('Cache-Control')!, /max-age=1200/);
  assert.equal((await r.json()).temp, 21);
});

test('/api/clima: si MET Norway falla, 502 sin caché', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const r = await responderClima((async () => new Response('', { status: 503 })) as typeof fetch, AHORA);
    assert.equal(r.status, 502);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  } finally {
    console.error = original;
  }
});
