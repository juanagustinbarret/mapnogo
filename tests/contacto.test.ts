import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTACTO, nombreResponsable, whatsappLegible } from '../src/lib/contacto.ts';

test('WhatsApp de soporte legible', () => {
  assert.equal(whatsappLegible('5493435451818'), '+54 9 343 545-1818');
  assert.equal(whatsappLegible('123'), '123');
});

test('sin responsables cargados, el texto no queda vacío', () => {
  const antes = CONTACTO.responsables;
  try {
    CONTACTO.responsables = '';
    assert.equal(nombreResponsable(), 'los administradores de NOGOMAP');
    CONTACTO.responsables = 'Ana Pérez';
    assert.equal(nombreResponsable(), 'Ana Pérez');
  } finally {
    CONTACTO.responsables = antes;
  }
});
