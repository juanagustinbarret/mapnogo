import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVALIDAR_AL_VOLVER_MS,
  avisarCambioPanel,
  borrarCachePanel,
  escucharCambiosPanel,
  guardarCachePanel,
  hayQueRevalidar,
  leerCachePanel,
  mismoUsuario,
  seccionDeRuta,
} from '../src/lib/datosPanel.ts';

test('volver a la pestaña: Supabase manda un user nuevo de la misma persona y el panel no se entera', () => {
  // Supabase (GoTrueClient._recoverAndRefresh) lee la sesión del almacenamiento
  // y avisa SIGNED_IN con un objeto nuevo: misma persona → mismoUsuario = true
  const antes = { id: 'u1', email: 'a@b.com', last_sign_in_at: '2026-10-21T10:00:00Z' };
  const despues = JSON.parse(JSON.stringify(antes));
  assert.notEqual(antes, despues);
  assert.equal(mismoUsuario(antes, despues), true);
  assert.equal(mismoUsuario(antes, { ...antes, id: 'u2' }), false);
  assert.equal(mismoUsuario(antes, { ...antes, email: 'otro@b.com' }), false);
  assert.equal(mismoUsuario(null, null), true);
  assert.equal(mismoUsuario(antes, null), false);
});

test('caché del panel: guarda, lee, se borra al cerrar sesión', () => {
  borrarCachePanel();
  assert.equal(leerCachePanel('inicio:u1'), undefined);
  guardarCachePanel('inicio:u1', { comercio: { id: 'c1' } }, 1000);
  assert.deepEqual(leerCachePanel('inicio:u1'), { datos: { comercio: { id: 'c1' } }, en: 1000 });
  assert.equal(leerCachePanel('inicio:u2'), undefined, 'cada usuario tiene su clave');
  borrarCachePanel();
  assert.equal(leerCachePanel('inicio:u1'), undefined);
});

test('al volver a la pestaña solo se vuelve a pedir si pasaron 5 minutos', () => {
  const t0 = 1_000_000;
  assert.equal(hayQueRevalidar(t0, t0 + 60_000, REVALIDAR_AL_VOLVER_MS), false);
  assert.equal(hayQueRevalidar(t0, t0 + REVALIDAR_AL_VOLVER_MS - 1, REVALIDAR_AL_VOLVER_MS), false);
  assert.equal(hayQueRevalidar(t0, t0 + REVALIDAR_AL_VOLVER_MS, REVALIDAR_AL_VOLVER_MS), true);
});

test('un cambio en una sección avisa a las demás (para que no muestren datos viejos)', () => {
  const recibidos: string[] = [];
  const dejar = escucharCambiosPanel((origen) => recibidos.push(origen));
  avisarCambioPanel('perfil');
  avisarCambioPanel('inicio');
  dejar();
  avisarCambioPanel('perfil');
  assert.deepEqual(recibidos, ['perfil', 'inicio']);
});

test('secciones del panel según la ruta', () => {
  assert.equal(seccionDeRuta('/panel'), 'inicio');
  assert.equal(seccionDeRuta('/panel/'), 'inicio');
  assert.equal(seccionDeRuta('/panel/perfil'), 'perfil');
  assert.equal(seccionDeRuta('/panel/perfil/'), 'perfil');
});
