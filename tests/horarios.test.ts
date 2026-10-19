// "Abierto Ahora": estado de la tarjeta y filtro del listado. Siempre en hora
// de Argentina, con turnos que cruzan la medianoche y 24 hs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarEstadoHorario } from '../src/lib/scheduleEvaluator.ts';
import { comercioEstaAbiertoAhora, filtrarComerciosMapa } from '../src/lib/filtrosAvanzados.ts';

const LUNES = 0, MARTES = 1, DOMINGO = 6;
const turno = (dia: number, apertura: string, cierre: string, activo = true) => ({
  id: `${dia}-${apertura}`, comercio_id: 'c', dia_semana: dia, turno: 1,
  hora_apertura: `${apertura}:00`, hora_cierre: `${cierre}:00`, cruza_medianoche: false, activo,
});
// Lunes 19/10/2026 en Argentina (UTC-3): "HH:MM" del lunes → instante UTC
const lunes = (hora: string) => new Date(`2026-10-19T${hora}:00-03:00`);
const martes = (hora: string) => new Date(`2026-10-20T${hora}:00-03:00`);

test('turno normal: apertura inclusiva, cierre exclusivo, cierra pronto', () => {
  const h = [turno(LUNES, '09:00', '13:00')];
  assert.equal(evaluarEstadoHorario(h, lunes('08:59')).estado, 'cerrado');
  assert.deepEqual(evaluarEstadoHorario(h, lunes('09:00')), { estado: 'abierto', mensaje: 'Abierto hasta las 13:00' });
  assert.deepEqual(evaluarEstadoHorario(h, lunes('12:40')), { estado: 'cierra_pronto', mensaje: 'Cierra pronto (20 min)' });
  assert.equal(evaluarEstadoHorario(h, lunes('13:00')).estado, 'cerrado');
});

test('regresión: el turno del lunes 20:00–02:00 sigue abierto el martes a la 01:00', () => {
  const h = [turno(LUNES, '20:00', '02:00')];
  assert.deepEqual(evaluarEstadoHorario(h, lunes('23:00')), { estado: 'abierto', mensaje: 'Abierto hasta las 02:00' });
  // Antes: "Cerrado hoy", porque el martes no tiene turnos
  assert.equal(evaluarEstadoHorario(h, martes('01:00')).estado, 'abierto');
  assert.deepEqual(evaluarEstadoHorario(h, martes('01:40')), { estado: 'cierra_pronto', mensaje: 'Cierra pronto (20 min)' });
  assert.equal(evaluarEstadoHorario(h, martes('00:30')).mensaje, 'Abierto hasta las 02:00');
  assert.equal(evaluarEstadoHorario(h, martes('02:00')).estado, 'cerrado');
});

test('regresión: la madrugada del día no es del turno que empieza esa noche', () => {
  // Martes 20:00–02:00: el martes a la 01:00 todavía no abrió (antes decía "Abierto")
  const h = [turno(MARTES, '20:00', '02:00')];
  assert.equal(evaluarEstadoHorario(h, martes('01:00')).estado, 'cerrado');
  assert.equal(evaluarEstadoHorario(h, martes('21:00')).estado, 'abierto');
});

test('domingo a la noche sigue el lunes a la madrugada', () => {
  const h = [turno(DOMINGO, '21:00', '01:00')];
  assert.equal(evaluarEstadoHorario(h, lunes('00:15')).estado, 'abierto');
  assert.equal(evaluarEstadoHorario(h, lunes('00:45')).estado, 'cierra_pronto');
});

test('24 hs (00:00 a 00:00) figura abierto; toda la semana no "cierra pronto"', () => {
  assert.equal(evaluarEstadoHorario([turno(LUNES, '00:00', '00:00')], lunes('15:00')).estado, 'abierto');
  const semana = [0, 1, 2, 3, 4, 5, 6].map((d) => turno(d, '00:00', '00:00'));
  assert.deepEqual(evaluarEstadoHorario(semana, lunes('23:50')), { estado: 'abierto', mensaje: 'Abierto las 24 hs' });
  // Dos días seguidos de 24 hs: el lunes 23:50 no cierra pronto
  const dos = [turno(LUNES, '00:00', '00:00'), turno(MARTES, '00:00', '00:00')];
  assert.equal(evaluarEstadoHorario(dos, lunes('23:50')).estado, 'abierto');
});

