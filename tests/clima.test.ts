import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarClima } from '../src/lib/clima.ts';

const resp = (actual: Record<string, unknown>) => ({
  current: { temperature_2m: 21.4, apparent_temperature: 20.6, relative_humidity_2m: 60, precipitation: 0, rain: 0, showers: 0, weather_code: 1, wind_speed_10m: 10, wind_gusts_10m: 20, ...actual },
});

test('día tranquilo: sin avisos', () => {
  const c = interpretarClima(resp({}))!;
  assert.equal(c.temp, 21);
  assert.equal(c.alertaTormenta, false);
  assert.equal(c.alertaViento, false);
  assert.equal(c.esLluvia, false);
});

test('regresión: tormenta eléctrica o chaparrón (showers) dispara el aviso', () => {
  // Antes solo se miraba "rain": con rain = 0 no había aviso
  assert.equal(interpretarClima(resp({ weather_code: 95 }))!.alertaTormenta, true);
  assert.equal(interpretarClima(resp({ showers: 6, precipitation: 6 }))!.alertaTormenta, true);
  assert.equal(interpretarClima(resp({ showers: 0.4, weather_code: 80 }))!.esLluvia, true);
});

test('viento: sostenido >= 35 km/h o ráfagas >= 60 km/h', () => {
  assert.equal(interpretarClima(resp({ wind_speed_10m: 36 }))!.alertaViento, true);
  assert.equal(interpretarClima(resp({ wind_gusts_10m: 65 }))!.alertaViento, true);
  assert.equal(interpretarClima(resp({ wind_speed_10m: 20, wind_gusts_10m: 40 }))!.alertaViento, false);
});

test('respuestas inválidas no rompen el widget', () => {
  assert.equal(interpretarClima(null), null);
  assert.equal(interpretarClima({}), null);
  assert.equal(interpretarClima({ error: true, reason: 'limit' }), null);
});
