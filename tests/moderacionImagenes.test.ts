import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { veredictoGoogle, veredictoOpenAI } from '../supabase/functions/_shared/moderacion.ts';
import { BUCKET, manejar, type Entorno } from '../supabase/functions/imagenes-comercio/index.ts';

// Solo imágenes inofensivas; la respuesta del moderador se simula.
const foto = (n: string) => Buffer.from(readFileSync(new URL(`./fixtures/imagenes/${n}`, import.meta.url))).toString('base64');
const AHORA = new Date('2026-10-21T18:00:00Z');
const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';

const openai = (puntajes: Record<string, number>, flagged = false) => ({ results: [{ flagged, category_scores: { sexual: 0, violence: 0, 'violence/graphic': 0, 'self-harm': 0, ...puntajes } }] });

test('OpenAI: limpia → aprobada; dudosa → pendiente; claramente explícita → rechazada', () => {
  assert.equal(veredictoOpenAI(openai({ sexual: 0.01 })).estado, 'aprobada');
  assert.deepEqual(pick(veredictoOpenAI(openai({ sexual: 0.45 }))), { estado: 'pendiente', motivo: 'sexual' });
  assert.deepEqual(pick(veredictoOpenAI(openai({ 'violence/graphic': 0.7 }))), { estado: 'pendiente', motivo: 'violence/graphic' });
  assert.deepEqual(pick(veredictoOpenAI(openai({ sexual: 0.97 }))), { estado: 'rechazada', motivo: 'sexual' });
  assert.deepEqual(pick(veredictoOpenAI(openai({}, true))), { estado: 'pendiente', motivo: 'marcada' });
  assert.deepEqual(pick(veredictoOpenAI({})), { estado: 'pendiente', motivo: 'respuesta_invalida' });
});

test('Google SafeSearch: niveles → aprobada / pendiente / rechazada', () => {
  const g = (s: Record<string, string>) => ({ responses: [{ safeSearchAnnotation: { adult: 'VERY_UNLIKELY', racy: 'UNLIKELY', violence: 'VERY_UNLIKELY', medical: 'UNLIKELY', ...s } }] });
  assert.equal(veredictoGoogle(g({})).estado, 'aprobada');
  assert.deepEqual(pick(veredictoGoogle(g({ adult: 'POSSIBLE' }))), { estado: 'pendiente', motivo: 'adult' });
  assert.deepEqual(pick(veredictoGoogle(g({ racy: 'VERY_LIKELY' }))), { estado: 'pendiente', motivo: 'racy' });
  assert.deepEqual(pick(veredictoGoogle(g({ adult: 'VERY_LIKELY' }))), { estado: 'rechazada', motivo: 'adult' });
  assert.deepEqual(pick(veredictoGoogle({ responses: [{ error: { message: 'x' } }] })), { estado: 'pendiente', motivo: 'respuesta_invalida' });
});
const pick = (v: { estado: string; motivo: string }) => ({ estado: v.estado, motivo: v.motivo });

// ─── La función completa contra base, almacenamiento y moderador simulados ──

interface Mundo {
  fotos_comercio: any[];
  reportes_contenido: any[];
  comercios: any[];
  profiles: any[];
  archivos: Map<string, Uint8Array>;
  moderador: () => Response | Promise<Response>;
  llamadasModerador: number;
  usuarios: Record<string, string>;
  logs: Record<string, unknown>[];
}
const mundo = (): Mundo => ({
  fotos_comercio: [],
  reportes_contenido: [],
  comercios: [{ id: C1, propietario_id: 'u-c1' }, { id: C2, propietario_id: 'u-c2' }],
  profiles: [{ id: 'u-admin', rol: 'admin' }, { id: 'u-c1', rol: 'comerciante' }, { id: 'u-c2', rol: 'comerciante' }],
  archivos: new Map(),
  moderador: () => new Response(JSON.stringify(openai({ sexual: 0.002 }))),
  llamadasModerador: 0,
  usuarios: { 'tok-admin': 'u-admin', 'tok-c1': 'u-c1', 'tok-c2': 'u-c2' },
  logs: [],
});

