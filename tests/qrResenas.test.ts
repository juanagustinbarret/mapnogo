import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoQrResenas, matrizQr, rutaQrResenas, svgQr, urlQrResenas } from '../src/lib/qrResenas.ts';

test('el QR codifica una URL estable con el dominio público, no una de Google', () => {
  assert.equal(urlQrResenas('bien-criollo-pizzas'), 'https://mapnogo.vercel.app/n/bien-criollo-pizzas/resenas');
  assert.equal(urlQrResenas('x', 'https://nogomap.com.ar/'), 'https://nogomap.com.ar/n/x/resenas');
  assert.equal(rutaQrResenas('a b'), '/n/a%20b/resenas');
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
