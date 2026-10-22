import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esTablaFaltante, fotosParaMostrar, type FotoComercio } from '../src/lib/fotosComercio.ts';
import { COLUMNAS_LISTADO_COMERCIO, COLUMNAS_PUBLICAS_COMERCIO } from '../src/lib/columnasPublicas.ts';

const f = (id: string, estado: FotoComercio['estado'], url: string | null): FotoComercio => ({ id, comercio_id: 'c1', estado, motivo: null, url, ancho: 1, alto: 1, created_at: '' });

test('ficha: solo fotos aprobadas, después las viejas, y cada una sabe cómo reportarse', () => {
  const r = fotosParaMostrar([f('a', 'aprobada', 'https://s/a.webp'), f('p', 'pendiente', 'https://s/p.webp'), f('x', 'aprobada', null)], ['data:vieja0', '', 'data:vieja2']);
  assert.deepEqual(r, [
    { url: 'https://s/a.webp', fotoId: 'a', indiceGaleria: undefined },
    { url: 'data:vieja0', fotoId: undefined, indiceGaleria: 0 },
    { url: 'data:vieja2', fotoId: undefined, indiceGaleria: 2 }, // conserva su posición real en galeria_urls
  ]);
  assert.deepEqual(fotosParaMostrar([], null), []);
});

test('si la base todavía no tiene la tabla de fotos, la app sigue con la galería anterior', () => {
  assert.equal(esTablaFaltante({ code: '42P01', message: 'relation "public.fotos_comercio" does not exist' }), true);
  assert.equal(esTablaFaltante({ code: 'PGRST205', message: "Could not find the table 'public.fotos_comercio' in the schema cache" }), true);
  assert.equal(esTablaFaltante({ code: '42501', message: 'permission denied' }), false);
  assert.equal(esTablaFaltante(null), false);
});

test('los listados ya no descargan las fotos ni la descripción larga', () => {
  assert.ok(COLUMNAS_PUBLICAS_COMERCIO.includes('galeria_urls'));
  assert.ok(!COLUMNAS_LISTADO_COMERCIO.includes('galeria_urls'));
  assert.ok(!COLUMNAS_LISTADO_COMERCIO.includes('descripcion_completa'));
  assert.ok(COLUMNAS_LISTADO_COMERCIO.includes('medios_pago') && COLUMNAS_LISTADO_COMERCIO.includes('tiene_delivery'));
});
