// Service worker (public/sw.js) ejecutado en un entorno falso: se verifica
// qué notificación se muestra y qué pestaña se abre, sin navegador real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://mapnogo.vercel.app';

function cargarSW({ ventanas = [] } = {}) {
  const oyentes = {};
  const mostradas = [];
  const abiertas = [];
  const self = {
    location: new URL(`${ORIGEN}/sw.js`),
    addEventListener: (tipo, fn) => (oyentes[tipo] = fn),
    skipWaiting: () => undefined,
    registration: { showNotification: async (titulo, opciones) => mostradas.push({ titulo, opciones }) },
    clients: {
      claim: async () => undefined,
      matchAll: async () => ventanas,
      openWindow: async (url) => abiertas.push(url),
    },
  };
  vm.runInNewContext(codigo, { self, URL, console, String });
  return { oyentes, mostradas, abiertas };
}

async function disparar(oyente, evento) {
  const esperas = [];
  oyente({ ...evento, waitUntil: (p) => esperas.push(p) });
  await Promise.all(esperas);
}

const datos = (contenido) => ({
  json: () => (typeof contenido === 'string' ? JSON.parse(contenido) : contenido),
  text: () => (typeof contenido === 'string' ? contenido : JSON.stringify(contenido)),
});

test('push con JSON: título, cuerpo, URL absoluta del sitio, ícono y etiqueta', async () => {
  const sw = cargarSW();
  await disparar(sw.oyentes.push, {
    data: datos({ title: '2x1 en Pizzería Don Pepe', body: 'Solo hoy', url: '/comercio/don-pepe', tag: 'promo-7' }),
  });
  assert.equal(sw.mostradas.length, 1);
  const { titulo, opciones } = sw.mostradas[0];
  assert.equal(titulo, '2x1 en Pizzería Don Pepe');
  assert.equal(opciones.body, 'Solo hoy');
  assert.equal(opciones.data.url, `${ORIGEN}/comercio/don-pepe`);
  assert.equal(opciones.tag, 'promo-7');
  assert.equal(opciones.icon, '/pwa-192x192.png?v=2');
  assert.equal(opciones.badge, '/badge-96x96.png?v=2');
});

test('push con texto plano: se muestra igual (antes se perdía)', async () => {
  const sw = cargarSW();
  await disparar(sw.oyentes.push, { data: datos('Nueva promo cerca tuyo') });
  assert.equal(sw.mostradas.length, 1);
  assert.equal(sw.mostradas[0].opciones.body, 'Nueva promo cerca tuyo');
  assert.equal(sw.mostradas[0].titulo, 'NOGOMAP 🏪');
});

test('push sin datos o con campos vacíos: muestra el aviso por defecto', async () => {
  const sw = cargarSW();
  await disparar(sw.oyentes.push, { data: null });
  await disparar(sw.oyentes.push, { data: datos({ title: '  ', body: '' }) });
  assert.equal(sw.mostradas.length, 2);
  for (const { titulo, opciones } of sw.mostradas) {
    assert.equal(titulo, 'NOGOMAP 🏪');
    assert.match(opciones.body, /oferta o novedad/);
    assert.equal(opciones.data.url, `${ORIGEN}/`);
  }
});

test('una URL externa en el mensaje no se abre: va al inicio del sitio', async () => {
  const sw = cargarSW();
  await disparar(sw.oyentes.push, { data: datos({ url: 'https://sitio-malicioso.example/login' }) });
  await disparar(sw.oyentes.push, { data: datos({ url: 'javascript:alert(1)' }) });
  assert.deepEqual(
    sw.mostradas.map((m) => m.opciones.data.url),
    [`${ORIGEN}/`, `${ORIGEN}/`],
  );
});

test('click: si la página ya está abierta, la enfoca sin abrir otra', async () => {
  let enfocada = false;
  const ventana = { url: `${ORIGEN}/comercio/don-pepe`, focus: async () => (enfocada = true), navigate: async () => null };
  const sw = cargarSW({ ventanas: [ventana] });
  let cerrada = false;
  await disparar(sw.oyentes.notificationclick, {
    notification: { close: () => (cerrada = true), data: { url: `${ORIGEN}/comercio/don-pepe` } },
  });
  assert.equal(cerrada, true);
  assert.equal(enfocada, true);
  assert.deepEqual(sw.abiertas, []);
});

test('click: con otra pestaña del sitio abierta, la lleva a la página del aviso', async () => {
  const navegadas = [];
  const ventana = {
    url: `${ORIGEN}/`,
    focus: async () => undefined,
    navigate: async (url) => {
      navegadas.push(url);
      return ventana;
    },
  };
  const sw = cargarSW({ ventanas: [ventana] });
  await disparar(sw.oyentes.notificationclick, {
    notification: { close: () => undefined, data: { url: `${ORIGEN}/promociones` } },
  });
  assert.deepEqual(navegadas, [`${ORIGEN}/promociones`]);
  assert.deepEqual(sw.abiertas, []);
});

test('click: sin pestañas abiertas, abre una nueva en la página del aviso', async () => {
  const sw = cargarSW();
  await disparar(sw.oyentes.notificationclick, {
    notification: { close: () => undefined, data: { url: '/comercio/don-pepe' } },
  });
  assert.deepEqual(sw.abiertas, [`${ORIGEN}/comercio/don-pepe`]);
});
