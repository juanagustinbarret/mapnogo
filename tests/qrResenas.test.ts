import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoQrResenas, matrizQr, rutaQrResenas, svgQr, urlQrResenas } from '../src/lib/qrResenas.ts';
import { destinoQrFicha, elegirPorSlugLimpio, patronSlugLimpio, slugLimpio } from '../src/lib/rutasQr.ts';

test('el QR codifica una URL estable con el dominio público, no una de Google', () => {
  assert.equal(urlQrResenas('bien-criollo-pizzas'), 'https://mapnogo.vercel.app/n/bien-criollo-pizzas/resenas');
  assert.equal(urlQrResenas('x', 'https://nogoyork.com.ar/'), 'https://nogoyork.com.ar/n/x/resenas');
  assert.equal(rutaQrResenas('a b'), '/n/a-b/resenas');
  assert.equal(destinoQrResenas('bien-criollo-pizzas'), '/comercio/bien-criollo-pizzas#resenas');
  assert.doesNotMatch(urlQrResenas('x'), /google/);
});

test('matriz QR válida (versión chica para una URL corta) y SVG con margen', () => {
  const m = matrizQr(urlQrResenas('bien-criollo-pizzas'));
  assert.ok(m.length >= 25 && m.length <= 41, `tamaño ${m.length}`);
  assert.ok(m.every((f) => f.length === m.length));
  // patrones de posición en las tres esquinas (7x7 con borde oscuro)
  for (const [x, y] of [[0, 0], [m.length - 7, 0], [0, m.length - 7]]) {
    assert.ok(m[y][x] && m[y][x + 6] && m[y + 6][x] && m[y + 6][x + 6] && m[y + 3][x + 3]);
    assert.equal(m[y + 1][x + 1], false);
  }
  const svg = svgQr('https://mapnogo.vercel.app/n/x/resenas');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.match(svg, /<path d="M4,4h1v1h-1z/); // el primer módulo oscuro empieza después del margen de 4
});

test('slug cargado a mano con espacios y mayúsculas: el QR sale limpio (sin %20)', () => {
  // Caso real: el QR de "BIEN CRIOLLO PIZZAS" salía .../n/BIEN%20CRIOLLO%20PIZZAS/resenas
  // y el lector de Xiaomi lo mostraba como texto.
  assert.equal(urlQrResenas('BIEN CRIOLLO PIZZAS'), 'https://mapnogo.vercel.app/n/bien-criollo-pizzas/resenas');
  assert.equal(slugLimpio('  Almacén  Don Tito! '), 'almacen-don-tito');
  assert.equal(slugLimpio('Ñandú & Cía.'), 'nandu-cia');
  assert.equal(slugLimpio('ya-limpio-2'), 'ya-limpio-2');
  assert.equal(destinoQrResenas('BIEN CRIOLLO PIZZAS'), '/comercio/bien-criollo-pizzas#resenas');
  assert.equal(destinoQrFicha('BIEN%20CRIOLLO'.replace('%20', ' ')), '/comercio/bien-criollo');
  // si no queda nada limpio, se usa el original codificado (no una URL vacía)
  assert.equal(rutaQrResenas('???'), '/n/%3F%3F%3F/resenas');
  for (const s of ['BIEN CRIOLLO PIZZAS', 'Almacén Don Tito', 'ñoquis-de-la-abuela']) {
    assert.match(urlQrResenas(s), /^https:\/\/[a-z0-9.-]+\/n\/[a-z0-9-]+\/resenas$/);
  }
});

test('la ficha encuentra el comercio aunque el slug guardado esté escrito distinto', () => {
  const patron = patronSlugLimpio('almacen-don-tito');
  assert.equal(patron, '_lm_c__%d__%t_t_');
  assert.doesNotMatch(patron, /[^a-z0-9_%]/);
  const filas = [{ slug: 'Almacenes Donato' }, { slug: 'Almacén Don Tito' }, { slug: 'otro' }];
  assert.deepEqual(elegirPorSlugLimpio(filas, 'almacen-don-tito'), { slug: 'Almacén Don Tito' });
  assert.equal(elegirPorSlugLimpio(filas, 'no-existe'), null);
  assert.equal(elegirPorSlugLimpio(null, 'x'), null);
});