function filtrar(filas: any[], q: URLSearchParams) {
  return filas.filter((f) =>
    [...q.entries()].every(([k, v]) => {
      if (['select', 'order', 'limit', 'offset'].includes(k)) return true;
      if (v.startsWith('eq.')) return String(f[k]) === v.slice(3);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(f[k]));
      if (v.startsWith('gte.')) return String(f[k]) >= v.slice(4);
      throw new Error(`filtro no soportado ${k}=${v}`);
    }),
  );
}

let contador = 0;
function entorno(m: Mundo, env: Record<string, string> = {}): Entorno {
  const fetchFalso = async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(String(entrada));
    const metodo = init.method ?? 'GET';
    if (u.host === 'api.openai.com' || u.host === 'vision.googleapis.com') {
      m.llamadasModerador++;
      return m.moderador();
    }
    assert.equal(u.host, 'base.supabase.co', `pedido a la red real bloqueado: ${u.href}`);
    if (u.pathname === '/auth/v1/user') {
      const tok = String((init.headers as Record<string, string>).Authorization).replace('Bearer ', '');
      return m.usuarios[tok] ? new Response(JSON.stringify({ id: m.usuarios[tok] })) : new Response('{}', { status: 401 });
    }
    if (u.pathname.startsWith(`/storage/v1/object/${BUCKET}/`)) {
      const ruta = u.pathname.replace(`/storage/v1/object/${BUCKET}/`, '');
      if (metodo === 'POST') m.archivos.set(ruta, init.body as Uint8Array);
      if (metodo === 'DELETE') m.archivos.delete(ruta);
      return new Response('{}');
    }
    const tabla = u.pathname.replace('/rest/v1/', '');
    const filas = (m as any)[tabla] as any[];
    assert.ok(filas, `tabla inesperada ${tabla}`);
    if (metodo === 'GET') return new Response(JSON.stringify(filtrar(filas, u.searchParams)));
    if (metodo === 'POST') {
      const fila = { created_at: AHORA.toISOString(), ...JSON.parse(String(init.body)) };
      filas.push(fila);
      return new Response(JSON.stringify([fila]), { status: 201 });
    }
    if (metodo === 'PATCH') {
      const r = filtrar(filas, u.searchParams);
      r.forEach((f) => Object.assign(f, JSON.parse(String(init.body))));
      return new Response(null, { status: 204 });
    }
    if (metodo === 'DELETE') {
      const r = filtrar(filas, u.searchParams);
      (m as any)[tabla] = filas.filter((f) => !r.includes(f));
      return new Response(null, { status: 204 });
    }
    throw new Error('método no soportado');
  };
  return {
    leer: (n) => ({ SUPABASE_URL: 'https://base.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio', MODERACION_PROVEEDOR: 'openai', OPENAI_API_KEY: 'sk-prueba', ...env })[n],
    fetch: fetchFalso as typeof fetch,
    ahora: () => AHORA,
    log: (e) => m.logs.push(e),
    nuevoId: () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`,
  };
}
const pedido = (cuerpo: object, token?: string, ip = '181.1.2.3') =>
  new Request('https://base.supabase.co/functions/v1/imagenes-comercio', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
const subir = (m: Mundo, imagen = foto('foto_con_exif.jpg'), token = 'tok-c1', env = {}) => manejar(pedido({ accion: 'subir', comercio_id: C1, imagen }, token), entorno(m, env));

test('foto limpia: se valida, se le sacan los metadatos, se modera y se publica', async () => {
  const m = mundo();
  const r = await subir(m);
  const json = await r.json();
  assert.equal(r.status, 201);
  assert.equal(json.foto.estado, 'aprobada');
  assert.match(json.foto.url, new RegExp(`^https://base\\.supabase\\.co/storage/v1/object/public/${BUCKET}/${C1}/.+\\.jpg$`));
  const guardado = Buffer.from([...m.archivos.values()][0]);
  assert.ok(!guardado.includes('CamaraDePrueba') && !guardado.includes('comentario secreto'), 'sin EXIF ni comentarios');
  assert.equal(m.llamadasModerador, 1);
  assert.deepEqual([json.foto.ancho, json.foto.alto], [320, 200]);
});

test('foto dudosa: se guarda pero queda pendiente de revisión (no se ve)', async () => {
  const m = mundo();
  m.moderador = () => new Response(JSON.stringify(openai({ sexual: 0.5 })));
  const r = await subir(m);
  const json = await r.json();
  assert.equal(r.status, 201);
  assert.equal(json.foto.estado, 'pendiente');
  assert.match(json.mensaje, /revisión/);
  assert.equal(m.archivos.size, 1);
});

