import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoGoogle,
  etiquetaPuntaje,
  fechaResena,
  formatearPuntaje,
  interpretarFichaPegada,
  textoEstrellas,
  textoParaCrearFicha,
  textoPuntaje,
  urlSegura,
} from '../src/lib/resenasGoogle.ts';
import { Limitador, adaptarLugar, responderGoogle } from '../src/lib/googleServidor.ts';

// ─── Formato del puntaje ─────────────────────────────────────────────────
test('puntaje con coma decimal y redondeo a un decimal', () => {
  assert.equal(formatearPuntaje(4.56), '4,6');
  assert.equal(formatearPuntaje(4.54), '4,5');
  assert.equal(formatearPuntaje(5), '5,0');
  assert.equal(formatearPuntaje(4.95), '5,0');
  assert.equal(formatearPuntaje(0), null);
  assert.equal(formatearPuntaje(null), null);
  assert.equal(formatearPuntaje(Number.NaN), null);
  assert.equal(textoPuntaje(4.56, 1234), '4,6 (1.234)');
  assert.equal(textoPuntaje(4.56, 0), null); // sin reseñas: no se muestran estrellas vacías
  assert.equal(textoEstrellas(4.6), '★★★★★');
  assert.equal(textoEstrellas(4.4), '★★★★☆');
  assert.equal(etiquetaPuntaje(4.56, 123), '4,6 de 5 estrellas, 123 reseñas');
  assert.equal(etiquetaPuntaje(5, 1), '5,0 de 5 estrellas, 1 reseña');
  assert.equal(etiquetaPuntaje(null, 0), 'Sin reseñas todavía');
});

test('fecha de reseña en formato argentino (hora de Argentina)', () => {
  assert.equal(fechaResena('2026-10-21T01:30:00Z'), '20/10/2026');
  assert.equal(fechaResena(null), '');
});

test('estado de vinculación', () => {
  assert.equal(estadoGoogle({ google_place_id: 'ChIJxxxxxxxxxx' }), 'vinculado');
  assert.equal(estadoGoogle({ google_estado: 'sin_ficha' }), 'sin_ficha');
  assert.equal(estadoGoogle({}), 'no_vinculado');
});

test('links: solo https de Google', () => {
  assert.equal(urlSegura('https://www.google.com/maps/contrib/123'), 'https://www.google.com/maps/contrib/123');
  assert.equal(urlSegura('https://lh3.googleusercontent.com/a/x=s128'), 'https://lh3.googleusercontent.com/a/x=s128');
  assert.equal(urlSegura('javascript:alert(1)'), null);
  assert.equal(urlSegura('https://evil.com/?google.com'), null);
  assert.equal(urlSegura('https://google.com.evil.com/'), null);
  assert.equal(urlSegura('http://www.google.com/maps'), null);
});

