// Armado de los mensajes de WhatsApp del panel (sin enviar nada).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANTILLAS_PREDETERMINADAS,
  armarRecordatorio,
  completarPlantilla,
  convertirSintaxisVieja,
  leerPlantillasGuardadas,
  quitarVariable,
  validarPlantilla,
  variablesSinResolver,
} from '../src/lib/plantillasMensajes.ts';
import { armarMensajeMetricas } from '../src/lib/mensajeMetricas.ts';

const P = PLANTILLAS_PREDETERMINADAS;
const conSub = { precio_acordado: 12000, proximo_vencimiento: '2026-11-10', plan: 'Plan Estándar Comercio' };

test('con suscripción: recordatorio completo, importe y fecha en formato argentino', () => {
  const r = armarRecordatorio({ nombre: 'BIEN CRIOLLO PIZZAS', whatsappValido: true, suscripcion: conSub }, P);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tipo, 'recordatorio_pago');
  assert.equal(
    r.texto,
    '¡Hola BIEN CRIOLLO PIZZAS! 👋 Te escribimos de NOGOYORK.\n' +
      'Te recordamos que tu suscripción de $ 12.000 vence el 10/11/2026.\n' +
      'Cuando hagas el pago, avisanos por acá así lo registramos.\n' +
      '¡Gracias por ser parte de NOGOYORK! 🙌',
  );
  assert.deepEqual(r.faltantes, []);
  assert.equal(r.aviso, undefined);
});

test('regresión: sin suscripción ya no se bloquea con [IMPORTE]; arma la invitación', () => {
  const r = armarRecordatorio({ nombre: 'BIEN CRIOLLO PIZZAS', whatsappValido: true, suscripcion: null }, P);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tipo, 'invitacion_suscripcion');
  assert.doesNotMatch(r.texto, /\[|\{|\$/, 'sin placeholders ni importe');
  assert.match(r.texto, /^¡Hola BIEN CRIOLLO PIZZAS! 👋 Te escribimos de NOGOYORK\./);
  assert.match(r.aviso!, /no tiene una suscripción/);
});

test('suscripción sin importe: se marca {importe} para completar o quitar', () => {
  const r = armarRecordatorio(
    { nombre: 'Kiosco', whatsappValido: true, suscripcion: { precio_acordado: null, proximo_vencimiento: '2026-11-10' } },
    P,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.faltantes, ['importe']);
  assert.deepEqual(variablesSinResolver(r.texto), ['importe']);
  assert.match(r.aviso!, /no tiene importe/);
  // Completar a mano
  const completado = r.texto.split('{importe}').join('$ 9.500');
  assert.deepEqual(variablesSinResolver(completado), []);
  assert.match(completado, /suscripción de \$ 9\.500 vence/);
  // Variante sin importe
  const sinImporte = quitarVariable(r.texto, 'importe');
  assert.match(sinImporte, /Te recordamos que tu suscripción vence el 10\/11\/2026\./);
  assert.deepEqual(variablesSinResolver(sinImporte), []);
});

test('importe en cero cuenta como sin importe', () => {
  const r = armarRecordatorio({ nombre: 'X', whatsappValido: true, suscripcion: { precio_acordado: 0, proximo_vencimiento: '2026-11-10' } }, P);
  assert.ok(r.ok && r.faltantes.includes('importe'));
});

test('sin WhatsApp válido: error específico, sin mensaje', () => {
  const r = armarRecordatorio({ nombre: 'Farmacia del Centro', whatsappValido: false, suscripcion: conSub }, P);
  assert.deepEqual(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, 'sin_whatsapp');
  assert.match(r.mensajeError, /Farmacia del Centro.*WhatsApp/);
});

test('plantilla editada por el admin se respeta (y la sintaxis vieja se convierte)', () => {
  const guardadas = leerPlantillasGuardadas({
    recordatorio_pago: 'Che [NOMBRE DEL COMERCIO], te toca pagar [IMPORTE] el [VENCIMIENTO]. Plan: {plan}',
    proximo_vencimiento: 'texto viejo que ya no se usa',
  });
  const r = armarRecordatorio({ nombre: 'Kiosco Pepe', whatsappValido: true, suscripcion: conSub }, guardadas);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.texto, 'Che Kiosco Pepe, te toca pagar $ 12.000 el 10/11/2026. Plan: Plan Estándar Comercio');
  // Sin plantillas guardadas → predeterminadas
  assert.deepEqual(leerPlantillasGuardadas(null), P);
  assert.equal(convertirSintaxisVieja('[FECHA DE VENCIMIENTO] / [PERIODO]'), '{fecha_vencimiento} / {periodo}');
});

