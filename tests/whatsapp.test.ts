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

import { linkDeRecuperacion, mensajeRecuperacion, patronEmailExacto, urlMailto, urlWhatsAppRecuperacion, generarToken, horaDeVencimiento } from '../src/lib/linksRecuperacion.ts';

test('recuperación: token aleatorio de 48 caracteres hex', () => {
  const a = generarToken();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, generarToken());
});

test('recuperación: link, mensaje y destinos', () => {
  const link = linkDeRecuperacion('https://mapnogo.vercel.app/', 'abc123');
  assert.equal(link, 'https://mapnogo.vercel.app/reset-password?token=abc123');
  assert.match(mensajeRecuperacion(link), /válido por 15 minutos/);
  assert.match(urlWhatsAppRecuperacion('343 545-1818', link), /^https:\/\/wa\.me\/5493435451818\?text=/);
  assert.match(urlWhatsAppRecuperacion('', link), /^https:\/\/wa\.me\/\?text=/);
  assert.match(urlMailto('Juan@x.com', link), /^mailto:Juan%40x\.com\?subject=/);
});

test('recuperación: email sin importar mayúsculas y sin comodines', () => {
  assert.equal(patronEmailExacto('  Juan_Perez@Gmail.com '), 'juan\\_perez@gmail.com');
  assert.equal(patronEmailExacto('a%b@x.com'), 'a\\%b@x.com');
});

test('recuperación: hora de vencimiento en Argentina', () => {
  assert.equal(horaDeVencimiento(new Date('2026-10-20T17:20:00Z')), '14:35');
});
