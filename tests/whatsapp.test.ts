import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppNumber } from '../src/lib/whatsapp.ts';

test('normaliza teléfonos de Nogoyá y no duplica el 549', () => {
  assert.equal(normalizeWhatsAppNumber('3435 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('+54 9 3435 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('03435-123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('15 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('').isValid, false);
});