test('variables sin resolver después de editar bloquean el envío (y se listan)', () => {
  assert.deepEqual(variablesSinResolver('Hola {nombre_comercio}, pagá {importe}'), ['nombre_comercio', 'importe']);
  assert.deepEqual(variablesSinResolver('Precio {sin_definir} y llaves sueltas'), [], 'solo cuentan las variables conocidas');
  const { texto, faltantes } = completarPlantilla('Hola {nombre_comercio} {importe}', { nombre_comercio: 'A', importe: '' });
  assert.equal(texto, 'Hola A {importe}');
  assert.deepEqual(faltantes, ['importe']);
});

test('validación de la plantilla general', () => {
  assert.deepEqual(validarPlantilla(P.recordatorio_pago, 'recordatorio_pago'), { errores: [], advertencias: [] });
  assert.deepEqual(validarPlantilla(P.invitacion_suscripcion, 'invitacion_suscripcion').errores, []);
  assert.deepEqual(validarPlantilla(P.metricas, 'metricas'), { errores: [], advertencias: [] });
  assert.match(validarPlantilla('', 'recordatorio_pago').errores[0], /vacío/);
  assert.match(validarPlantilla('Hola {importe}', 'invitacion_suscripcion').errores.join(), /\{importe\}/);
  assert.match(validarPlantilla('Hola [IMPORTE] {nombre_comercio}', 'recordatorio_pago').errores.join(), /sintaxis nueva/);
  assert.match(validarPlantilla('Hola {nombre_comercio', 'recordatorio_pago').errores.join(), /llave/);
  assert.match(validarPlantilla('x'.repeat(1600) + '{nombre_comercio}', 'metricas').errores.join(), /largo/);
  assert.match(validarPlantilla('Hola', 'recordatorio_pago').advertencias.join(), /nombre_comercio/);
});

test('todos los mensajes predeterminados dicen NOGOYORK y no traen sintaxis vieja', () => {
  for (const texto of Object.values(P)) {
    assert.match(texto, /NOGOYORK/);
    assert.doesNotMatch(texto, /\[[A-Z ]+\]|Nogoy[aá] Cerca/i);
  }
});

test('mensaje de métricas con la plantilla predeterminada y con una editada', () => {
  const datos = {
    nombreComercio: 'Pizzería Don Pepe',
    rango: { desde: '2026-10-01', hasta: '2026-10-31' },
    actual: { visitas: 1234, whatsapp: 1, comoLlegar: 78 },
    anterior: { visitas: 1100, whatsapp: 2, comoLlegar: 78 },
    urlDetalle: 'https://mapnogo.vercel.app/panel?desde=2026-10-01&hasta=2026-10-31',
  };
  assert.equal(
    armarMensajeMetricas(datos).texto,
    [
      '¡Hola Pizzería Don Pepe! 📊 Estos son tus números en NOGOYORK del 01/10/2026 al 31/10/2026:',
      '',
      '👀 *1.234* visitas a tu ficha (▲ 12 %)',
      '💬 *1* consulta por WhatsApp (▼ 50 %)',
      '📍 *78* pedidos de "Cómo llegar" (= igual)',
      '',
      'Mirá el detalle en tu panel: https://mapnogo.vercel.app/panel?desde=2026-10-01&hasta=2026-10-31',
      '¡Gracias por ser parte de NOGOYORK! 🙌',
    ].join('\n'),
  );
  assert.equal(
    armarMensajeMetricas(datos, '{nombre_comercio}: {visitas} visitas {periodo}').texto,
    'Pizzería Don Pepe: 1.234 visitas del 01/10/2026 al 31/10/2026',
  );
  const sinLink = armarMensajeMetricas({ ...datos, urlDetalle: undefined });
  assert.deepEqual(sinLink.faltantes, ['link_panel']);
});
