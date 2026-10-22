// Clima: interpretación de MET Norway y la función /api/clima
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarMetNorway, puntoCardinal, responderClima, segundosDeCache, sensacionTermica, UMBRAL_VIENTO_KMH, USER_AGENT_CLIMA } from '../src/lib/clima.ts';

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
  assert.equal('rafagas' in c, false); // MET Norway no trae ráfagas para Argentina: no se inventan
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

test('viento: aviso cuando la velocidad prevista en las próximas horas llega a UMBRAL_VIENTO_KMH', () => {
  assert.equal(UMBRAL_VIENTO_KMH, 50);
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_speed: 13.5 })), AHORA)!.alertaViento, false); // 49 km/h
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_speed: 14 })), AHORA)!.alertaViento, true); // 50 km/h
  // Ráfagas de MET Norway (si vinieran) no cuentan: solo la velocidad media
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_speed: 5, wind_speed_of_gust: 25 })), AHORA)!.alertaViento, false);
  // Viento fuerte previsto a las 6 h: avisa ahora; a las 13 h: todavía no
  const dentro = interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}), paso('2026-10-20T21:00:00Z', { wind_speed: 15 })), AHORA)!;
  assert.deepEqual({ viento: dentro.vientoVelocidad, maximo: dentro.vientoMaximo, aviso: dentro.alertaViento }, { viento: 11, maximo: 54, aviso: true });
  const fuera = interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {}), paso('2026-10-21T04:00:00Z', { wind_speed: 15 })), AHORA)!;
  assert.deepEqual({ maximo: fuera.vientoMaximo, aviso: fuera.alertaViento }, { maximo: 11, aviso: false });
});

test('dirección del viento: grados a punto cardinal', () => {
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', { wind_from_direction: 70.5 })), AHORA)!.direccionViento, 'E');
  assert.equal(interpretarMetNorway(resp(paso('2026-10-20T15:00:00Z', {})), AHORA)!.direccionViento, '');
  assert.deepEqual([0, 44, 135, 225, 300, 350, 360].map(puntoCardinal), ['N', 'NE', 'SE', 'SO', 'NO', 'N', 'N']);
  assert.equal(puntoCardinal(null), '');
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
    { temp: c.temp, sensacion: c.sensacion, humedad: c.humedad, viento: c.vientoVelocidad, direccion: c.direccionViento, tormenta: c.alertaTormenta, lluvia: c.esLluvia },
    { temp: 13, sensacion: 12, humedad: 74, viento: 14, direccion: 'E', tormenta: false, lluvia: false },
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

test('caché: hasta Expires, como mínimo 5 minutos', () => {
  assert.equal(segundosDeCache(new Date(AHORA.getTime() + 20 * 60_000).toUTCString(), AHORA), 1200);
  assert.equal(segundosDeCache(new Date(AHORA.getTime() + 3 * 3600_000).toUTCString(), AHORA), 10800); // no antes de Expires
  assert.equal(segundosDeCache(new Date(AHORA.getTime() - 60_000).toUTCString(), AHORA), 300);
  assert.equal(segundosDeCache(null, AHORA), 900);
});

test('/api/clima: se identifica ante MET Norway y devuelve el clima con caché', async () => {
  let pedido: { url: string; headers: Record<string, string> } | null = null;
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    pedido = { url, headers: init?.headers as Record<string, string> };
    return new Response(JSON.stringify(resp(paso('2026-10-20T15:00:00Z', {}))), {
      headers: { Expires: new Date(AHORA.getTime() + 20 * 60_000).toUTCString(), 'Last-Modified': 'Tue, 20 Oct 2026 15:00:00 GMT' },
    });
  }) as typeof fetch;
  const r = await responderClima(fetchFalso, AHORA);
  assert.equal(r.status, 200);
  assert.match(pedido!.url, /^https:\/\/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/complete\?lat=-32\.3942&lon=-59\.7881$/);
  assert.equal(pedido!.headers['User-Agent'], USER_AGENT_CLIMA);
  assert.match(r.headers.get('Cache-Control')!, /max-age=1200/);
  assert.equal((await r.json()).temp, 21);
});

test('/api/clima: no consulta antes de Expires; después pregunta con If-Modified-Since (304 = mismos datos)', async () => {
  // Sigue la consulta del test anterior: vence a los 20 minutos
  const pedidos: Record<string, string>[] = [];
  const fetch304 = (async (_url: string, init?: RequestInit) => {
    pedidos.push(init?.headers as Record<string, string>);
    return new Response(null, { status: 304, headers: { Expires: new Date(AHORA.getTime() + 60 * 60_000).toUTCString() } });
  }) as typeof fetch;
  const antes = await responderClima(fetch304, new Date(AHORA.getTime() + 10 * 60_000));
  assert.equal(antes.status, 200);
  assert.equal(pedidos.length, 0);
  assert.match(antes.headers.get('Cache-Control')!, /max-age=600/);
  const despues = await responderClima(fetch304, new Date(AHORA.getTime() + 30 * 60_000));
  assert.equal(despues.status, 200);
  assert.equal(pedidos[0]['If-Modified-Since'], 'Tue, 20 Oct 2026 15:00:00 GMT');
  assert.equal(pedidos[0]['User-Agent'], USER_AGENT_CLIMA);
  assert.equal((await despues.json()).temp, 21);
  assert.match(despues.headers.get('Cache-Control')!, /max-age=1800/);
});

test('/api/clima: si MET Norway falla, 502 sin caché', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const r = await responderClima((async () => new Response('', { status: 503 })) as typeof fetch, new Date(AHORA.getTime() + 2 * 3600_000));
    assert.equal(r.status, 502);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  } finally {
    console.error = original;
  }
});
