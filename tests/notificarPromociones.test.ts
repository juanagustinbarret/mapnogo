import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITES_POR_DEFECTO,
  armarMensaje,
  clasificarRespuesta,
  decidir,
  enParalelo,
  limitesDesdeEntorno,
  type Promocion,
} from '../supabase/functions/notificar-promociones/logica.ts';
import { manejar, type Entorno } from '../supabase/functions/notificar-promociones/index.ts';
import { base64urlABytes, bytesABase64url, generarClavesVapid } from '../supabase/functions/_shared/webpush.ts';

// 21/10/2026 15:00 en Argentina
const AHORA = new Date('2026-10-21T18:00:00Z');
const promo = (extra: Partial<Promocion> = {}): Promocion => ({
  id: 'p1', comercio_id: 'c1', titulo: '2x1 en muzzarella', descripcion: 'Solo hoy', tipo: 'promocion',
  precio_anterior: 12000, precio_promocional: 9000, fecha_inicio: '2026-10-21', fecha_fin: '2026-10-31',
  aprobada: true, created_at: '2026-10-21T17:55:00Z', notificada_at: null, ...extra,
});
const ctx = (extra = {}) => ({ ahora: AHORA, comercioPublico: true, enviadasHoyComercio: 0, enviadasHoyTotal: 0, ...extra });

test('regla: se avisa una vez, vigente hoy, comercio público y dentro de los límites', () => {
  assert.deepEqual(decidir(promo(), ctx()), { accion: 'enviar' });
  assert.deepEqual(decidir(promo({ notificada_at: '2026-10-21T17:56:00Z' }), ctx()), { accion: 'omitir', motivo: 'ya_notificada' });
  assert.deepEqual(decidir(promo({ aprobada: false }), ctx()), { accion: 'omitir', motivo: 'no_aprobada' });
  assert.deepEqual(decidir(promo({ fecha_inicio: '2026-10-25' }), ctx()), { accion: 'esperar', motivo: 'empieza_despues' });
  assert.deepEqual(decidir(promo({ fecha_fin: '2026-10-20' }), ctx()), { accion: 'omitir', motivo: 'vencida' });
  assert.deepEqual(decidir(promo(), ctx({ comercioPublico: false })), { accion: 'esperar', motivo: 'comercio_no_publico' });
  assert.deepEqual(decidir(promo({ fecha_inicio: '2026-10-15', created_at: '2026-10-15T12:00:00Z' }), ctx()), { accion: 'omitir', motivo: 'vieja' });
  assert.deepEqual(decidir(promo(), ctx({ enviadasHoyComercio: 1 })), { accion: 'omitir', motivo: 'limite_comercio' });
  assert.deepEqual(decidir(promo(), ctx({ enviadasHoyTotal: 10 })), { accion: 'omitir', motivo: 'limite_total' });
  // A las 22:30 de Argentina ya es "mañana" en UTC: la de hoy sigue vigente
  assert.deepEqual(decidir(promo({ fecha_fin: '2026-10-21' }), ctx({ ahora: new Date('2026-10-22T01:30:00Z') })), { accion: 'enviar' });
  // fecha_inicio guardada como timestamp (medianoche UTC = 21 h del día anterior en AR)
  assert.deepEqual(decidir(promo({ fecha_inicio: '2026-10-21T00:00:00+00:00' }), ctx()), { accion: 'enviar' });
});

test('límites configurables por variables de entorno', () => {
  assert.deepEqual(limitesDesdeEntorno(() => undefined), LIMITES_POR_DEFECTO);
  const env: Record<string, string> = { LIMITE_DIARIO_POR_COMERCIO: '2', LIMITE_DIARIO_TOTAL: 'x', ANTIGUEDAD_MAXIMA_HORAS: '24' };
  assert.deepEqual(limitesDesdeEntorno((n) => env[n]), { porComercioPorDia: 2, totalPorDia: 10, antiguedadMaximaHoras: 24 });
});

test('mensaje: título, cuerpo con precios, url de la ficha y etiqueta; textos largos recortados', () => {
  const m = armarMensaje(promo(), { id: 'c1', nombre: 'Bien Criollo', slug: 'bien-criollo-pizzas' });
  assert.equal(m.title, 'Nueva oferta en Bien Criollo');
  assert.equal(m.body, '2x1 en muzzarella · $ 9.000 (antes $ 12.000)');
  assert.equal(m.url, '/comercio/bien-criollo-pizzas#promociones');
  assert.equal(m.tag, 'promo-p1');
  const larga = armarMensaje(promo({ tipo: 'novedad', titulo: 'x'.repeat(400), precio_promocional: null }), { id: 'c1', nombre: 'N'.repeat(200), slug: 's' });
  assert.ok(larga.title.startsWith('Novedad en ') && larga.title.length <= 80 && larga.title.endsWith('…'));
  assert.ok(larga.body.length <= 160);
  assert.ok(new TextEncoder().encode(JSON.stringify(larga)).length < 1000, 'muy por debajo del límite de ~4 KB de los servicios push');
});

