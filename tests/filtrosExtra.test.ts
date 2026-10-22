import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esNuevo, filtrarComerciosMapa, tieneBuenPuntaje, type FiltrosMapa } from '../src/lib/filtrosAvanzados.ts';

const AHORA = new Date('2026-10-21T18:00:00Z');
const base: FiltrosMapa = { busqueda: '', rubroId: '', soloAbiertos: false, soloDelivery: false, soloFarmaciasTurno: false };
const abierto = { estado: 'abierto' } as any;
const cerrado = { estado: 'cerrado' } as any;
const c = (id: string, extra: Record<string, unknown> = {}) => ({
  id, nombre: id, habilitado_admin: true, rubro_id: 'pizzerias', medios_pago: ['Efectivo'], tiene_delivery: false,
  estadoAtencion: abierto, created_at: '2025-01-01T00:00:00Z', tieneOfertas: false, puntajeNogoyork: null, ...extra,
});
const LISTA = [
  c('muzza', { tieneOfertas: true, puntajeNogoyork: { puntaje: 4.6, total: 12 }, tiene_delivery: true, estadoDelivery: { estado: 'activo' } }),
  c('nueva', { created_at: '2026-10-10T12:00:00Z', puntajeNogoyork: { puntaje: 5, total: 1 } }),
  c('cerrada', { tieneOfertas: true, estadoAtencion: cerrado, puntajeNogoyork: { puntaje: 4.2, total: 5 }, medios_pago: ['Transferencia'] }),
  c('farmacia', { rubro_id: 'farmacias', tieneOfertas: true, created_at: '2026-10-20T12:00:00Z' }),
  c('oculta', { habilitado_admin: false, tieneOfertas: true }),
];
const ids = (f: Partial<FiltrosMapa>, farmacias: string[] = []) => filtrarComerciosMapa(LISTA, { ...base, ...f }, farmacias, AHORA).map((x) => x.id);

test('mejor puntaje: 4★ o más con al menos 3 reseñas (una sola de 5★ no alcanza)', () => {
  assert.equal(tieneBuenPuntaje({ puntaje: 4, total: 3 }), true);
  assert.equal(tieneBuenPuntaje({ puntaje: 3.9, total: 50 }), false);
  assert.equal(tieneBuenPuntaje({ puntaje: 5, total: 2 }), false);
  assert.equal(tieneBuenPuntaje({ puntaje: null, total: 0 }), false);
  assert.equal(tieneBuenPuntaje(null), false);
});

test('nuevos: se sumaron en los últimos 30 días', () => {
  assert.equal(esNuevo('2026-10-10T12:00:00Z', AHORA), true);
  assert.equal(esNuevo('2026-09-20T12:00:00Z', AHORA), false);
  assert.equal(esNuevo('2026-11-01T00:00:00Z', AHORA), false, 'fecha futura (dato raro) no cuenta');
  assert.equal(esNuevo(null, AHORA), false);
});

test('cada filtro nuevo solo, sin mostrar comercios ocultos', () => {
  assert.deepEqual(ids({ soloConOfertas: true }), ['muzza', 'cerrada', 'farmacia']);
  assert.deepEqual(ids({ soloMejorPuntaje: true }), ['muzza', 'cerrada']);
  assert.deepEqual(ids({ soloNuevos: true }), ['nueva', 'farmacia']);
});

test('combinados con los existentes: abiertos, delivery, rubro, medio de pago, búsqueda y farmacia de turno', () => {
  assert.deepEqual(ids({ soloConOfertas: true, soloAbiertos: true }), ['muzza', 'farmacia']);
  assert.deepEqual(ids({ soloConOfertas: true, soloMejorPuntaje: true }), ['muzza', 'cerrada']);
  assert.deepEqual(ids({ soloConOfertas: true, soloMejorPuntaje: true, soloAbiertos: true }), ['muzza']);
  assert.deepEqual(ids({ soloMejorPuntaje: true, soloDelivery: true, conMomentoDelivery: true }), ['muzza']);
  assert.deepEqual(ids({ soloConOfertas: true, rubroId: 'farmacias' }), ['farmacia']);
  assert.deepEqual(ids({ soloConOfertas: true, medioPago: 'transferencia' }), ['cerrada']);
  assert.deepEqual(ids({ soloNuevos: true, busqueda: 'NUEVA' }), ['nueva']);
  assert.deepEqual(ids({ soloConOfertas: true, soloFarmaciasTurno: true }, ['farmacia']), ['farmacia']);
  assert.deepEqual(ids({ soloNuevos: true, soloMejorPuntaje: true }), []);
});

test('sin filtros nuevos el resultado no cambia (no rompe lo que ya había)', () => {
  assert.deepEqual(ids({}), ['muzza', 'nueva', 'cerrada', 'farmacia']);
  assert.deepEqual(ids({ soloConOfertas: false, soloMejorPuntaje: false, soloNuevos: false }), ['muzza', 'nueva', 'cerrada', 'farmacia']);
});
