// Pedidos de eliminación de reseñas: permisos y reglas de la función moderar-resenas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manejar, type Entorno } from '../supabase/functions/moderar-resenas/index.ts';
import { validarMotivo, validarNota } from '../supabase/functions/_shared/moderacionResenas.ts';

const AHORA = new Date('2026-10-26T15:00:00Z');
const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const R1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'; // reseña de C1
const R2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'; // reseña de C2
const MOTIVO = 'Es una reseña falsa, esa persona nunca vino al local.';

interface Mundo {
  resenas: any[];
  comercios: any[];
  profiles: any[];
  solicitudes_eliminacion_resena: any[];
  auditoria_moderacion_resenas: any[];
  usuarios: Record<string, string>;
}
const mundo = (): Mundo => ({
  resenas: [
    { id: R1, comercio_id: C1, nombre_usuario: 'Juan', comentario: 'Malísimo', eliminada_at: null, eliminada_por: null },
    { id: R2, comercio_id: C2, nombre_usuario: 'Ana', comentario: 'No me gustó', eliminada_at: null, eliminada_por: null },
  ],
  comercios: [{ id: C1, propietario_id: 'u-c1' }, { id: C2, propietario_id: 'u-c2' }],
  profiles: [{ id: 'u-admin', rol: 'admin' }, { id: 'u-c1', rol: 'comerciante' }, { id: 'u-c2', rol: 'comerciante' }],
  solicitudes_eliminacion_resena: [],
  auditoria_moderacion_resenas: [],
  usuarios: { 'tok-admin': 'u-admin', 'tok-c1': 'u-c1', 'tok-c2': 'u-c2' },
});

// PostgREST mínimo: select, eq., gte.
function filtrar(filas: any[], q: URLSearchParams) {
  return filas.filter((f) =>
    [...q.entries()].every(([k, v]) => {
      if (k === 'select') return true;
      if (v.startsWith('eq.')) return String(f[k]) === v.slice(3);
      if (v.startsWith('gte.')) return String(f[k]) >= v.slice(4);
      throw new Error(`filtro no soportado ${k}=${v}`);
    }),
  );
}

