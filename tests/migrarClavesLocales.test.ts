import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVES_RENOMBRADAS, migrarClavesLocales } from '../src/lib/migrarClavesLocales.ts';
import { CLAVE_LOCAL_RESENAS } from '../src/lib/resenas.ts';

const almacen = (inicial: Record<string, string>) => {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
};

test('cambio de nombre: lo guardado con la clave vieja pasa a la nueva y la vieja se borra', () => {
  const a = almacen({ 'nogomap:visitante': 'v-123', 'nogomap:resenas-enviadas:v1': '["c1"]', 'nogoya_theme': 'dark' });
  migrarClavesLocales(a);
  assert.equal(a.getItem('nogoyork:visitante'), 'v-123');
  assert.equal(a.getItem('nogoyork:resenas-enviadas:v1'), '["c1"]');
  assert.equal(a.getItem('nogomap:visitante'), null);
  assert.equal(a.getItem('nogoya_theme'), 'dark'); // lo demás no se toca
  migrarClavesLocales(a); // otra vez: no cambia nada
  assert.equal(a.datos.size, 3);
});

test('si ya existe la clave nueva, no se pisa con la vieja', () => {
  const a = almacen({ 'nogomap:visitante': 'viejo', 'nogoyork:visitante': 'nuevo' });
  migrarClavesLocales(a);
  assert.equal(a.getItem('nogoyork:visitante'), 'nuevo');
  assert.equal(a.getItem('nogomap:visitante'), null);
});

test('sin almacenamiento o con error, no rompe', () => {
  migrarClavesLocales(null);
  migrarClavesLocales({ getItem: () => { throw new Error('bloqueado'); }, setItem: () => {}, removeItem: () => {} });
  assert.ok(CLAVES_RENOMBRADAS.every(([v, n]) => v.startsWith('nogomap:') && n === v.replace('nogomap:', 'nogoyork:')));
  assert.ok(CLAVES_RENOMBRADAS.some(([, n]) => n === CLAVE_LOCAL_RESENAS));
});
