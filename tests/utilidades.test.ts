import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppUrl, compileTemplate, normalizeWhatsAppNumber } from '../src/lib/whatsapp';
import { diasHasta, hoyArgentina, momentoArgentina, periodoActual, sumarDias } from '../src/lib/fechas';
import { formatDate, formatPeriodo } from '../src/lib/formatters';

test('normaliza números de WhatsApp argentinos', () => {
  const casos: [string, string][] = [
    ['3435123456', '5493435123456'],
    ['0343 5123456', '5493435123456'],
    ['+54 9 343 512-3456', '5493435123456'],
    ['54 3435123456', '5493435123456'],
    ['15 123456', '5493435123456'],
    ['123456', '5493435123456'],
  ];
  for (const [entrada, esperado] of casos) {
    const r = normalizeWhatsAppNumber(entrada);
    assert.equal(r.isValid, true, entrada);
    assert.equal(r.normalized, esperado, entrada);
  }
  assert.equal(normalizeWhatsAppNumber('').isValid, false);
  assert.equal(normalizeWhatsAppNumber('12').isValid, false);
});

test('buildWhatsAppUrl devuelve null con un número inválido', () => {
  assert.equal(buildWhatsAppUrl('12'), null);
  assert.equal(buildWhatsAppUrl('3435123456', 'Hola y chau'), 'https://wa.me/5493435123456?text=Hola%20y%20chau');
});

test('compileTemplate reemplaza variables completas y no letras sueltas', () => {
  const plantilla = 'Hola [NOMBRE DEL COMERCIO]: debés [IMPORTE] del período [PERIODO]. NOMBRE e IMPORTE quedan igual. [IMPORTE]';
  const r = compileTemplate(plantilla, { nombreComercio: 'La Esquina', importe: '$ 10.000', periodoFacturado: 'octubre 2026' });
  assert.equal(r, 'Hola La Esquina: debés $ 10.000 del período octubre 2026. NOMBRE e IMPORTE quedan igual. $ 10.000');
});

test('fechas en hora argentina', () => {
  // 01:00 UTC del 15/10 todavía es 14/10 en Argentina
  const ahora = new Date('2026-10-15T01:00:00Z');
  assert.equal(hoyArgentina(ahora), '2026-10-14');
  assert.equal(periodoActual(ahora), '2026-10');
  assert.deepEqual(momentoArgentina(ahora), { dia: 2, minutos: 22 * 60 });
  assert.equal(diasHasta('2026-10-20', ahora), 6);
  assert.equal(diasHasta('2026-10-10', ahora), -4);
  assert.equal(sumarDias('2026-10-30', 3), '2026-11-02');
});

test('formatDate no se corre de día', () => {
  assert.equal(formatDate('2026-10-10'), '10/10/2026');
  // Fin de promoción guardado como 23:59 hora argentina (02:59 UTC del día siguiente)
  assert.equal(formatDate('2026-11-14T02:59:59+00:00'), '13/11/2026');
  assert.equal(formatDate(''), '');
});

test('formatPeriodo', () => {
  assert.equal(formatPeriodo('2026-10'), 'octubre 2026');
});