test('respuestas del servicio push', () => {
  assert.equal(clasificarRespuesta(201), 'ok');
  assert.equal(clasificarRespuesta(410), 'vencida');
  assert.equal(clasificarRespuesta(404), 'vencida');
  assert.equal(clasificarRespuesta(403), 'claves');
  assert.equal(clasificarRespuesta(413), 'demasiado_grande');
  assert.equal(clasificarRespuesta(429), 'reintentar');
  assert.equal(clasificarRespuesta(503), 'reintentar');
  assert.equal(clasificarRespuesta(400), 'error');
});

test('envíos en paralelo con tope y esperando todos', async () => {
  let activos = 0;
  let maximo = 0;
  const r = await enParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    activos++;
    maximo = Math.max(maximo, activos);
    await new Promise((ok) => setTimeout(ok, 5));
    activos--;
    return n * 2;
  });
  assert.deepEqual(r, [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(maximo, 3);
});

// ─── La función completa contra una base y servicios push simulados ───────

// Dispositivo cuyo mensaje podemos descifrar (claves del ejemplo de la RFC 8291)
const UA = {
  privada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  publica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
};
const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
async function descifrar(cuerpo: Uint8Array) {
  const te = new TextEncoder();
  const hk = async (s: Uint8Array, i: Uint8Array, info: Uint8Array, n: number) => {
    const k = await crypto.subtle.importKey('raw', buf(i), 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(s), info: buf(info) }, k, n * 8));
  };
  const sal = cuerpo.slice(0, 16);
  const asPub = cuerpo.slice(21, 86);
  const pub = base64urlABytes(UA.publica);
  const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: UA.privada, x: bytesABase64url(pub.slice(1, 33)), y: bytesABase64url(pub.slice(33)) }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: await crypto.subtle.importKey('raw', buf(asPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, priv, 256));
  const ikm = await hk(base64urlABytes(UA.auth), ecdh, new Uint8Array([...te.encode('WebPush: info\0'), ...pub, ...asPub]), 32);
  const cek = await hk(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(nonce) }, await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['decrypt']), buf(cuerpo.slice(86))));
  return JSON.parse(new TextDecoder().decode(plano.slice(0, -1)));
}

interface Mundo {
  promociones: any[];
  comercios: any[];
  push_subscriptions: any[];
  notificaciones_envios: any[];
  profiles: any[];
  publicos: Set<string>;
  enviosPush: { endpoint: string; headers: Record<string, string>; body: Uint8Array }[];
  respuestaPush: (endpoint: string) => number;
  usuarios: Record<string, string>; // token → id
  logs: Record<string, unknown>[];
}

function mundo(): Mundo {
  return {
    promociones: [promo(), promo({ id: 'p2', comercio_id: 'c2', titulo: 'Novedad: llegó la cerveza', tipo: 'novedad', precio_promocional: null, precio_anterior: null })],
    comercios: [
      { id: 'c1', nombre: 'Bien Criollo', slug: 'bien-criollo-pizzas', propietario_id: 'u-c1' },
      { id: 'c2', nombre: 'Almacén Don Tito', slug: 'almacen-don-tito', propietario_id: 'u-c2' },
    ],
    push_subscriptions: [
      { endpoint: 'https://fcm.googleapis.com/fcm/send/vecino-1', p256dh: UA.publica, auth: UA.auth },
      { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/vecino-2', p256dh: UA.publica, auth: UA.auth },
      { endpoint: 'https://web.push.apple.com/vecino-vencido', p256dh: UA.publica, auth: UA.auth },
      { endpoint: 'https://fcm.googleapis.com/fcm/send/admin-celu', p256dh: UA.publica, auth: UA.auth },
    ],
    notificaciones_envios: [],
    profiles: [{ id: 'u-admin', rol: 'admin' }, { id: 'u-c1', rol: 'comerciante' }, { id: 'u-c2', rol: 'comerciante' }],
    publicos: new Set(['c1', 'c2']),
    enviosPush: [],
    respuestaPush: (e) => (e.includes('vencido') ? 410 : 201),
    usuarios: { 'tok-admin': 'u-admin', 'tok-c1': 'u-c1' },
    logs: [],
  };
}

// PostgREST mínimo: select, eq., is.null, in.(), gte., order, limit, offset
function filtrar(filas: any[], q: URLSearchParams) {
  return filas.filter((f) =>
    [...q.entries()].every(([k, v]) => {
      if (['select', 'order', 'limit', 'offset'].includes(k)) return true;
      if (v === 'is.null') return f[k] === null || f[k] === undefined;
      if (v.startsWith('eq.')) return String(f[k]) === v.slice(3);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(f[k]));
      if (v.startsWith('gte.')) return String(f[k]) >= v.slice(4);
      throw new Error(`filtro no soportado ${k}=${v}`);
    }),
  );
}

