import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codigoDeSolicitud, mensajeSolicitud } from '../src/lib/bajaServicio.ts';

test('código de constancia con fecha argentina y 4 caracteres fáciles de dictar', () => {
  const codigo = codigoDeSolicitud('baja', new Date('2026-10-21T01:00:00Z')); // 20/10 22:00 en Argentina
  assert.match(codigo, /^BAJA-20261020-[A-HJ-NP-Z2-9]{4}$/);
  assert.match(codigoDeSolicitud('arrepentimiento'), /^ARR-\d{8}-[A-HJ-NP-Z2-9]{4}$/);
});

test('mensaje de baja y de arrepentimiento', () => {
  const baja = mensajeSolicitud({ tipo: 'baja', codigo: 'BAJA-20261020-AB12', comercio: ' Almacén Tito ', contacto: '343 5451818' });
  assert.match(baja, /^BOTÓN DE BAJA DE SERVICIO - NOGOYORK\n/);
  assert.match(baja, /Comercio: Almacén Tito\n/);
  assert.match(baja, /Código de constancia: BAJA-20261020-AB12$/);
  assert.doesNotMatch(baja, /Comentario/);
  assert.doesNotMatch(baja, /\n\n\n/);
  const arr = mensajeSolicitud({ tipo: 'arrepentimiento', codigo: 'ARR-1', comercio: 'X', contacto: 'y', comentario: 'no lo usé' });
  assert.match(arr, /art\. 34 Ley 24\.240/);
  assert.match(arr, /Comentario: no lo usé/);
});