test('foto claramente explícita: se rechaza con un mensaje claro y no se guarda', async () => {
  const m = mundo();
  m.moderador = () => new Response(JSON.stringify(openai({ sexual: 0.99 })));
  const r = await subir(m);
  assert.equal(r.status, 422);
  assert.match((await r.json()).error, /contenido explícito/);
  assert.equal(m.archivos.size, 0);
  assert.equal(m.fotos_comercio[0].estado, 'rechazada');
});

test('tipo falso, archivo enorme o medidas fuera de rango: se rechaza antes de moderar', async () => {
  for (const [archivo, codigo] of [['falsa.jpg', 'tipo_no_permitido'], ['dibujo.svg', 'tipo_no_permitido'], ['animada.gif', 'tipo_no_permitido'], ['muy_ancha.png', 'muy_grande'], ['muy_chica.jpg', 'muy_chica']]) {
    const m = mundo();
    const r = await subir(m, foto(archivo));
    assert.equal(r.status, 422, archivo);
    assert.equal((await r.json()).codigo, codigo, archivo);
    assert.equal(m.llamadasModerador, 0);
    assert.equal(m.archivos.size, 0);
  }
  const m = mundo();
  const r = await subir(m, 'A'.repeat(5_000_000));
  assert.equal(r.status, 413);
});

test('sin moderación automática configurada, o si el moderador falla: queda pendiente (nunca se publica sin revisar)', async () => {
  const m = mundo();
  const sin = await (await subir(m, foto('simple.webp'), 'tok-c1', { MODERACION_PROVEEDOR: '' })).json();
  assert.deepEqual([sin.foto.estado, sin.foto.moderacion.motivo], ['pendiente', 'sin_moderacion_automatica']);
  m.moderador = () => new Response('caído', { status: 503 });
  const caido = await (await subir(m, foto('simple.webp'))).json();
  assert.deepEqual([caido.foto.estado, caido.foto.moderacion.motivo], ['pendiente', 'error_http_503']);
  m.moderador = () => {
    throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
  };
  const lento = await (await subir(m, foto('simple.webp'))).json();
  assert.deepEqual([lento.foto.estado, lento.foto.moderacion.motivo], ['pendiente', 'error_TimeoutError']);
});

test('permisos y límites: sin sesión, comercio ajeno, máximo de fotos, subidas por hora', async () => {
  const m = mundo();
  assert.equal((await manejar(pedido({ accion: 'subir', comercio_id: C1, imagen: foto('simple.webp') }), entorno(m))).status, 401);
  assert.equal((await subir(m, foto('simple.webp'), 'tok-c2')).status, 403);
  for (let i = 0; i < 6; i++) assert.equal((await subir(m, foto('simple.webp'))).status, 201);
  const sept = await subir(m, foto('simple.webp'));
  assert.equal(sept.status, 409);
  const m2 = mundo();
  for (let i = 0; i < 3; i++) await subir(m2, foto('simple.webp'), 'tok-c1', { LIMITE_SUBIDAS_POR_HORA: '3', MAX_FOTOS_POR_COMERCIO: '50' });
  const r = await subir(m2, foto('simple.webp'), 'tok-c1', { LIMITE_SUBIDAS_POR_HORA: '3', MAX_FOTOS_POR_COMERCIO: '50' });
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /3 fotos por hora/);
  assert.equal((await subir(m2, foto('simple.webp'), 'tok-admin', { LIMITE_SUBIDAS_POR_HORA: '3', MAX_FOTOS_POR_COMERCIO: '50' })).status, 201, 'el admin puede subir al comercio');
});

