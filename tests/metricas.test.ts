// Métricas: anti-duplicados, bots, conteo por período en hora argentina,
// comparación y texto del mensaje de WhatsApp. Sin base ni WhatsApp reales.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { llamadas, respuestas, reiniciar, tablas } from './soporte/supabase-falso.mjs';
import {
  VENTANA_SIN_REPETIR_MS,
  decidirRegistro,
  esBot,
  obtenerMetricasConComparacion,
  obtenerMetricasComercio,
  registrarInteraccion,
} from '../src/lib/metrics.ts';
import { describirRango, rangoAnterior, rangoDeAtajo, rangoDesdeUrl, validarRango } from '../src/lib/rangosFechas.ts';
import { armarMensajeMetricas, formatearNumero, urlDetalleMetricas, variacion } from '../src/lib/mensajeMetricas.ts';

const almacen = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => void almacen.set(k, v),
};
const navegadorNormal = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/141 Mobile', webdriver: false };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navegadorNormal });

beforeEach(() => {
  reiniciar();
  almacen.clear();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navegadorNormal });
});

// ─── Registro ───
test('recargar la ficha no suma: mismo comercio y tipo una vez cada 30 minutos', () => {
  const t0 = Date.UTC(2026, 9, 18, 15, 0);
  let r = decidirRegistro({}, 'c1', 'visita', t0);
  assert.equal(r.registrar, true);
  r = decidirRegistro(r.recientes, 'c1', 'visita', t0 + 5 * 60_000);
  assert.equal(r.registrar, false, 'recarga a los 5 minutos');
  assert.equal(decidirRegistro(r.recientes, 'c1', 'whatsapp', t0 + 60_000).registrar, true, 'otro tipo sí cuenta');
  assert.equal(decidirRegistro(r.recientes, 'c2', 'visita', t0 + 60_000).registrar, true, 'otro comercio sí cuenta');
  const despues = decidirRegistro(r.recientes, 'c1', 'visita', t0 + VENTANA_SIN_REPETIR_MS + 1);
  assert.equal(despues.registrar, true, 'pasados 30 minutos vuelve a contar');
});

