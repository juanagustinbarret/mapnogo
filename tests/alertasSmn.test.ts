// Alertas del SMN: parseo del feed CAP, filtrado por zona, el cron alertas-smn y /api/alertas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enlacesCap, filtrarAlertas, interpretarCap, URL_CAP_SMN } from '../supabase/functions/_shared/capSmn.ts';
import { manejar, MAX_POR_VUELTA, type Entorno } from '../supabase/functions/alertas-smn/index.ts';
import { responderAlertas, textoVigencia } from '../src/lib/alertasSmn.ts';

// 22/10/2026 17:00 en Argentina
const AHORA = new Date('2026-10-22T20:00:00Z');
const NOGOYA = '-32.2,-59.9 -32.6,-59.9 -32.6,-59.6 -32.2,-59.6 -32.2,-59.9';
const CORDOBA = '-30.98,-64.68 -31.42,-64.76 -31.52,-65.36 -30.9,-65.36 -30.98,-64.68';

// XML con el mismo formato que publica el SMN
const cap = ({ evento = 'Tormentas', severidad = 'Moderate', inicio = '2026-10-22T15:00:00-03:00', fin = '2026-10-22T20:59:59-03:00', poligono = NOGOYA, zona = '' } = {}) =>
  `<?xml version="1.0"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>urn:oid:2.49.0.1.32.0.x</identifier><sender>smn@smn.gob.ar</sender><status>Actual</status><msgType>Update</msgType><scope>Public</scope><info><language>es-AR</language><category>Met</category><event>${evento}</event><urgency>Immediate</urgency><severity>${severidad}</severity><certainty>Likely</certainty><onset>${inicio}</onset><expires>${fin}</expires><senderName>Servicio Meteorologico Nacional</senderName><headline>${evento}</headline><description>El &#xE1;rea ser&#xE1; afectada por r&#xE1;fagas de hasta 90 km/h.</description><web>https://www.smn.gob.ar/alertas</web><area><areaDesc>${zona}</areaDesc><polygon>${poligono}</polygon></area></info></alert>`;

const url = (n: number, region = 'Llanura') => `https://ssl.smn.gob.ar/feeds/CAP/xml_generados/CAP_20261022132656_Tormenta_${region}_alertas_alertas_${n}.xml`;
const pagina = (cantidad: number, desde = 0, region?: string) =>
  `<!DOCTYPE html><html><head><title>RSS CAP SMN</title></head><body><h1>Servicio Meteorologico Nacional - RSS CAP</h1>${Array.from(
    { length: cantidad },
    (_, i) => `<div class="item"><div class="link"><a href="${url(desde + i, region)}" target="_blank">Ver XML CAP</a></div></div>`,
  ).join('')}</body></html>`;

const sinLogs = async (fn: () => Promise<void>) => {
  const original = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = original;
  }
};

