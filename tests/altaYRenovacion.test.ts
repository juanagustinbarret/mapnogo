import { test } from 'node:test';
import assert from 'node:assert/strict';
import { condicionesDelAlta, esADistancia, numeroDeAlta, primerVencimiento, textoComprobante } from '../src/lib/comprobanteAlta.ts';
import { estadoSuscripcion, mensajeRenovacion, urlRenovacion } from '../src/lib/renovacion.ts';

const datos = {
  comercioId: '3f9a1c2e-0000-4000-8000-000000000000',
  fecha: new Date('2026-10-21T01:30:00Z'), // 20/10 22:30 en Argentina
  titular: 'Juan Pérez',
  documento: 'DNI 30.123.456',
  comercio: 'Almacén Tito',
  rubro: 'Almacenes',
  direccion: 'San Martín 123',
  whatsapp: '3435451818',
  email: 'tito@x.com',
  plan: 'Básico',
  precioMensual: 10000,
  primerVencimiento: '2026-11-10',
  diasGracia: 5,
  medio: 'whatsapp' as const,
};

test('alta: número de comprobante estable con fecha argentina', () => {
  assert.equal(numeroDeAlta(datos.comercioId, datos.fecha), 'ALTA-20261020-3F9A1C');
});

test('alta: primer vencimiento el 10 del mes siguiente (también en diciembre)', () => {
  assert.equal(primerVencimiento('2026-10-20'), '2026-11-10');
  assert.equal(primerVencimiento('2026-12-31'), '2027-01-10');
});

test('alta: arrepentimiento solo si fue a distancia', () => {
  assert.equal(esADistancia('presencial'), false);
  assert.ok(condicionesDelAlta(datos).some((c) => c.includes('10 días corridos')));
  assert.ok(!condicionesDelAlta({ ...datos, medio: 'presencial' }).some((c) => c.includes('10 días corridos')));
});

test('alta: el comprobante tiene precio final, vencimiento, aceptación y datos', () => {
  const t = textoComprobante(datos);
  assert.match(t, /N° ALTA-20261020-3F9A1C · 20\/10\/2026 22:30/);
  assert.match(t, /\$\s?10\.000 por mes \(precio final\)/);
  assert.match(t, /Primer vencimiento: 10\/11\/2026/);
  assert.match(t, /Titular: Juan Pérez · DNI 30\.123\.456/);
  assert.match(t, /leyó y acepta los Términos/);
  assert.doesNotMatch(t, /\n\n\n/);
  assert.match(textoComprobante({ ...datos, precioMensual: null, whatsapp: '' }), /según el plan vigente/);
});

test('renovación: mensaje con el negocio elegido y WhatsApp del admin', () => {
  const n = { id: '3f9a1c2e-0000', nombre: 'Almacén Tito', direccion: 'San Martín 123', precio: 10000, vencimiento: '2026-11-10', estado: 'vencida' };
  const m = mensajeRenovacion(n);
  assert.match(m, /Comercio: Almacén Tito \(San Martín 123\)/);
  assert.match(m, /Código: 3F9A1C/);
  assert.match(m, /Vencimiento: 10\/11\/2026/);
  assert.ok(urlRenovacion(n, '5493435451818').startsWith('https://wa.me/5493435451818?text=Hola!'));
  assert.doesNotMatch(mensajeRenovacion({ id: 'ab', nombre: 'X' }), /Plan actual|Vencimiento|\n\n\n/);
});

test('estado de la suscripción con su color', () => {
  assert.equal(estadoSuscripcion('vencida').texto, 'Vencida');
  assert.match(estadoSuscripcion('vencida').clase, /red/);
  assert.equal(estadoSuscripcion(null).texto, 'Sin datos');
});