test('turnos inactivos y sin horarios', () => {
  assert.equal(evaluarEstadoHorario([], lunes('10:00')).estado, 'no_informado');
  assert.equal(evaluarEstadoHorario([turno(LUNES, '09:00', '13:00', false)], lunes('10:00')).estado, 'cerrado');
  assert.equal(evaluarEstadoHorario([turno(MARTES, '09:00', '13:00')], lunes('10:00')).mensaje, 'Cerrado hoy');
});

test('la zona horaria del dispositivo no cambia el resultado', () => {
  const original = process.env.TZ;
  const h = [turno(LUNES, '20:00', '02:00')];
  try {
    for (const tz of ['Asia/Tokyo', 'UTC', 'America/Los_Angeles', 'Europe/Madrid']) {
      process.env.TZ = tz;
      assert.equal(comercioEstaAbiertoAhora(h, martes('00:30')), true, tz);
      assert.equal(comercioEstaAbiertoAhora(h, martes('03:00')), false, tz);
    }
  } finally {
    process.env.TZ = original;
  }
});

const comercio = (extra: Record<string, unknown>) => ({
  id: 'x', nombre: 'X', habilitado_admin: true, rubro_id: 'r1', direccion: 'San Martín 100', horarios: [], ...extra,
});

test('filtro Abierto Ahora: coincide con la etiqueta de la tarjeta', () => {
  const ahora = martes('00:30');
  const bar = comercio({ id: 'bar', horarios: [turno(LUNES, '20:00', '02:00')] });
  const cafe = comercio({ id: 'cafe', horarios: [turno(MARTES, '07:00', '12:00')] });
  const filtros = { busqueda: '', rubroId: '', soloAbiertos: true, soloDelivery: false, soloFarmaciasTurno: false };
  assert.deepEqual(filtrarComerciosMapa([bar, cafe], filtros, [], ahora).map((c) => c.id), ['bar']);
  // Si ya viene evaluado (como en el inicio), usa ese estado
  const evaluado = { ...cafe, estadoAtencion: { estado: 'cierra_pronto', mensaje: '' } };
  assert.deepEqual(filtrarComerciosMapa([evaluado], filtros, [], ahora).map((c) => c.id), ['cafe']);
});

test('búsqueda: sin tildes ni mayúsculas, también por rubro, categoría, descripción y servicios', () => {
  const pizzeria = comercio({ id: 'p', nombre: 'Don Pepe', rubro: { nombre: 'Pizzerías', slug: 'pizzerias' } });
  const farmacia = comercio({ id: 'f', nombre: 'Farmacia Nogoyá', rubro: { nombre: 'Farmacias', slug: 'farmacias' }, servicios: ['Inyectables'] });
  const kiosco = comercio({ id: 'k', nombre: 'Kiosco', descripcion_corta: 'Golosinas y café' });
  const lista = [pizzeria, farmacia, kiosco];
  const buscar = (busqueda: string) =>
    filtrarComerciosMapa(lista, { busqueda, rubroId: '', soloAbiertos: false, soloDelivery: false, soloFarmaciasTurno: false }).map((c) => c.id);
  assert.deepEqual(buscar('pizzeria'), ['p']);
  assert.deepEqual(buscar('NOGOYA'), ['f']);
  assert.deepEqual(buscar('salud'), ['f']);
  assert.deepEqual(buscar('inyectable'), ['f']);
  assert.deepEqual(buscar('cafe'), ['k']);
  assert.deepEqual(buscar('  '), ['p', 'f', 'k']);
});

test('filtro de delivery: con delivery y sin pausa vigente', () => {
  const ahora = new Date('2026-10-19T22:00:00-03:00');
  const lista = [
    comercio({ id: 'si', tiene_delivery: true }),
    comercio({ id: 'pausado', tiene_delivery: true, delivery_pausado_hasta: '2026-10-19T23:00:00-03:00' }),
    comercio({ id: 'pausa-vencida', tiene_delivery: true, delivery_pausado_hasta: '2026-10-19T21:00:00-03:00' }),
    comercio({ id: 'no', tiene_delivery: false }),
  ];
  const filtros = { busqueda: '', rubroId: '', soloAbiertos: false, soloDelivery: true, soloFarmaciasTurno: false };
  assert.deepEqual(filtrarComerciosMapa(lista, filtros, [], ahora).map((c) => c.id), ['si', 'pausa-vencida']);
});