function entorno(m: Mundo, env: Record<string, string>): Entorno {
  const fetchFalso = async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(String(entrada));
    const metodo = init.method ?? 'GET';
    if (u.host === 'base.supabase.co') {
      if (u.pathname === '/auth/v1/user') {
        const tok = String((init.headers as Record<string, string>).Authorization).replace('Bearer ', '');
        return m.usuarios[tok] ? new Response(JSON.stringify({ id: m.usuarios[tok] })) : new Response('{}', { status: 401 });
      }
      const tabla = u.pathname.replace('/rest/v1/', '');
      if (tabla === 'rpc/es_comercio_publico') return new Response(JSON.stringify(m.publicos.has(JSON.parse(String(init.body)).comercio_uuid)));
      const filas = (m as any)[tabla] as any[];
      assert.ok(filas, `tabla inesperada ${tabla}`);
      const q = u.searchParams;
      if (metodo === 'GET') {
        let r = filtrar(filas, q);
        const off = Number(q.get('offset') ?? 0);
        r = r.slice(off, off + Number(q.get('limit') ?? 1e9));
        return new Response(JSON.stringify(r));
      }
      if (metodo === 'PATCH') {
        const r = filtrar(filas, q);
        r.forEach((f) => Object.assign(f, JSON.parse(String(init.body))));
        return new Response(JSON.stringify(r));
      }
      if (metodo === 'DELETE') {
        const r = filtrar(filas, q);
        (m as any)[tabla] = filas.filter((f) => !r.includes(f));
        return new Response(null, { status: 204 });
      }
      if (metodo === 'POST') {
        filas.push({ ...JSON.parse(String(init.body)), created_at: AHORA.toISOString() });
        return new Response('', { status: 201 });
      }
    }
    if (m.push_subscriptions.some((s) => s.endpoint === u.href) || u.href.includes('vencido')) {
      m.enviosPush.push({ endpoint: u.href, headers: init.headers as Record<string, string>, body: init.body as Uint8Array });
      return new Response('', { status: m.respuestaPush(u.href) });
    }
    throw new Error(`Pedido a la red real bloqueado en la prueba: ${u.href}`);
  };
  return { leer: (n) => env[n], fetch: fetchFalso as typeof fetch, ahora: () => AHORA, log: (e) => m.logs.push(e) };
}

async function claves() {
  const c = await generarClavesVapid();
  return { SUPABASE_URL: 'https://base.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio', VAPID_PUBLIC_KEY: c.publica, VAPID_PRIVATE_KEY: c.privada, VAPID_SUBJECT: 'mailto:admin@nogoyork.com.ar', CRON_SECRET: 'cron-123' };
}
const pedido = (cuerpo: object, headers: Record<string, string>) => new Request('https://base.supabase.co/functions/v1/notificar-promociones', { method: 'POST', body: JSON.stringify(cuerpo), headers });

test('cron: avisa a todos los suscriptos, limpia los vencidos, marca la publicación y deja registro', async () => {
  const m = mundo();
  const env = await claves();
  const r = await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, env));
  const json = await r.json();
  assert.equal(r.status, 200);
  assert.equal(json.procesadas.length, 2);
  assert.equal(m.enviosPush.length, 8, '2 publicaciones × 4 dispositivos');
  // El vencido (410) se borró después del primer envío; el segundo ya no lo intenta
  assert.equal(m.push_subscriptions.some((s) => s.endpoint.includes('vencido')), false);
  const p1 = json.procesadas.find((x: any) => x.id === 'p1');
  assert.deepEqual([p1.destinatarios, p1.enviadas, p1.fallidas, p1.borradas], [4, 3, 1, 1]);
  assert.ok(m.promociones.every((p) => p.notificada_at && p.notificacion_estado === 'enviada'));
  assert.equal(m.notificaciones_envios.filter((f) => f.estado === 'enviada').length, 2);
  // El navegador recibe lo que el service worker espera
  const primero = m.enviosPush.find((e) => e.endpoint.endsWith('vecino-1'))!;
  assert.deepEqual(await descifrar(primero.body), { title: 'Nueva oferta en Bien Criollo', body: '2x1 en muzzarella · $ 9.000 (antes $ 12.000)', url: '/comercio/bien-criollo-pizzas#promociones', tag: 'promo-p1' });
  assert.match(primero.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(primero.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(m.logs.some((l) => l.evento === 'promo_notificada' && l.enviadas === 3), 'log con destinatarios y resultado');
});