test('bots y navegadores automatizados no cuentan', () => {
  assert.equal(esBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(esBot('facebookexternalhit/1.1'), true);
  assert.equal(esBot('Mozilla/5.0 HeadlessChrome/141'), true);
  assert.equal(esBot('Mozilla/5.0 Chrome/141', true), true, 'navigator.webdriver');
  assert.equal(esBot(navegadorNormal.userAgent), false);
});

test('registrarInteraccion: usa la función del servidor y no repite en recargas', async () => {
  await registrarInteraccion('c1', 'visita');
  await registrarInteraccion('c1', 'visita');
  const rpc = llamadas.filter((l) => l.operacion === 'rpc');
  assert.equal(rpc.length, 1);
  assert.equal(rpc[0].nombre, 'registrar_interaccion');
  assert.equal(rpc[0].parametros.p_comercio_id, 'c1');
  assert.equal(rpc[0].parametros.p_tipo, 'visita');
  assert.match(rpc[0].parametros.p_visitante, /.{8,}/);
});

test('registrarInteraccion: dueño/admin y bots no generan ninguna llamada', async () => {
  await registrarInteraccion('c1', 'visita', { excluir: true });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Googlebot', webdriver: false } });
  await registrarInteraccion('c2', 'visita');
  assert.equal(llamadas.length, 0);
});

test('registrarInteraccion: si la función no existe todavía, inserta como antes', async () => {
  respuestas.rpc = { error: { code: 'PGRST202', message: 'Could not find the function' } };
  await registrarInteraccion('c9', 'whatsapp');
  assert.deepEqual(
    llamadas.map((l) => l.operacion),
    ['rpc', 'insert'],
  );
  assert.equal(llamadas[1].fila.tipo_interaccion, 'whatsapp');
});

// ─── Períodos ───
test('atajos de período en hora argentina', () => {
  const hoy = '2026-10-18';
  assert.deepEqual(rangoDeAtajo('hoy', hoy), { desde: '2026-10-18', hasta: '2026-10-18' });
  assert.deepEqual(rangoDeAtajo('7d', hoy), { desde: '2026-10-12', hasta: '2026-10-18' });
  assert.deepEqual(rangoDeAtajo('30d', hoy), { desde: '2026-09-19', hasta: '2026-10-18' });
  assert.deepEqual(rangoDeAtajo('mes', hoy), { desde: '2026-10-01', hasta: '2026-10-18' });
  assert.deepEqual(rangoDeAtajo('mes_anterior', hoy), { desde: '2026-09-01', hasta: '2026-09-30' });
  assert.deepEqual(rangoDeAtajo('mes_anterior', '2026-03-05'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rangoDeAtajo('mes_anterior', '2027-01-10'), { desde: '2026-12-01', hasta: '2026-12-31' });
});

test('período anterior: misma cantidad de días, o el mes completo anterior', () => {
  assert.deepEqual(rangoAnterior({ desde: '2026-10-12', hasta: '2026-10-18' }), { desde: '2026-10-05', hasta: '2026-10-11' });
  assert.deepEqual(rangoAnterior({ desde: '2026-10-18', hasta: '2026-10-18' }), { desde: '2026-10-17', hasta: '2026-10-17' });
  assert.deepEqual(rangoAnterior({ desde: '2026-03-01', hasta: '2026-03-31' }), { desde: '2026-02-01', hasta: '2026-02-28' });
});

test('validación del rango personalizado y lectura desde el link', () => {
  const hoy = '2026-10-18';
  assert.equal(validarRango({ desde: '2026-10-01', hasta: '2026-10-18' }, hoy), null);
  assert.match(validarRango({ desde: '2026-10-19', hasta: '2026-10-10' }, hoy)!, /anterior/);
  assert.match(validarRango({ desde: '2026-11-01', hasta: '2026-11-02' }, hoy)!, /futuro/);
  assert.match(validarRango({ desde: '2024-01-01', hasta: '2026-10-18' }, hoy)!, /un año/);
  assert.match(validarRango({ desde: '', hasta: '2026-10-18' }, hoy)!, /dos fechas/);
  assert.deepEqual(rangoDesdeUrl('?desde=2026-10-01&hasta=2026-10-07'), { desde: '2026-10-01', hasta: '2026-10-07' });
  assert.equal(rangoDesdeUrl('?desde=hackeo'), null);
});

// ─── Conteo exacto con datos conocidos ───
test('cuenta exacto por comercio, tipo y días argentinos (borde de medianoche)', async () => {
  tablas.metricas_interacciones = [
    // 17/10 en Argentina
    { comercio_id: 'c1', tipo_interaccion: 'visita', created_at: '2026-10-17T03:00:00Z' }, // 17/10 00:00 ART
    { comercio_id: 'c1', tipo_interaccion: 'visita', created_at: '2026-10-18T02:59:59Z' }, // 17/10 23:59 ART
    { comercio_id: 'c1', tipo_interaccion: 'whatsapp', created_at: '2026-10-17T15:00:00Z' },
    // 16/10 23:59 ART: queda afuera del 17
    { comercio_id: 'c1', tipo_interaccion: 'visita', created_at: '2026-10-17T02:59:59Z' },
    // 18/10 00:00 ART: queda afuera del 17
    { comercio_id: 'c1', tipo_interaccion: 'como_llegar', created_at: '2026-10-18T03:00:00Z' },
    // otro comercio
    { comercio_id: 'c2', tipo_interaccion: 'visita', created_at: '2026-10-17T15:00:00Z' },
  ];
  assert.deepEqual(await obtenerMetricasComercio('c1', { desde: '2026-10-17', hasta: '2026-10-17' }), {
    visitas: 2,
    whatsapp: 1,
    comoLlegar: 0,
  });
  assert.deepEqual(await obtenerMetricasComercio('c1'), { visitas: 3, whatsapp: 1, comoLlegar: 1 });

  const comparacion = await obtenerMetricasConComparacion('c1', { desde: '2026-10-17', hasta: '2026-10-17' });
  assert.deepEqual(comparacion.anterior, { visitas: 1, whatsapp: 0, comoLlegar: 0 });
  assert.deepEqual(comparacion.rangoAnterior, { desde: '2026-10-16', hasta: '2026-10-16' });
});

// ─── Mensaje ───
test('números en formato argentino y comparación', () => {
  assert.equal(formatearNumero(1234), '1.234');
  assert.equal(formatearNumero(1234567), '1.234.567');
  assert.equal(variacion(112, 100), '▲ 12 %');
  assert.equal(variacion(97, 100), '▼ 3 %');
  assert.equal(variacion(5, 5), '= igual');
  assert.equal(variacion(5, 0), 'antes: 0');
  assert.equal(variacion(5, undefined), '');
  assert.equal(describirRango({ desde: '2026-10-01', hasta: '2026-10-31' }), 'del 01/10/2026 al 31/10/2026');
});

test('mensaje de WhatsApp: corto, con período, números, comparación y link', () => {
  const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
  const texto = armarMensajeMetricas({
    nombreComercio: 'Pizzería Don Pepe',
    rango,
    actual: { visitas: 1234, whatsapp: 1, comoLlegar: 78 },
    anterior: { visitas: 1100, whatsapp: 2, comoLlegar: 78 },
    urlDetalle: urlDetalleMetricas('https://mapnogo.vercel.app/', rango),
  });
  assert.equal(
    texto,
    [
      'Hola *Pizzería Don Pepe*! 📊',
      'Tus números en NOGOMAP del 01/10/2026 al 31/10/2026:',
      '',
      '👀 *1.234* visitas a tu ficha (▲ 12 %)',
      '💬 *1* consulta por WhatsApp (▼ 50 %)',
      '📍 *78* pedidos de "Cómo llegar" (= igual)',
      '',
      '_Entre paréntesis, la comparación con el período anterior._',
      '',
      'Ver el detalle: https://mapnogo.vercel.app/panel?desde=2026-10-01&hasta=2026-10-31',
    ].join('\n'),
  );
});