let ids = 0;
function entorno(m: Mundo): Entorno {
  const fetchFalso = async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(String(entrada));
    assert.equal(u.host, 'base.supabase.co', `pedido a la red real bloqueado: ${u.href}`);
    const cab = init.headers as Record<string, string>;
    if (u.pathname === '/auth/v1/user') {
      const tok = String(cab.Authorization).replace('Bearer ', '');
      return m.usuarios[tok] ? Response.json({ id: m.usuarios[tok] }) : new Response('{}', { status: 401 });
    }
    assert.equal(cab.Authorization, 'Bearer servicio', 'la base se consulta con la clave de servicio');
    const tabla = u.pathname.replace('/rest/v1/', '');
    const filas = (m as any)[tabla] as any[];
    assert.ok(filas, `tabla inesperada ${tabla}`);
    const metodo = init.method ?? 'GET';
    if (metodo === 'GET') return Response.json(filtrar(filas, u.searchParams));
    if (metodo === 'POST') {
      const fila = { id: `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`, created_at: AHORA.toISOString(), ...JSON.parse(String(init.body)) };
      // Índice único parcial: una pendiente por reseña
      if (tabla === 'solicitudes_eliminacion_resena' && filas.some((f) => f.resena_id === fila.resena_id && f.estado === 'pendiente')) {
        return new Response('{"code":"23505"}', { status: 409 });
      }
      filas.push(fila);
      return Response.json([fila], { status: 201 });
    }
    if (metodo === 'PATCH') {
      const r = filtrar(filas, u.searchParams);
      r.forEach((f) => Object.assign(f, JSON.parse(String(init.body))));
      return Response.json(r);
    }
    throw new Error('método no soportado');
  };
  return {
    leer: (n) => ({ SUPABASE_URL: 'https://base.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio' } as Record<string, string>)[n],
    fetch: fetchFalso as typeof fetch,
    ahora: () => AHORA,
    log: () => {},
  };
}
const pedido = (cuerpo: object, token?: string) =>
  new Request('https://base.supabase.co/functions/v1/moderar-resenas', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
const llamar = async (m: Mundo, cuerpo: object, token?: string) => {
  const r = await manejar(pedido(cuerpo, token), entorno(m));
  return { status: r.status, json: await r.json() };
};
const solicitar = (m: Mundo, token: string, resena = R1, motivo = MOTIVO) => llamar(m, { accion: 'solicitar', resena_id: resena, motivo }, token);

test('reglas: motivo de 10 a 500 caracteres (sin contar espacios de los bordes) y nota opcional hasta 500', () => {
  assert.equal(validarMotivo('   corto   ').ok, false);
  assert.equal(validarMotivo('x'.repeat(501)).ok, false);
  assert.deepEqual(validarMotivo('  Es una reseña falsa  '), { ok: true, motivo: 'Es una reseña falsa' });
  assert.equal(validarMotivo(undefined).ok, false);
  assert.deepEqual(validarNota(''), { ok: true, nota: null });
  assert.equal(validarNota('x'.repeat(501)).ok, false);
});

test('sin sesión no se puede hacer nada (ni pedir ni resolver)', async () => {
  const m = mundo();
  assert.equal((await llamar(m, { accion: 'solicitar', resena_id: R1, motivo: MOTIVO })).status, 401);
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: R1, aprobar: true })).status, 401);
  assert.equal((await llamar(m, { accion: 'solicitar', resena_id: R1, motivo: MOTIVO }, 'tok-falso')).status, 401);
  assert.equal((await llamar(m, { accion: 'solicitar', resena_id: R1, motivo: MOTIVO }, 'servicio')).status, 401, 'la clave de servicio no sirve como sesión');
  assert.equal(m.solicitudes_eliminacion_resena.length, 0);
});

test('el comercio pide sobre una reseña suya: queda pendiente, con copia de la reseña y auditoría', async () => {
  const m = mundo();
  const r = await solicitar(m, 'tok-c1');
  assert.equal(r.status, 200);
  const s = m.solicitudes_eliminacion_resena[0];
  assert.deepEqual(
    { resena: s.resena_id, comercio: s.comercio_id, por: s.solicitado_por, estado: s.estado, motivo: s.motivo, resumen: s.resena_resumen },
    { resena: R1, comercio: C1, por: 'u-c1', estado: 'pendiente', motivo: MOTIVO, resumen: 'Juan: Malísimo' },
  );
  assert.deepEqual(m.auditoria_moderacion_resenas.map((a) => [a.accion, a.actor, a.solicitud_id]), [['solicitada', 'u-c1', s.id]]);
  assert.equal(m.resenas[0].eliminada_at, null, 'pedir no borra nada');
});

test('un comercio no puede tocar reseñas ajenas', async () => {
  const m = mundo();
  const r = await solicitar(m, 'tok-c1', R2);
  assert.equal(r.status, 403);
  assert.equal(m.solicitudes_eliminacion_resena.length, 0);
  assert.equal((await solicitar(m, 'tok-c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9')).status, 404, 'reseña inexistente');
});