test('no duplica: correr de nuevo (o dos veces a la vez) no vuelve a mandar', async () => {
  const m = mundo();
  const env = await claves();
  await Promise.all([manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, env)), manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, env))]);
  const tras = m.enviosPush.length;
  await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, env));
  assert.equal(m.enviosPush.length, tras);
  assert.equal(m.notificaciones_envios.filter((f) => f.estado === 'enviada').length, 2, 'cada publicación una sola vez');
});

test('límite diario: la segunda publicación del mismo comercio se publica pero no se avisa', async () => {
  const m = mundo();
  m.promociones = [promo(), promo({ id: 'p3', titulo: 'Otra más', created_at: '2026-10-21T17:58:00Z' })];
  const r = await (await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, await claves()))).json();
  assert.deepEqual(r.procesadas.map((x: any) => [x.id, x.accion, x.motivo ?? x.estado]), [['p1', 'enviar', 'enviada'], ['p3', 'omitir', 'limite_comercio']]);
  assert.equal(m.promociones.find((p) => p.id === 'p3').notificacion_estado, 'omitida_limite_comercio');
});

test('las que empiezan otro día esperan (no se marcan) y los comercios no públicos también', async () => {
  const m = mundo();
  m.promociones = [promo({ fecha_inicio: '2026-10-25' }), promo({ id: 'p2', comercio_id: 'c2' })];
  m.publicos.delete('c2');
  const r = await (await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, await claves()))).json();
  assert.deepEqual(r.procesadas.map((x: any) => x.motivo), ['empieza_despues', 'comercio_no_publico']);
  assert.equal(m.enviosPush.length, 0);
  assert.ok(m.promociones.every((p) => !p.notificada_at));
});

test('un comercio solo dispara el aviso de SUS publicaciones', async () => {
  const m = mundo();
  const r = await (await manejar(pedido({}, { Authorization: 'Bearer tok-c1' }), entorno(m, await claves()))).json();
  assert.deepEqual(r.procesadas.map((x: any) => x.id), ['p1']);
  assert.equal(m.promociones.find((p) => p.id === 'p2').notificada_at, null);
});

test('modo prueba: solo le llega al dispositivo del admin; nadie más puede usarlo', async () => {
  const m = mundo();
  const env = await claves();
  const r = await manejar(pedido({ modo: 'prueba', endpoint: 'https://fcm.googleapis.com/fcm/send/admin-celu' }, { Authorization: 'Bearer tok-admin' }), entorno(m, env));
  const json = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(m.enviosPush.map((e) => e.endpoint), ['https://fcm.googleapis.com/fcm/send/admin-celu']);
  assert.equal((await descifrar(m.enviosPush[0].body)).title, 'NOGOYORK: notificación de prueba');
  assert.equal(json.enviadas, 1);
  assert.ok(m.promociones.every((p) => !p.notificada_at), 'la prueba no toca las publicaciones');
  assert.equal((await manejar(pedido({ modo: 'prueba', endpoint: 'https://fcm.googleapis.com/fcm/send/admin-celu' }, { Authorization: 'Bearer tok-c1' }), entorno(m, env))).status, 403);
  assert.equal((await manejar(pedido({ modo: 'prueba', endpoint: 'https://fcm.googleapis.com/fcm/send/otro' }, { Authorization: 'Bearer tok-admin' }), entorno(m, env))).status, 404);
});

test('simulación: dice a cuántos se mandaría sin mandar ni marcar nada', async () => {
  const m = mundo();
  const r = await (await manejar(pedido({ modo: 'simulacion' }, { Authorization: 'Bearer tok-admin' }), entorno(m, await claves()))).json();
  assert.deepEqual(r.procesadas.map((x: any) => [x.id, x.accion, x.destinatarios]), [['p1', 'enviar', 4], ['p2', 'enviar', 4]]);
  assert.equal(m.enviosPush.length, 0);
  assert.ok(m.promociones.every((p) => !p.notificada_at));
});

test('sin sesión, sin claves VAPID o con claves que no coinciden: errores claros y registrados', async () => {
  const m = mundo();
  const env = await claves();
  assert.equal((await manejar(pedido({}, {}), entorno(m, env))).status, 401);
  assert.equal((await manejar(pedido({}, { 'x-cron-secret': 'otro' }), entorno(m, env))).status, 401);
  const sinClaves = await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, { ...env, VAPID_PRIVATE_KEY: '' }));
  assert.equal(sinClaves.status, 500);
  assert.match((await sinClaves.json()).error, /VAPID/);
  m.respuestaPush = () => 403;
  await manejar(pedido({}, { 'x-cron-secret': 'cron-123' }), entorno(m, env));
  assert.ok(m.logs.some((l) => l.evento === 'claves_vapid_rechazadas'));
  assert.ok(m.notificaciones_envios.some((f) => f.fallidas === 4 && JSON.stringify(f.detalle).includes('claves')));
});
