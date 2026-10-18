import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasEntre, hoyArgentina, sumarDias, textoVencimiento } from '../src/lib/fechasArgentina.ts';

test('hoyArgentina usa UTC-3: a las 22 h de Argentina sigue siendo el mismo día', () => {
  // 18/10/2026 22:30 en Argentina = 19/10/2026 01:30 UTC
  assert.equal(hoyArgentina(new Date('2026-10-19T01:30:00Z')), '2026-10-18');
  assert.equal(hoyArgentina(new Date('2026-10-19T03:00:00Z')), '2026-10-19');
});

test('sumarDias y diasEntre cruzan fin de mes y de año', () => {
  assert.equal(sumarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(diasEntre('2026-10-31', '2026-11-01'), 1);
  assert.equal(diasEntre('2026-10-18', '2026-10-17'), -1);
});

test('textoVencimiento: hoy, mañana, en N días, fecha y vencida', () => {
  const hoy = '2026-10-18';
  assert.deepEqual(textoVencimiento('2026-10-18', hoy), { texto: 'Vence hoy', estaPorVencer: true });
  assert.deepEqual(textoVencimiento('2026-10-19', hoy), { texto: 'Vence mañana', estaPorVencer: true });
  assert.deepEqual(textoVencimiento('2026-10-21T00:00:00', hoy), { texto: 'Vence en 3 días', estaPorVencer: true });
  assert.deepEqual(textoVencimiento('2026-11-30', hoy), { texto: 'Hasta el 30/11/2026', estaPorVencer: false });
  assert.deepEqual(textoVencimiento('2026-10-17', hoy), { texto: 'Vencida', estaPorVencer: true });
  assert.deepEqual(textoVencimiento(null, hoy), { texto: '', estaPorVencer: false });
});

import { estaVigente, fechaCalendario, formatearFecha, formatearFechaHora, limitesDelRango } from '../src/lib/fechasArgentina.ts';
import { formatDate } from '../src/lib/formatters.ts';

test('fecha_fin como la devuelve la base (medianoche UTC) se muestra sin correr el día', () => {
  // Bug de "Mis Publicaciones": se veía "Hasta: 2026-11-17T00:00:00+00:00"
  assert.equal(fechaCalendario('2026-11-17T00:00:00+00:00'), '2026-11-17');
  assert.equal(formatearFecha('2026-11-17T00:00:00+00:00'), '17/11/2026');
  assert.equal(formatearFecha('2026-11-17'), '17/11/2026');
  assert.equal(formatDate('2026-11-17T00:00:00+00:00'), '17/11/2026');
  assert.equal(formatearFecha(''), '');
  assert.equal(formatearFecha(null), '');
});

test('borde de medianoche: una oferta "hasta el 17" vale todo el 17 en Argentina', () => {
  const fin = '2026-11-17T00:00:00+00:00';
  // 16/11 21:30 en Argentina (00:30 UTC del 17): sigue vigente
  assert.equal(estaVigente(fin, hoyArgentina(new Date('2026-11-17T00:30:00Z'))), true);
  // 17/11 23:59 en Argentina (02:59 UTC del 18): sigue vigente
  assert.equal(estaVigente(fin, hoyArgentina(new Date('2026-11-18T02:59:00Z'))), true);
  // 18/11 00:01 en Argentina (03:01 UTC): vencida
  assert.equal(estaVigente(fin, hoyArgentina(new Date('2026-11-18T03:01:00Z'))), false);
  assert.equal(estaVigente(null, '2026-11-18'), true);
});

test('instantes (created_at) se muestran en hora argentina', () => {
  // 18/10 01:30 UTC = 17/10 22:30 en Argentina
  assert.equal(formatearFecha('2026-10-18T01:30:00.123+00:00'), '17/10/2026');
  assert.equal(formatearFechaHora('2026-10-18T01:30:00Z'), '17/10/2026 22:30');
  assert.equal(formatDate('2026-10-16T12:57:05.993781+00:00'), '16/10/2026');
});

test('limitesDelRango cubre días argentinos completos', () => {
  assert.deepEqual(limitesDelRango('2026-10-01', '2026-10-31'), {
    desdeISO: '2026-10-01T00:00:00-03:00',
    hastaISO: '2026-11-01T00:00:00-03:00',
  });
});
