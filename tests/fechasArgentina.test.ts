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
