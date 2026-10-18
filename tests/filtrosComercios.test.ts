// Combinación de filtros del listado: búsqueda, rubro, Abiertos Ahora,
// Delivery activo, radio y orden por cercanía.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarComercios, type OpcionesFiltro } from '../src/lib/filtrosComercios.ts';
import { estadoDeliveryEn } from '../src/lib/delivery.ts';

const pizzeria = { nombre: 'Pizzerías', slug: 'pizzerias' };
const farmacia = { nombre: 'Farmacias', slug: 'farmacias' };
const MARTES_2130 = { dia: 1, minutos: 21 * 60 + 30 };
const deliveryNoche = [{ dia_semana: 1, hora_inicio: '20:00', hora_fin: '00:30' }];
const deliveryMediodia = [{ dia_semana: 1, hora_inicio: '12:00', hora_fin: '15:00' }];

const base = [
  { id: 'a', nombre: 'Pizzería Don Pepe', rubro_id: 'r1', rubro: pizzeria, distancia: 0.4, estadoAtencion: { estado: 'abierto' }, estadoDelivery: estadoDeliveryEn(deliveryNoche, MARTES_2130) },
  { id: 'b', nombre: 'Bien Criollo Pizzas', rubro_id: 'r1', rubro: pizzeria, distancia: 1.2, estadoAtencion: { estado: 'cerrado' }, estadoDelivery: estadoDeliveryEn(deliveryNoche, MARTES_2130) },
  { id: 'c', nombre: 'Pizzas Mediodía', rubro_id: 'r1', rubro: pizzeria, distancia: 0.2, estadoAtencion: { estado: 'cierra_pronto' }, estadoDelivery: estadoDeliveryEn(deliveryMediodia, MARTES_2130) },
  { id: 'd', nombre: 'Farmacia del Centro', rubro_id: 'r2', rubro: farmacia, distancia: 0.1, estadoAtencion: { estado: 'abierto' }, estadoDelivery: estadoDeliveryEn([], MARTES_2130) },
  { id: 'e', nombre: 'Almacén sin ubicar', rubro_id: 'r3', rubro: null, distancia: null, estadoAtencion: { estado: 'abierto' }, estadoDelivery: estadoDeliveryEn(deliveryNoche, MARTES_2130) },
];
const opciones = (o: Partial<OpcionesFiltro> = {}): OpcionesFiltro => ({
  busqueda: '', rubroId: '', soloAbiertos: false, soloDelivery: false, radioKm: null, ordenamiento: 'cercania', ...o,
});
const ids = (o: Partial<OpcionesFiltro>) => filtrarComercios(base, opciones(o)).map((c) => c.id);

test('sin filtros: todos, ordenados por cercanía (los sin ubicar al final)', () => {
  assert.deepEqual(ids({}), ['d', 'c', 'a', 'b', 'e']);
  assert.deepEqual(ids({ ordenamiento: 'nombre' }), ['e', 'b', 'd', 'c', 'a']);
});

test('Delivery activo: solo los que tienen delivery en ese momento', () => {
  assert.deepEqual(ids({ soloDelivery: true }), ['a', 'b', 'e']);
});

test('Delivery activo + Abiertos Ahora ("cierra pronto" cuenta como abierto)', () => {
  assert.deepEqual(ids({ soloDelivery: true, soloAbiertos: true }), ['a', 'e']);
  assert.deepEqual(ids({ soloAbiertos: true }), ['d', 'c', 'a', 'e']);
});

test('Delivery activo + rubro + búsqueda sin tildes', () => {
  assert.deepEqual(ids({ soloDelivery: true, rubroId: 'r1' }), ['a', 'b']);
  assert.deepEqual(ids({ soloDelivery: true, busqueda: 'criollo' }), ['b']);
  assert.deepEqual(ids({ busqueda: 'pizzeria' }), ['c', 'a', 'b'], 'busca por rubro');
  assert.deepEqual(ids({ soloDelivery: true, rubroId: 'r2' }), []);
});

test('Delivery activo + radio de cercanía', () => {
  assert.deepEqual(ids({ soloDelivery: true, radioKm: 1 }), ['a']);
});