// ─── Base falsa (lo que hace PostgREST con las dos tablas) y SMN falso ───
const SB = 'https://ejemplo.supabase.co';
type Fila = { url: string; en_nogoya: boolean; alerta: unknown };
const baseFalsa = () => {
  const xml = new Map<string, Fila>();
  const caida = { ahora: false };
  const datos: { estado: Record<string, unknown> | null } = { estado: null };
  const f = async (u: string, init: RequestInit = {}) => {
    if (caida.ahora) return new Response('', { status: 503 });
    const ruta = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    const metodo = init.method ?? 'GET';
    if (metodo === 'POST') {
      const fila = JSON.parse(String(init.body));
      if (ruta === 'alertas_smn_estado') datos.estado = fila;
      else xml.set(fila.url, fila);
      return new Response(null, { status: 201 });
    }
    if (metodo === 'DELETE') {
      for (const borrar of ruta.match(/"[^"]+"/g)!.map((q) => q.slice(1, -1))) xml.delete(borrar);
      return new Response(null, { status: 204 });
    }
    if (ruta.startsWith('alertas_smn_estado')) return Response.json(datos.estado ? [datos.estado] : []);
    if (ruta === 'alertas_smn_xml?select=url') return Response.json([...xml.values()].map((x) => ({ url: x.url })));
    if (ruta === 'alertas_smn_xml?select=alerta&en_nogoya=eq.true') return Response.json([...xml.values()].filter((x) => x.en_nogoya).map((x) => ({ alerta: x.alerta })));
    return new Response('ruta desconocida', { status: 404 });
  };
  return { f, xml, caida, datos };
};

/** fetch falso: el SMN (feed con un enlace por XML) y la base. Anota los pedidos al SMN. */
const fetchFalso = (base: ReturnType<typeof baseFalsa>, xmls: string[], { fallar = (_u: string): number | null => null, region = 'Llanura' } = {}) => {
  const alSmn: string[] = [];
  const f = (async (u: string, init?: RequestInit) => {
    if (u.startsWith(SB)) return base.f(u, init);
    alSmn.push(u);
    const status = fallar(u);
    if (status) return new Response('', { status });
    if (u === URL_CAP_SMN) return new Response(pagina(xmls.length, 0, region));
    return new Response(xmls[Number(u.match(/_(\d+)\.xml$/)?.[1])]);
  }) as typeof fetch;
  return Object.assign(f, { alSmn });
};

const entorno = (f: typeof fetch, ahora = AHORA): Entorno => ({
  leer: (n) => ({ SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'servicio', CRON_SECRET: 'secreto' } as Record<string, string>)[n],
  fetch: f,
  ahora: () => ahora,
  esperar: async () => {},
  log: () => {},
});
const delCron = () => new Request('https://x/functions/v1/alertas-smn', { method: 'POST', headers: { 'x-cron-secret': 'secreto' } });
const api = (f: typeof fetch, ahora = AHORA) => responderAlertas({ url: SB, anonKey: 'anon' }, f, ahora);

test('parseo: nivel, fenómeno, vigencia, texto con acentos y polígono', () => {
  const a = interpretarCap(cap({ severidad: 'Severe' }))!;
  assert.equal(a.nivel, 'naranja');
  assert.equal(a.fenomeno, 'Tormentas');
  assert.equal(a.inicio, '2026-10-22T18:00:00.000Z');
  assert.equal(a.fin, '2026-10-22T23:59:59.000Z');
  assert.equal(a.descripcion, 'El área será afectada por ráfagas de hasta 90 km/h.');
  assert.equal(a.rafagas, 90); // las ráfagas salen solo del texto del SMN
  assert.equal(a.poligonos[0].length, 5);
  assert.equal(interpretarCap(cap({ severidad: 'Moderate' }))!.nivel, 'amarilla');
  assert.equal(interpretarCap(cap({ severidad: 'Extreme' }))!.nivel, 'roja');
});

test('parseo: sin ráfagas en el texto, no hay ráfagas', () => {
  const a = interpretarCap(cap().replace(/<description>[^<]*<\/description>/, '<description>Lluvias de variada intensidad. Acumulados de 40 a 70 mm.</description>'))!;
  assert.equal(a.rafagas, undefined);
});

test('parseo: XML inválido o sin datos esenciales → null', () => {
  assert.equal(interpretarCap('no es xml'), null);
  assert.equal(interpretarCap('<html><body>Error</body></html>'), null);
  assert.equal(interpretarCap(cap({ severidad: 'Minor' })), null);
  assert.equal(interpretarCap(cap({ fin: 'mañana' })), null);
  assert.equal(interpretarCap(cap({ evento: '' }).replace(/<headline>[^<]*<\/headline>/, '')), null);
});

test('página: enlaces a los XML (RSS o HTML); formato inesperado → null', () => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Ultimos Avisos publicados por el SMN</title><item><title>Tormentas</title><link>${url(0)}</link><guid>${url(0)}</guid></item><item><title>Viento</title><link>${url(1)}</link></item></channel></rss>`;
  assert.deepEqual(enlacesCap(rss), [url(0), url(1)]);
  assert.deepEqual(enlacesCap(pagina(2)), [url(0), url(1)]);
  assert.deepEqual(enlacesCap(pagina(0)), []);
  assert.equal(enlacesCap('<html><body>Mantenimiento</body></html>'), null);
});

test('filtrado: sin alertas', () => {
  assert.deepEqual(filtrarAlertas([], undefined, AHORA), []);
});

test('filtrado: amarilla, naranja y roja vigentes → la más grave primero', () => {
  const alertas = [
    interpretarCap(cap({ evento: 'Lluvias', severidad: 'Moderate' }))!,
    interpretarCap(cap({ evento: 'Viento', severidad: 'Extreme' }))!,
    interpretarCap(cap({ evento: 'Tormentas', severidad: 'Severe' }))!,
  ];
  assert.deepEqual(
    filtrarAlertas(alertas, undefined, AHORA).map((a) => `${a.nivel} ${a.fenomeno}`),
    ['roja Viento', 'naranja Tormentas', 'amarilla Lluvias'],
  );
});

test('filtrado: vencida fuera; la que empieza en las próximas horas sí; muy lejana no', () => {
  const vencida = interpretarCap(cap({ inicio: '2026-10-22T09:00:00-03:00', fin: '2026-10-22T14:59:59-03:00' }))!;
  const proxima = interpretarCap(cap({ inicio: '2026-10-22T21:00:00-03:00', fin: '2026-10-23T02:59:59-03:00' }))!;
  const lejana = interpretarCap(cap({ inicio: '2026-10-24T09:00:00-03:00', fin: '2026-10-24T20:59:59-03:00' }))!;
  assert.deepEqual(filtrarAlertas([vencida, proxima, lejana], undefined, AHORA).map((a) => a.inicio), ['2026-10-23T00:00:00.000Z']);
});

test('filtrado: otra zona fuera; zona que nombra a Nogoyá adentro; duplicadas una sola vez', () => {
  const cordoba = interpretarCap(cap({ poligono: CORDOBA }))!;
  assert.deepEqual(filtrarAlertas([cordoba], undefined, AHORA), []);
  const porNombre = interpretarCap(cap({ poligono: CORDOBA, zona: 'Nogoyá - Entre Ríos' }))!;
  assert.equal(filtrarAlertas([porNombre], undefined, AHORA).length, 1);
  const a = interpretarCap(cap())!;
  assert.equal(filtrarAlertas([a, a], undefined, AHORA).length, 1);
});

test('vigencia en hora argentina', () => {
  assert.equal(textoVigencia({ inicio: '2026-10-22T18:00:00Z', fin: '2026-10-22T23:59:59Z' }, AHORA), 'hoy 15:00 a 20:59');
  assert.equal(textoVigencia({ inicio: '2026-10-23T00:00:00Z', fin: '2026-10-23T05:59:59Z' }, AHORA), 'hoy 21:00 a vie 23 02:59');
});

// ─── Cron (Edge Function alertas-smn) ───

test('cron: sin el secreto no corre', async () => {
  const sinSecreto = new Request('https://x', { method: 'POST' });
  assert.equal((await manejar(sinSecreto, entorno(fetchFalso(baseFalsa(), [])))).status, 401);
});

test('cron: guarda qué XML tocan a Nogoyá, saltea Cordillera/Patagonia y no vuelve a bajar lo ya leído', async () => {
  const base = baseFalsa();
  const f = fetchFalso(base, [cap({ severidad: 'Severe' }), cap({ poligono: CORDOBA }), cap({ severidad: 'Minor' })]);
  const r = await (await manejar(delCron(), entorno(f))).json();
  assert.deepEqual(r, { leidos: 3, pendientes: 0, completo: true, error: null });
  assert.deepEqual([...base.xml.values()].map((x) => x.en_nogoya), [true, false, false]);
  assert.equal((base.xml.get(url(0))!.alerta as { nivel: string }).nivel, 'naranja');
  assert.equal('poligonos' in (base.xml.get(url(0))!.alerta as object), false);
  assert.equal(base.datos.estado!.completo, true);
  // Segunda vuelta: solo el feed
  await manejar(delCron(), entorno(f));
  assert.equal(f.alSmn.length, 4 + 1);
  // Cordillera: ni se pide
  const cordillera = fetchFalso(baseFalsa(), [cap({ severidad: 'Extreme' })], { region: 'Cordillera' });
  await manejar(delCron(), entorno(cordillera));
  assert.deepEqual(cordillera.alSmn, [URL_CAP_SMN]);
});

test('cron: lo que salió del feed se borra', async () => {
  const base = baseFalsa();
  const viejo = 'https://ssl.smn.gob.ar/feeds/CAP/xml_generados/viejo.xml';
  base.xml.set(viejo, { url: viejo, en_nogoya: true, alerta: {} });
  await manejar(delCron(), entorno(fetchFalso(base, [cap()])));
  assert.deepEqual([...base.xml.keys()], [url(0)]);
});

test('cron: ante un 429 corta la vuelta, guarda lo leído y sigue en la próxima', async () => {
  const base = baseFalsa();
  let bloqueado = true;
  const f = fetchFalso(base, [cap(), cap(), cap()], { fallar: (u) => (bloqueado && u === url(1) ? 429 : null) });
  const r = await (await manejar(delCron(), entorno(f))).json();
  assert.deepEqual({ leidos: r.leidos, pendientes: r.pendientes, completo: r.completo }, { leidos: 1, pendientes: 2, completo: false });
  assert.match(r.error, /429/);
  assert.equal(f.alSmn.filter((u) => u === url(2)).length, 0); // después del 429 no pide más
  bloqueado = false;
  const r2 = await (await manejar(delCron(), entorno(f))).json();
  assert.deepEqual({ leidos: r2.leidos, completo: r2.completo }, { leidos: 2, completo: true });
});

test('cron: como mucho MAX_POR_VUELTA XML por vuelta, con pausa entre cada uno', async () => {
  let pausas = 0;
  const f = fetchFalso(baseFalsa(), Array.from({ length: MAX_POR_VUELTA + 5 }, () => cap()));
  const r = await (await manejar(delCron(), { ...entorno(f), esperar: async () => void pausas++ })).json();
  assert.deepEqual({ leidos: r.leidos, pendientes: r.pendientes, completo: r.completo }, { leidos: MAX_POR_VUELTA, pendientes: 5, completo: false });
  assert.equal(pausas, MAX_POR_VUELTA - 1);
});

test('cron: feed caído, o un XML que no es CAP → vuelta incompleta, sin guardar ese XML', async () => {
  const casos: [string[], (u: string) => number | null][] = [
    [[cap()], (u) => (u === URL_CAP_SMN ? 503 : null)],
    [['<html>Un momento</html>'], () => null],
  ];
  for (const [xmls, fallar] of casos) {
    const base = baseFalsa();
    const r = await (await manejar(delCron(), entorno(fetchFalso(base, xmls, { fallar })))).json();
    assert.equal(r.completo, false);
    assert.equal(base.xml.size, 0);
    assert.equal(base.datos.estado!.completo, false);
  }
});

// ─── /api/alertas (lee de Supabase) ───

const conAlertas = async (xmls: string[]) => {
  const base = baseFalsa();
  const f = fetchFalso(base, xmls);
  await manejar(delCron(), entorno(f));
  return { base, f };
};

test('/api/alertas: amarilla, naranja y roja de Nogoyá, la más grave primero, sin consultar al SMN', async () => {
  const { f } = await conAlertas([cap({ severidad: 'Moderate' }), cap({ poligono: CORDOBA, severidad: 'Extreme' }), cap({ severidad: 'Severe' }), cap({ evento: 'Viento', severidad: 'Extreme' })]);
  const pedidosAlSmn = f.alSmn.length;
  const r = await api(f);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('Cache-Control')!, /s-maxage=300/);
  const cuerpo = await r.json();
  assert.deepEqual(cuerpo.alertas.map((a: { nivel: string }) => a.nivel), ['roja', 'naranja', 'amarilla']);
  assert.equal(cuerpo.alertas[0].rafagas, 90);
  assert.equal(cuerpo.completo, true);
  assert.equal(f.alSmn.length, pedidosAlSmn);
});

test('/api/alertas: sin alertas → lista vacía (200)', async () => {
  const { f } = await conAlertas([cap({ poligono: CORDOBA })]);
  const r = await api(f);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).alertas, []);
});

test('/api/alertas: la vencida no aparece', async () => {
  const { f } = await conAlertas([cap({ inicio: '2026-10-22T09:00:00-03:00', fin: '2026-10-22T14:59:59-03:00' })]);
  assert.deepEqual((await (await api(f)).json()).alertas, []);
});

test('/api/alertas: vuelta incompleta con alertas → se muestran; sin alertas → 502', async () => {
  const conUna = await conAlertas([cap({ severidad: 'Severe' })]);
  conUna.base.datos.estado = { ...conUna.base.datos.estado!, completo: false };
  const r = await (await api(conUna.f)).json();
  assert.deepEqual({ niveles: r.alertas.map((a: { nivel: string }) => a.nivel), completo: r.completo }, { niveles: ['naranja'], completo: false });
  await sinLogs(async () => {
    const vacia = await conAlertas([cap({ poligono: CORDOBA })]);
    vacia.base.datos.estado = { ...vacia.base.datos.estado!, completo: false };
    assert.equal((await api(vacia.f)).status, 502);
  });
});

test('/api/alertas: cron parado, sin estado, Supabase caído o sin configurar → 502 sin caché, nunca "sin alertas"', async () => {
  await sinLogs(async () => {
    const { base, f } = await conAlertas([cap({ poligono: CORDOBA })]);
    const respuestas = [
      await api(f, new Date(AHORA.getTime() + 31 * 60_000)), // el cron no corre hace 31 minutos
      await api(fetchFalso(baseFalsa(), [])), // el cron nunca corrió
      await responderAlertas({}, f, AHORA), // faltan las variables
    ];
    base.caida.ahora = true;
    respuestas.push(await api(f)); // Supabase caído
    respuestas.push(await api((async () => { throw new TypeError('fetch failed'); }) as typeof fetch)); // sin red
    for (const r of respuestas) {
      assert.equal(r.status, 502);
      assert.equal(r.headers.get('Cache-Control'), 'no-store');
      assert.equal((await r.json()).alertas, undefined);
    }
  });
});
