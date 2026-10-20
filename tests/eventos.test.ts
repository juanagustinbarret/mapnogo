import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horaCorta, textoFechaEvento, textoHorarioEvento } from '../src/lib/eventos.ts';

test('fecha del evento en formato argentino (antes se mostraba 2026-10-25)', () => {
  assert.equal(textoFechaEvento('2026-10-25'), '25/10/2026');
  assert.equal(textoFechaEvento(''), '');
  assert.equal(textoFechaEvento(null), '');
});

test('horario del evento sin segundos ni "??"', () => {
  assert.equal(horaCorta('21:00:00'), '21:00');
  assert.equal(horaCorta('9:30'), '09:30');
  assert.equal(horaCorta('x'), '');
  assert.equal(textoHorarioEvento('21:00:00', '23:30:00'), '21:00 a 23:30 hs');
  assert.equal(textoHorarioEvento('21:00:00', null), '21:00 hs'); // antes: "21:00:00 a ??"
  assert.equal(textoHorarioEvento(null, '23:00'), '');
});
