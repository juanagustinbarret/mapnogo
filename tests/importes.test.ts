import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerImporte } from '../src/lib/importes.ts';

test('importes en formato argentino', () => {
  assert.equal(leerImporte('10000'), 10000);
  assert.equal(leerImporte('10.000'), 10000); // antes parseFloat daba 10
  assert.equal(leerImporte('$ 12.000'), 12000);
  assert.equal(leerImporte('1.250.000'), 1250000);
  assert.equal(leerImporte('12.000,50'), 12000.5);
  assert.equal(leerImporte('9500,5'), 9500.5);
  assert.equal(leerImporte('10.5'), 10.5);
  assert.equal(leerImporte(15000), 15000);
});

test('importes inválidos, cero o negativos', () => {
  for (const malo of ['', '0', '0,00', '-5000', 'abc', '10..000', '1,2,3', '12.00.0', null, undefined, 0, -1, NaN]) {
    assert.equal(leerImporte(malo as never), null, String(malo));
  }
});