test('cola de revisión: el admin aprueba o rechaza (rechazar borra el archivo y cierra los reportes)', async () => {
  const m = mundo();
  m.moderador = () => new Response(JSON.stringify(openai({ sexual: 0.5 })));
  const { foto: f } = await (await subir(m)).json();
  await manejar(pedido({ accion: 'reportar', comercio_id: C1, foto_id: f.id, motivo: 'sexual' }), entorno(m));
  assert.equal((await manejar(pedido({ accion: 'revisar', foto_id: f.id, estado: 'aprobada' }, 'tok-c1'), entorno(m))).status, 403);
  assert.equal((await manejar(pedido({ accion: 'revisar', foto_id: f.id, estado: 'rechazada', motivo: 'no corresponde' }, 'tok-admin'), entorno(m))).status, 200);
  assert.deepEqual([m.fotos_comercio[0].estado, m.fotos_comercio[0].url, m.archivos.size], ['rechazada', null, 0]);
  assert.equal(m.reportes_contenido[0].estado, 'resuelto');
});

test('reportar: cualquiera puede, sin repetir la misma foto y con tope por hora por conexión', async () => {
  const m = mundo();
  const rep = (extra: object, ip?: string) => manejar(pedido({ accion: 'reportar', comercio_id: C1, motivo: 'sexual', ...extra }, undefined, ip), entorno(m));
  assert.equal((await rep({ indice_galeria: 0 })).status, 200);
  assert.match((await (await rep({ indice_galeria: 0 })).json()).mensaje, /Ya habías/);
  assert.equal(m.reportes_contenido.length, 1, 'la misma conexión no duplica');
  assert.ok(m.reportes_contenido[0].ip_hash && !JSON.stringify(m.reportes_contenido).includes('181.1.2.3'), 'se guarda la huella, no la IP');
  for (let i = 1; i < 5; i++) assert.equal((await rep({ indice_galeria: i })).status, 200);
  assert.equal((await rep({ indice_galeria: 9 })).status, 429);
  assert.equal((await rep({ indice_galeria: 9 }, '200.5.5.5')).status, 200, 'otra conexión sí puede');
  assert.equal((await rep({ indice_galeria: 1, motivo: 'no-me-gusta' }, '200.5.5.6')).status, 400);
  assert.equal((await rep({}, '200.5.5.7')).status, 400);
});

test('reportar: sin IP también hay tope, y cambiar de IP no llena de reportes a un comercio', async () => {
  const m = mundo();
  const rep = (extra: object, ip?: string) => manejar(pedido({ accion: 'reportar', comercio_id: C1, motivo: 'sexual', ...extra }, undefined, ip), entorno(m));
  for (let i = 0; i < 5; i++) assert.equal((await rep({ indice_galeria: i }, '')).status, 200);
  assert.equal((await rep({ indice_galeria: 5 }, '')).status, 429, 'los pedidos sin IP comparten el tope');
  for (let i = 5; i < 12; i++) assert.equal((await rep({ indice_galeria: i }, `200.9.9.${i}`)).status, 200);
  assert.equal(m.reportes_contenido.length, 10, 'tope de 10 por comercio por hora, venga de la IP que venga');
  assert.match((await (await rep({ indice_galeria: 20 }, '200.9.9.99')).json()).mensaje, /varios reportes/);
  assert.equal((await manejar(pedido({ accion: 'reportar', comercio_id: C2, indice_galeria: 0, motivo: 'sexual' }, undefined, '200.9.9.100'), entorno(m))).status, 200, 'otro comercio no se ve afectado');
});

test('reportar: la foto tiene que ser de ese comercio', async () => {
  const m = mundo();
  const { foto: f } = await (await subir(m)).json();
  const rep = (comercio: string, foto: string) => manejar(pedido({ accion: 'reportar', comercio_id: comercio, foto_id: foto, motivo: 'sexual' }), entorno(m));
  assert.equal((await rep(C2, f.id)).status, 404);
  assert.equal((await rep(C1, '00000000-0000-4000-8000-999999999999')).status, 404);
  assert.equal(m.reportes_contenido.length, 0);
  assert.equal((await rep(C1, f.id)).status, 200);
});

test('borrar: el dueño borra su foto (archivo y registro); otro comercio no puede', async () => {
  const m = mundo();
  const { foto: f } = await (await subir(m)).json();
  assert.equal((await manejar(pedido({ accion: 'borrar', foto_id: f.id }, 'tok-c2'), entorno(m))).status, 404);
  assert.equal((await manejar(pedido({ accion: 'borrar', foto_id: f.id }, 'tok-c1'), entorno(m))).status, 200);
  assert.deepEqual([m.archivos.size, m.fotos_comercio.length], [0, 0]);
});
