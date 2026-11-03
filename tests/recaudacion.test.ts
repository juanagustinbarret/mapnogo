import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRecaudacion, nombreDelMes } from '../src/lib/recaudacion.ts';
import { aCentavos, formatearCentavos } from '../src/lib/formatters.ts';

const sinEspacios = (s: string) => s.replace(/\s/g, ' ');

test('recaudación: se formatea desde centavos en es-AR, sin errores de coma flotante', () => {
  assert.equal(sinEspacios(formatearCentavos(123456789)), '$ 1.234.567,89');
  assert.equal(sinEspacios(formatearCentavos(30)), '$ 0,30'); // 0,10 + 0,20 sumados en centavos
  assert.equal(sinEspacios(formatearCentavos(0)), '$ 0,00');
  assert.equal(sinEspacios(formatearCentavos(1500000)), '$ 15.000,00');
  // 0.1 + 0.2 en coma flotante da 0.30000000000000004; en centavos, 30 exacto
  assert.equal([0.1, 0.2].reduce((a, n) => a + aCentavos(n), 0), 30);
  assert.equal(aCentavos('1234.56'), 123456);
  assert.equal(aCentavos(19.99), 1999); // 19.99 * 100 = 1998.9999999999998 en coma flotante
  assert.equal(aCentavos(null), 0);
});

test('recaudación: respuesta del servidor válida o descartada', () => {
  assert.deepEqual(leerRecaudacion({ total_centavos: 123456, desde: '2026-11-01', hasta: '2026-11-30' }), { centavos: 123456, desde: '2026-11-01', hasta: '2026-11-30' });
  assert.deepEqual(leerRecaudacion({ total_centavos: '0', desde: '2026-11-01', hasta: '2026-11-30' })?.centavos, 0);
  for (const malo of [null, undefined, {}, { total_centavos: 1.5, desde: '2026-11-01', hasta: '2026-11-30' }, { total_centavos: -1, desde: '2026-11-01', hasta: '2026-11-30' }, { total_centavos: 10, desde: 'noviembre', hasta: '2026-11-30' }]) {
    assert.equal(leerRecaudacion(malo), null, JSON.stringify(malo));
  }
});

test('recaudación: nombre del mes', () => {
  assert.equal(nombreDelMes('2026-11-01'), 'noviembre de 2026');
  assert.equal(nombreDelMes('2026-12-01'), 'diciembre de 2026');
});
