import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estrellasLlenas, etiquetaPuntaje, fechaResena, formatearPuntaje, textoEstrellas, textoPuntaje } from '../src/lib/puntaje.ts';
import { calcularPuntaje } from '../src/lib/puntajePropio.ts';
import { COLUMNAS_RESENA, MENSAJE_YA_RESENO, marcarResenado, mensajeErrorResena, yaReseno } from '../src/lib/resenas.ts';

test('puntaje con coma decimal y redondeo a un decimal', () => {
  assert.equal(formatearPuntaje(4.56), '4,6');
  assert.equal(formatearPuntaje(4.54), '4,5');
  assert.equal(formatearPuntaje(4.95), '5,0');
  assert.equal(formatearPuntaje(0), null);
  assert.equal(formatearPuntaje(null), null);
  assert.equal(textoPuntaje(4.56, 1234), '4,6 (1.234)');
  assert.equal(textoPuntaje(4.5, 0), null); // sin reseñas: no se muestran estrellas vacías
  assert.equal(textoEstrellas(4.4), '★★★★☆');
  assert.equal(estrellasLlenas(4.6), 5);
  assert.equal(etiquetaPuntaje(4.56, 123), '4,6 de 5 estrellas, 123 reseñas');
  assert.equal(etiquetaPuntaje(5, 1), '5,0 de 5 estrellas, 1 reseña');
  assert.equal(etiquetaPuntaje(null, 0), 'Sin reseñas todavía');
});

test('fecha de la reseña en formato argentino', () => {
  assert.equal(fechaResena('2026-10-21T01:30:00Z'), '20/10/2026');
  assert.equal(fechaResena(null), '');
});

test('puntaje del popup: cero, pocas, muchas e inválidas', () => {
  assert.deepEqual(calcularPuntaje([]), { puntaje: null, total: 0 });
  assert.deepEqual(calcularPuntaje([5, 4]), { puntaje: 4.5, total: 2 });
  const muchas = calcularPuntaje(Array.from({ length: 1000 }, (_, i) => (i % 5) + 1));
  assert.equal(muchas.total, 1000);
  assert.equal(formatearPuntaje(muchas.puntaje), '3,0');
  assert.deepEqual(calcularPuntaje([0, -3, 'x', null, 5]), { puntaje: 5, total: 1 });
  assert.equal(textoPuntaje(calcularPuntaje([5, 4, 4]).puntaje, 3), '4,3 (3)');
});

test('una reseña por IP: mensajes según el error de la base', () => {
  assert.equal(mensajeErrorResena({ code: '23505', message: 'duplicate key value violates unique constraint "resenas_una_por_ip_y_comercio"' }), MENSAJE_YA_RESENO);
  assert.match(mensajeErrorResena({ code: '23514' }), /estrellas van de 1 a 5/);
  assert.match(mensajeErrorResena({ code: '42501', message: 'permission denied' }), /No se pudo publicar/);
  assert.doesNotMatch(mensajeErrorResena({ code: 'XX', message: 'detalle interno' }), /detalle interno/);
  assert.equal(mensajeErrorResena(null), '');
});

test('la app nunca pide la huella de la IP', () => {
  assert.doesNotMatch(COLUMNAS_RESENA, /ip|\*/);
});

test('aviso local de "ya opinaste" (sin romperse si no hay almacenamiento)', () => {
  const datos = new Map<string, string>();
  const almacen = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
  assert.equal(yaReseno('a', almacen), false);
  marcarResenado('a', almacen);
  marcarResenado('a', almacen);
  assert.equal(yaReseno('a', almacen), true);
  assert.equal(yaReseno('b', almacen), false);
  assert.deepEqual(JSON.parse(datos.get('nogoyork:resenas-enviadas:v1')!), ['a']);
  const roto = { getItem: () => '{no es json', setItem: () => { throw new Error('lleno'); } };
  assert.equal(yaReseno('a', roto), false);
  assert.doesNotThrow(() => marcarResenado('a', roto));
  assert.equal(yaReseno('a', null), false);
});