test('no se aceptan pedidos pendientes duplicados para la misma reseña', async () => {
  const m = mundo();
  assert.equal((await solicitar(m, 'tok-c1')).status, 200);
  assert.equal((await solicitar(m, 'tok-c1')).status, 409);
  // Aunque lleguen a la vez (lo frena el índice único de la base)
  const m2 = mundo();
  const [a, b] = await Promise.all([solicitar(m2, 'tok-c1'), solicitar(m2, 'tok-c1')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(m2.solicitudes_eliminacion_resena.length, 1);
});

test('motivo vacío, corto o demasiado largo → 400', async () => {
  const m = mundo();
  assert.equal((await solicitar(m, 'tok-c1', R1, '')).status, 400);
  assert.equal((await solicitar(m, 'tok-c1', R1, 'feo')).status, 400);
  assert.equal((await solicitar(m, 'tok-c1', R1, 'x'.repeat(501))).status, 400);
  assert.equal((await llamar(m, { accion: 'solicitar', resena_id: 'no-es-un-id', motivo: MOTIVO }, 'tok-c1')).status, 400);
  assert.equal(m.solicitudes_eliminacion_resena.length, 0);
});

test('límite de pedidos por comercio en 24 h → 429', async () => {
  const m = mundo();
  for (let i = 0; i < 5; i++) {
    const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`;
    m.resenas.push({ id, comercio_id: C1, nombre_usuario: 'X', comentario: 'Y', eliminada_at: null });
    assert.equal((await solicitar(m, 'tok-c1', id)).status, 200);
  }
  const r = await solicitar(m, 'tok-c1');
  assert.equal(r.status, 429);
  assert.match(r.json.error, /5 pedidos por día/);
  // Los pedidos de ayer no cuentan
  m.solicitudes_eliminacion_resena.forEach((s) => (s.created_at = '2026-10-25T14:00:00.000Z'));
  assert.equal((await solicitar(m, 'tok-c1')).status, 200);
});

test('un comercio no puede aprobar ni rechazar (tampoco su propia solicitud)', async () => {
  const m = mundo();
  await solicitar(m, 'tok-c1');
  const id = m.solicitudes_eliminacion_resena[0].id;
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: true }, 'tok-c1')).status, 403);
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: false }, 'tok-c2')).status, 403);
  assert.equal(m.solicitudes_eliminacion_resena[0].estado, 'pendiente');
  assert.equal(m.resenas[0].eliminada_at, null);
});

test('el admin aprueba: la reseña queda eliminada (lógica), con quién y cuándo, y auditoría', async () => {
  const m = mundo();
  await solicitar(m, 'tok-c1');
  const id = m.solicitudes_eliminacion_resena[0].id;
  const r = await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: true, nota: '  Confirmado con el comercio  ' }, 'tok-admin');
  assert.equal(r.status, 200);
  const s = m.solicitudes_eliminacion_resena[0];
  assert.deepEqual([s.estado, s.resuelta_por, s.resuelta_at, s.nota_admin], ['aprobada', 'u-admin', AHORA.toISOString(), 'Confirmado con el comercio']);
  assert.deepEqual([m.resenas[0].eliminada_at, m.resenas[0].eliminada_por], [AHORA.toISOString(), 'u-admin']);
  assert.equal(m.resenas.length, 2, 'no se borra la fila');
  assert.deepEqual(m.auditoria_moderacion_resenas.map((a) => [a.accion, a.actor]), [['solicitada', 'u-c1'], ['aprobada', 'u-admin']]);
  // Ya resuelta: no se vuelve a resolver
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: false }, 'tok-admin')).status, 409);
  // Y ya no se puede pedir de nuevo sobre una reseña eliminada
  assert.equal((await solicitar(m, 'tok-c1')).status, 404);
});

test('el admin rechaza: la reseña sigue visible y se puede volver a pedir', async () => {
  const m = mundo();
  await solicitar(m, 'tok-c1');
  const id = m.solicitudes_eliminacion_resena[0].id;
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: false }, 'tok-admin')).status, 200);
  assert.equal(m.solicitudes_eliminacion_resena[0].estado, 'rechazada');
  assert.equal(m.resenas[0].eliminada_at, null);
  assert.equal((await solicitar(m, 'tok-c1')).status, 200);
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', aprobar: true }, 'tok-admin')).status, 404);
  assert.equal((await llamar(m, { accion: 'resolver', solicitud_id: id, aprobar: 'si', nota: 'x' }, 'tok-admin')).status, 400);
});