test('ficha pegada a mano: place_id, links con place_id y links por nombre', () => {
  assert.deepEqual(interpretarFichaPegada('ChIJN1t_tDeuEmsRUsoyG83frY4'), { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });
  assert.deepEqual(
    interpretarFichaPegada('https://www.google.com/maps/search/?api=1&query=Bien%20Criollo&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'),
    { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' },
  );
  assert.deepEqual(interpretarFichaPegada('https://www.google.com/maps/place/Bien+Criollo+Pizzas/@-32.39,-59.78,17z'), { busqueda: 'Bien Criollo Pizzas' });
  assert.ok('error' in interpretarFichaPegada('https://maps.app.goo.gl/AbCdEf'));
  assert.deepEqual(interpretarFichaPegada('Bien Criollo Pizzas Nogoyá'), { busqueda: 'Bien Criollo Pizzas Nogoyá' });
  assert.ok('error' in interpretarFichaPegada('   '));
});

test('datos para crear la ficha en Google', () => {
  const t = textoParaCrearFicha({ nombre: 'Almacén Tito', direccion: 'San Martín 123', telefono: '343 5451818', rubro: 'Almacén', horarios: 'Lun a Vie 8 a 20' });
  assert.match(t, /Dirección: San Martín 123, Nogoyá, Entre Ríos, Argentina/);
  assert.match(t, /Horarios:\nLun a Vie 8 a 20/);
  assert.doesNotMatch(textoParaCrearFicha({ nombre: 'X', direccion: 'Y' }), /Teléfono/);
});

// ─── Servidor (Google y Supabase simulados) ──────────────────────────────
const LUGAR = {
  rating: 4.56,
  userRatingCount: 123,
  googleMapsUri: 'https://maps.google.com/?cid=1',
  googleMapsLinks: { writeAReviewUri: 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x0:0x1!12e1', reviewsUri: 'https://www.google.com/maps/place//data=!4m4!3m3!1s0x0:0x1!9m1!1b1' },
  reviews: Array.from({ length: 7 }, (_, i) => ({
    rating: 5 - (i % 3),
    text: { text: i === 0 ? '<img src=x onerror=alert(1)> Excelente' : `Reseña ${i}`, languageCode: 'es' },
    originalText: { text: 'Great', languageCode: i === 1 ? 'en' : 'es' },
    authorAttribution: { displayName: `Autor ${i}`, uri: i === 2 ? 'javascript:alert(1)' : 'https://www.google.com/maps/contrib/1', photoUri: 'https://lh3.googleusercontent.com/a/x' },
    publishTime: '2026-10-21T01:30:00Z',
    relativePublishTimeDescription: 'hace una semana',
    googleMapsUri: 'https://www.google.com/maps/reviews/data=1',
  })),
};

function simulador(opciones: { placeId?: string | null; google?: number; perfil?: string; supabase?: number } = {}) {
  const llamadas: string[] = [];
  const fetchFalso = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    llamadas.push(url);
    const h = new Headers(init?.headers);
    if (url.includes('/rest/v1/comercios')) {
      if (opciones.supabase) return new Response('{}', { status: opciones.supabase });
      return Response.json(opciones.placeId === undefined ? [{ google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }] : opciones.placeId === null ? [] : [{ google_place_id: opciones.placeId }]);
    }
    if (url.includes('/auth/v1/user')) {
      return h.get('Authorization') === 'Bearer token-bueno' ? Response.json({ id: '00000000-0000-0000-0000-0000000000d1' }) : new Response('{}', { status: 401 });
    }
    if (url.includes('/rest/v1/profiles')) return Response.json([{ rol: opciones.perfil ?? 'admin' }]);
    if (url.includes('places.googleapis.com')) {
      assert.ok(h.get('X-Goog-Api-Key'), 'la clave va en el servidor');
      assert.ok(h.get('X-Goog-FieldMask'), 'siempre con field mask');
      if (opciones.google && opciones.google !== 200) return new Response('{}', { status: opciones.google });
      if (url.includes(':searchText')) return Response.json({ places: [{ id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', displayName: { text: 'Bien Criollo Pizzas' }, formattedAddress: 'Hipólito Yrigoyen 448, Nogoyá', googleMapsUri: 'https://maps.google.com/?cid=1' }, { id: 'x' }] });
      return Response.json(LUGAR);
    }
    throw new Error('URL inesperada ' + url);
  }) as typeof fetch;
  return { fetchFalso, llamadas };
}

const ENTORNO = { GOOGLE_PLACES_API_KEY: 'clave-secreta' };
const pedidoResenas = (slug = 'bien-criollo', ip = '1.1.1.1') =>
  new Request(`https://x/api/google?accion=resenas&slug=${slug}`, { headers: { 'x-forwarded-for': ip } });

test('reseñas: puntaje, máximo 5 reseñas, sin caché, links y textos seguros', async () => {
  const { fetchFalso, llamadas } = simulador();
  const r = await responderGoogle(pedidoResenas(), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  const d = await r.json();
  assert.equal(d.estado, 'ok');
  assert.equal(d.puntaje, 4.56);
  assert.equal(d.total, 123);
  assert.equal(d.resenas.length, 5);
  assert.equal(d.resenas[0].texto, '<img src=x onerror=alert(1)> Excelente'); // texto plano: React lo escapa al mostrarlo
  assert.equal(d.resenas[1].traducida, true);
  assert.equal(d.resenas[2].autorUrl, null); // javascript: descartado
  assert.match(d.links.escribir, /^https:\/\/www\.google\.com\/maps\//);
  assert.ok(llamadas.some((u) => u.includes('places/ChIJN1t_tDeuEmsRUsoyG83frY4?languageCode=es')));
  assert.ok(!JSON.stringify(d).includes('clave-secreta'));
});

test('reseñas: comercio sin vincular, sin columna o sin clave no consulta a Google', async () => {
  for (const op of [{ placeId: null }, { supabase: 400 }]) {
    const { fetchFalso, llamadas } = simulador(op);
    const d = await (await responderGoogle(pedidoResenas(), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() })).json();
    assert.equal(d.estado, 'sin_vincular');
    assert.ok(!llamadas.some((u) => u.includes('googleapis')));
  }
  const { fetchFalso } = simulador();
  const sinClave = await responderGoogle(pedidoResenas(), {}, { fetch: fetchFalso, limitador: new Limitador() });
  assert.equal(sinClave.status, 503);
});

test('reseñas: si Google falla responde error controlado (la ficha sigue)', async () => {
  const { fetchFalso } = simulador({ google: 500 });
  const r = await responderGoogle(pedidoResenas(), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).estado, 'error');
  const roto = (async () => {
    throw new Error('sin red');
  }) as unknown as typeof fetch;
  const r2 = await responderGoogle(pedidoResenas(), ENTORNO, { fetch: roto, limitador: new Limitador() });
  assert.equal(r2.status, 502);
});

test('reseñas: slug inválido no consulta nada', async () => {
  const { fetchFalso, llamadas } = simulador();
  const r = await responderGoogle(pedidoResenas("x'; drop"), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() });
  assert.equal(r.status, 400);
  assert.equal(llamadas.length, 0);
});

test('límite: 12 por minuto por IP, otra IP sigue, y tope diario por instancia', async () => {
  let ahora = Date.parse('2026-10-20T15:00:00Z');
  const limitador = new Limitador(() => ahora);
  const { fetchFalso } = simulador();
  const estados: number[] = [];
  for (let i = 0; i < 13; i++) estados.push((await responderGoogle(pedidoResenas(), ENTORNO, { fetch: fetchFalso, limitador })).status);
  assert.deepEqual(estados.slice(0, 12), Array(12).fill(200));
  assert.equal(estados[12], 429);
  assert.equal((await responderGoogle(pedidoResenas('bien-criollo', '2.2.2.2'), ENTORNO, { fetch: fetchFalso, limitador })).status, 200);
  ahora += 61_000;
  assert.equal((await responderGoogle(pedidoResenas(), ENTORNO, { fetch: fetchFalso, limitador })).status, 200);

  const chico = new Limitador(() => ahora);
  const conTope = { ...ENTORNO, GOOGLE_LIMITE_DIARIO: '2' };
  const s = [];
  for (let i = 0; i < 3; i++) s.push((await responderGoogle(pedidoResenas('bien-criollo', `9.9.9.${i}`), conTope, { fetch: fetchFalso, limitador: chico })).status);
  assert.deepEqual(s, [200, 200, 429]);
});

test('buscar: solo administradores', async () => {
  const pedido = (token: string) =>
    new Request('https://x/api/google?accion=buscar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ texto: 'Bien Criollo Pizzas' }) });
  const { fetchFalso, llamadas } = simulador();
  assert.equal((await responderGoogle(pedido('token-malo'), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() })).status, 401);
  assert.ok(!llamadas.some((u) => u.includes('googleapis')));
  const comerciante = simulador({ perfil: 'comerciante' });
  assert.equal((await responderGoogle(pedido('token-bueno'), ENTORNO, { fetch: comerciante.fetchFalso, limitador: new Limitador() })).status, 401);
  const ok = await responderGoogle(pedido('token-bueno'), ENTORNO, { fetch: fetchFalso, limitador: new Limitador() });
  const d = await ok.json();
  assert.equal(d.candidatos.length, 1); // el candidato sin id válido se descarta
  assert.equal(d.candidatos[0].nombre, 'Bien Criollo Pizzas');
});

test('buscar por place_id pegado', async () => {
  const { fetchFalso, llamadas } = simulador();
  const r = await responderGoogle(
    new Request('https://x/api/google?accion=buscar', { method: 'POST', headers: { Authorization: 'Bearer token-bueno' }, body: JSON.stringify({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }) }),
    ENTORNO,
    { fetch: fetchFalso, limitador: new Limitador() },
  );
  assert.equal(r.status, 200);
  assert.ok(llamadas.some((u) => u.endsWith('places/ChIJN1t_tDeuEmsRUsoyG83frY4?languageCode=es')));
});

test('lugar sin reseñas', () => {
  const d = adaptarLugar({}, 'ChIJN1t_tDeuEmsRUsoyG83frY4');
  assert.deepEqual(d, {
    estado: 'ok',
    puntaje: null,
    total: 0,
    resenas: [],
    links: { escribir: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4', verTodas: null },
  });
});

import { calcularPuntaje } from '../src/lib/puntajePropio.ts';

test('puntaje propio de NOGOMAP para el popup: cero, pocas, muchas e inválidas', () => {
  assert.deepEqual(calcularPuntaje([]), { puntaje: null, total: 0 });
  assert.deepEqual(calcularPuntaje([5, 4]), { puntaje: 4.5, total: 2 });
  const muchas = calcularPuntaje(Array.from({ length: 1000 }, (_, i) => (i % 5) + 1));
  assert.equal(muchas.total, 1000);
  assert.equal(formatearPuntaje(muchas.puntaje), '3,0');
  assert.deepEqual(calcularPuntaje([0, -3, 'x', null, 5]), { puntaje: 5, total: 1 });
  assert.equal(textoPuntaje(calcularPuntaje([5, 4, 4]).puntaje, 3), '4,3 (3)');
});

import { textoHorariosParaFicha } from '../src/lib/resenasGoogle.ts';

test('horarios para copiar a Google (lunes primero, turnos cortados, cerrado)', () => {
  const t = textoHorariosParaFicha([
    { dia_semana: 0, hora_apertura: '08:00:00', hora_cierre: '12:00:00' },
    { dia_semana: 0, hora_apertura: '16:00:00', hora_cierre: '20:00:00' },
    { dia_semana: 5, hora_apertura: '09:00:00', hora_cierre: '13:00:00', activo: false },
  ]);
  assert.match(t, /^Lunes: 08:00 a 12:00 y 16:00 a 20:00\n/);
  assert.match(t, /Sábado: Cerrado/);
  assert.match(t, /Domingo: Cerrado$/);
});
