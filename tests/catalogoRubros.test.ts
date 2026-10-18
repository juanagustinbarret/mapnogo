import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGO_RUBROS, RUBROS_DEL_CATALOGO, agruparRubros, categoriaDeRubro } from '../src/lib/catalogoRubros.ts';
import { NOMBRES_DE_ICONOS, visualDeRubro } from '../src/lib/iconosRubro.ts';

// Los 10 rubros que hay hoy en producción (verificado el 18/10)
const EN_PRODUCCION = [
  ['Almacenes y despensas', 'almacenes-despensas'], ['Supermercados', 'supermercados'], ['Panaderías', 'panaderias'],
  ['Carnicerías', 'carnicerias'], ['Rotiserías y restaurantes', 'rotiserias-restaurantes'],
  ['Cafeterías y bares', 'cafeterias-bares'], ['Farmacias', 'farmacias'], ['Indumentaria', 'indumentaria'],
  ['Ferreterías', 'ferreterias'], ['Otros', 'otros'],
];

// Clave para detectar duplicados por variantes: sin tildes, minúsculas y sin
// plurales simples ("pizzería" = "Pizzerías")
const clave = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((palabra) => palabra.replace(/(es|s)$/, ''))
    .join(' ');

test('sin rubros duplicados ni variantes (singular/plural, tildes)', () => {
  const slugs = RUBROS_DEL_CATALOGO.map((r) => r.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs repetidos');
  const claves = RUBROS_DEL_CATALOGO.map((r) => clave(r.nombre));
  const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i);
  assert.deepEqual(repetidas, []);
  for (const r of RUBROS_DEL_CATALOGO) assert.match(r.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, r.slug);
});

test('incluye los rubros pedidos y conserva los existentes sin cambios', () => {
  const nombres = RUBROS_DEL_CATALOGO.map((r) => clave(r.nombre)).join(' | ');
  for (const pedido of ['estudio juridico', 'veterinaria', 'regaleria', 'jugueteria', 'pizzeria', 'heladeria', 'gomeria', 'lubricentro', 'escribania', 'funeraria', 'acopio']) {
    assert.ok(nombres.includes(clave(pedido)), `falta ${pedido}`);
  }
  const existentes = RUBROS_DEL_CATALOGO.filter((r) => r.existente).map((r) => [r.nombre, r.slug]);
  assert.deepEqual(existentes.sort(), [...EN_PRODUCCION].sort());
  assert.ok(RUBROS_DEL_CATALOGO.length > 140);
});

test('cada rubro tiene un ícono registrado y propio', () => {
  for (const r of RUBROS_DEL_CATALOGO) {
    if (r.existente) continue;
    assert.ok(NOMBRES_DE_ICONOS.includes(r.icono), `${r.nombre}: ícono ${r.icono} no registrado`);
    assert.equal(visualDeRubro(r).clave, r.icono, `${r.nombre} no usa su ícono`);
  }
  // Los existentes de la base resuelven a un ícono específico (no el genérico)
  assert.equal(visualDeRubro({ nombre: 'Panaderías', slug: 'panaderias', icono: 'Utensils' }).clave, 'Croissant');
});

test('el SQL propuesto inserta exactamente los rubros nuevos y nunca toca los existentes', () => {
  const sql = readFileSync(new URL('../supabase/propuestas/20261018_rubros_argentina.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /\b(DELETE|UPDATE|DROP|ALTER|TRUNCATE)\b/i);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  const filas = [...sql.matchAll(/\('((?:[^']|'')+)', '([a-z0-9-]+)', '([A-Za-z0-9]+)', true, (\d+)\)/g)];
  const nuevos = RUBROS_DEL_CATALOGO.filter((r) => !r.existente);
  assert.deepEqual(
    filas.map((f) => [f[1].replace(/''/g, "'"), f[2], f[3]]).sort(),
    nuevos.map((r) => [r.nombre, r.slug, r.icono]).sort(),
  );
  assert.ok(filas.every((f) => Number(f[4]) > 100), 'el orden nuevo va después de los existentes');
});

test('agrupa por categoría en el orden del catálogo y manda lo desconocido a "Otros"', () => {
  const grupos = agruparRubros([
    { slug: 'pizzerias' },
    { slug: 'rubro-que-no-existe' },
    { slug: 'farmacias' },
    { slug: 'carnicerias' },
  ]);
  assert.deepEqual(
    grupos.map((g) => [g.categoria, g.rubros.map((r) => r.slug)]),
    [
      ['Almacén y alimentos', ['carnicerias']],
      ['Gastronomía', ['pizzerias']],
      ['Salud', ['farmacias']],
      ['Otros', ['rubro-que-no-existe']],
    ],
  );
  assert.equal(categoriaDeRubro({ slug: 'estudios-juridicos' }), 'Servicios profesionales');
  assert.equal(categoriaDeRubro(null), 'Otros');
  assert.ok(CATALOGO_RUBROS.every((c) => c.rubros.length > 0));
});
