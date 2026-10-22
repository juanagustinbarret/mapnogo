// supabase/functions/alertas-smn/index.ts
//
// Cron cada 10 minutos: baja del SMN los XML CAP nuevos, despacio, y guarda en
// alertas_smn_xml cuáles tocan a Nogoyá. /api/alertas lee de ahí (nunca
// consulta al SMN). Ver supabase/propuestas/20261022_alertas_smn.sql.
//
// Por qué así: el SMN corta con 429 si se le piden muchos XML seguidos. Cada
// XML tiene la fecha de emisión en el nombre y no cambia, así que se lee una
// sola vez: de a uno, con una pausa, como mucho MAX_POR_VUELTA por vuelta. Si
// el SMN responde 429, la vuelta termina y sigue en la próxima.
//
// Secretos: CRON_SECRET (el mismo de los otros crons; el cron lo manda en
// x-cron-secret). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los pone
// Supabase. Se despliega con --no-verify-jwt (el cron no manda token).

import { URL_CAP_SMN, REGIONES_AJENAS, afecta, enlacesCap, interpretarCap, sinArea } from '../_shared/capSmn.ts';

export interface Entorno {
  leer: (nombre: string) => string | undefined;
  fetch: typeof fetch;
  ahora: () => Date;
  esperar: (ms: number) => Promise<void>;
  log: (evento: Record<string, unknown>) => void;
}

export const MAX_POR_VUELTA = 60;
export const PAUSA_MS = 1000;

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export async function manejar(req: Request, entorno: Entorno): Promise<Response> {
  if (req.method !== 'POST') return responder({ error: 'Usá POST' }, 405);
  const secreto = entorno.leer('CRON_SECRET');
  if (!secreto) return responder({ error: 'Falta el secreto CRON_SECRET' }, 500);
  if (req.headers.get('x-cron-secret') !== secreto) return responder({ error: 'No autorizado' }, 401);

  const url = entorno.leer('SUPABASE_URL');
  const servicio = entorno.leer('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servicio) return responder({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }, 500);

  // ── Acceso a la base con la clave de servicio ──
  const rest = async (ruta: string, init: RequestInit = {}) => {
    const r = await entorno.fetch(`${url}/rest/v1/${ruta}`, {
      ...init,
      headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`Base: ${init.method ?? 'GET'} ${ruta.split('?')[0]} → ${r.status} ${await r.text().catch(() => '')}`);
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  };
  const guardar = (tabla: string, fila: Record<string, unknown>) =>
    rest(tabla, { method: 'POST', body: JSON.stringify(fila), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  const lista = (urls: string[]) => `(${urls.map((u) => `"${u}"`).join(',')})`;

  let leidos = 0;
  let pendientes = 0;
  let error: string | null = null;
  try {
    const feed = await entorno.fetch(URL_CAP_SMN, { headers: { Accept: 'application/rss+xml, application/xml' } });
    if (!feed.ok) throw new Error(`SMN respondió ${feed.status} (feed)`);
    const enlaces = enlacesCap(await feed.text());
    if (!enlaces) throw new Error('El feed del SMN no tiene el formato esperado');
    const relevantes = enlaces.filter((u) => !REGIONES_AJENAS.test(u));

    const guardados = ((await rest('alertas_smn_xml?select=url')) ?? []).map((f: { url: string }) => f.url) as string[];
    // Lo que ya no está en el feed se borra (el SMN lo reemplazó o venció)
    const viejos = guardados.filter((u) => !relevantes.includes(u));
    if (viejos.length) await rest(`alertas_smn_xml?url=in.${encodeURIComponent(lista(viejos))}`, { method: 'DELETE' });

    const nuevos = relevantes.filter((u) => !guardados.includes(u));
    pendientes = nuevos.length;
    for (const u of nuevos.slice(0, MAX_POR_VUELTA)) {
      if (leidos > 0) await entorno.esperar(PAUSA_MS);
      const r = await entorno.fetch(u, { headers: { Accept: 'application/xml' } });
      if (!r.ok) throw new Error(`SMN respondió ${r.status} (${u.split('/').pop()})`);
      const xml = await r.text();
      // Una página de error con 200 no se guarda como "leído": se reintenta en la próxima vuelta
      if (!/<alert[\s>]/.test(xml)) throw new Error(`XML inválido (${u.split('/').pop()})`);
      const alerta = interpretarCap(xml);
      const enNogoya = !!alerta && afecta(alerta);
      await guardar('alertas_smn_xml', { url: u, leido_at: entorno.ahora().toISOString(), en_nogoya: enNogoya, alerta: enNogoya ? sinArea(alerta!) : null });
      leidos++;
      pendientes--;
    }
  } catch (e) {
    error = String((e as Error)?.message ?? e);
  }

  const completo = !error && pendientes === 0;
  entorno.log({ evento: 'alertas_smn', leidos, pendientes, completo, error });
  try {
    await guardar('alertas_smn_estado', { id: 1, actualizado_at: entorno.ahora().toISOString(), completo, pendientes, error });
  } catch (e) {
    entorno.log({ evento: 'alertas_smn_estado_fallo', error: String((e as Error)?.message ?? e) });
    return responder({ leidos, pendientes, completo: false, error: 'No se pudo guardar el estado' }, 500);
  }
  return responder({ leidos, pendientes, completo, error });
}

// En Supabase (Deno). En las pruebas (Node) no existe Deno y se usa manejar().
const deno = (globalThis as { Deno?: { serve: (h: (req: Request) => Promise<Response>) => void; env: { get: (n: string) => string | undefined } } }).Deno;
if (deno) {
  deno.serve((req) =>
    manejar(req, {
      leer: (n) => deno.env.get(n),
      fetch: (...a) => fetch(...a),
      ahora: () => new Date(),
      esperar: (ms) => new Promise((listo) => setTimeout(listo, ms)),
      log: (e) => console.log(JSON.stringify(e)),
    }),
  );
}
