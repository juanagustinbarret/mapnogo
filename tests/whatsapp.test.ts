import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate, normalizeWhatsAppNumber, variablesSinCompletar } from '../src/lib/whatsapp.ts';

const PLANTILLA =
  'Hola 👋 El [VENCIMIENTO] vence la suscripción de [NOMBRE DEL COMERCIO] por [IMPORTE] (período [PERIODO]).';

test('compileTemplate reemplaza las variables exactas, sin tocar otras letras', () => {
  const texto = compileTemplate(PLANTILLA, {
    nombreComercio: 'Pizzería Don Pepe',
    importe: '$ 10.000',
    vencimiento: '10/11/2026',
    periodoFacturado: '11/2026',
  });
  assert.equal(texto, 'Hola 👋 El 10/11/2026 vence la suscripción de Pizzería Don Pepe por $ 10.000 (período 11/2026).');
  assert.deepEqual(variablesSinCompletar(texto), []);
});

test('regresión: antes /[IMPORTE]/g reemplazaba cada letra I, M, P, O, R, T, E', () => {
  const texto = compileTemplate('PERIODO E IMPORTE: [IMPORTE]', { importe: '$5' });
  assert.equal(texto, 'PERIODO E IMPORTE: $5');
});

test('las variables sin dato quedan visibles para no enviar mensajes con huecos', () => {
  const texto = compileTemplate(PLANTILLA, { nombreComercio: 'Kiosco' });
  assert.deepEqual(variablesSinCompletar(texto).sort(), ['[IMPORTE]', '[PERIODO]', '[VENCIMIENTO]']);
});

test('admite [FECHA DE VENCIMIENTO] y plantillas vacías', () => {
  assert.equal(compileTemplate('Vence el [FECHA DE VENCIMIENTO]', { vencimiento: '01/12/2026' }), 'Vence el 01/12/2026');
  assert.equal(compileTemplate('', { nombreComercio: 'X' }), '');
});

test('normaliza teléfonos de Nogoyá y no duplica el 549', () => {
  assert.equal(normalizeWhatsAppNumber('3435 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('+54 9 3435 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('03435-123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('15 123456').normalized, '5493435123456');
  assert.equal(normalizeWhatsAppNumber('').isValid, false);
});
