// supabase/functions/notificar-promociones/index.ts

import { armarPedidoPush, type ClavesVapid, type SuscripcionPush } from '../_shared/webpush.ts';
import {
  MENSAJE_PRUEBA,
  clasificarRespuesta,
  decidir,
  enParalelo,
  inicioDelDiaArgentina,
  limitesDesdeEntorno,
  armarMensaje,
  resumir,
  type ComercioAviso,
  type MensajePush,
  type Promocion,
  type ResultadoEnvio,
} from './logica.ts';

export interface Entorno {
  leer: (nombre: string) => string | undefined;
  fetch: typeof fetch;
  ahora: () => Date;
  log: (evento: Record<string, unknown>) => void;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CONCURRENCIA = 10;

export async function manejar(req: Request, entorno: Entorno): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Usá POST' }, 405);

  const url = entorno.leer('SUPABASE_URL') ?? 'https://graipurciaipsoonmtqk.supabase.co';
  const servicio = entorno.leer('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servicio) return responder({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }, 500);

  // Claves VAPID con fallback directo a tus claves facilitadas
  const claves: ClavesVapid = {
    publica: entorno.leer('VAPID_PUBLIC_KEY') || '8d1452b7a37cbe003ed8353d4c2d749bde3a283ca49c8bd56fdaf6bbb630dc7f',
    privada: entorno.leer('VAPID_PRIVATE_KEY') || 'dd173855016eb647b59401e7ef8e22be8bd23ba24904d087db135035c874fb91',
    sujeto: entorno.leer('VAPID_SUBJECT') || 'mailto:soporte@mapnogo.vercel.app',
  };

  if (!claves.publica || !claves.privada || !claves.sujeto) {
    entorno.log({ evento: 'config_incompleta', falta: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].filter((n) => !entorno.leer(n)) });
    return responder({ error: 'Faltan las claves VAPID en los secretos de la función.' }, 500);
  }

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

  // ── Quién llama ──
  const cuerpo = (await req.json().catch(() => ({}))) as { modo?: string; endpoint?: string };
  const modo = cuerpo.modo ?? 'pendientes';
  const secretoCron = entorno.leer('CRON_SECRET');
  const esCron = !!secretoCron && req.headers.get('x-cron-secret') === secretoCron;

  let usuario: { id: string; rol: string | null } | null = null;
  if (!esCron) {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || token === servicio) return responder({ error: 'No autorizado' }, 401);
    const r = await entorno.fetch(`${url}/auth/v1/user`, { headers: { apikey: servicio, Authorization: `Bearer ${token}` } });
    if (!r.ok) return responder({ error: 'Sesión inválida' }, 401);
    const { id } = (await r.json()) as { id: string };
    const perfiles = (await rest(`profiles?select=rol&id=eq.${encodeURIComponent(id)}`)) as { rol: string }[];
    usuario = { id, rol: perfiles?.[0]?.rol ?? null };
  }
  const esAdmin = usuario?.rol === 'admin';

  // ── Envío a una lista de suscripciones ──
  const enviar = async (subs: SuscripcionPush[], mensaje: MensajePush) => {
    const texto = JSON.stringify(mensaje);
    const resultados = await enParalelo(subs, CONCURRENCIA, async (s): Promise<{ r: ResultadoEnvio; s: SuscripcionPush; detalle?: string }> => {
      try {
        const pedido = await armarPedidoPush(s, texto, claves);
        const resp = await entorno.fetch(pedido.url, { method: 'POST', headers: pedido.headers, body: pedido.body as BodyInit });
        const r = clasificarRespuesta(resp.status);
        return { r, s, detalle: r === 'ok' ? undefined : `${resp.status} ${(await resp.text().catch(() => '')).slice(0, 120)}` };
      } catch (e) {
        return { r: 'error', s, detalle: String((e as Error)?.message ?? e).slice(0, 120) };
      }
    });

    const vencidas = resultados.filter((x) => x.r === 'vencida').map((x) => x.s.endpoint);
    let borradas = 0;
    for (const endpoint of vencidas) {
      try {
        await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
        borradas++;
      } catch (e) {
        entorno.log({ evento: 'no_se_pudo_borrar_suscripcion', error: String(e) });
      }
    }
    const resumen = resumir(resultados.map((x) => x.r), borradas);
    const errores = resultados.filter((x) => x.r !== 'ok').slice(0, 5).map((x) => ({ motivo: x.r, detalle: x.detalle, servicio: new URL(x.s.endpoint).host }));
    if ((resumen.porMotivo.claves ?? 0) > 0) {
      entorno.log({ evento: 'claves_vapid_rechazadas', cantidad: resumen.porMotivo.claves, pista: 'La clave privada no corresponde a la pública con la que se suscribieron los dispositivos.' });
    }
    return { resumen, errores };
  };

  const registrar = (fila: Record<string, unknown>) =>
    rest('notificaciones_envios', { method: 'POST', body: JSON.stringify(fila), headers: { Prefer: 'return=minimal' } }).catch((e) =>
      entorno.log({ evento: 'no_se_pudo_registrar_envio', error: String(e) }),
    );

  // ── Modo prueba ──
  if (modo === 'prueba') {
    if (!esAdmin) return responder({ error: 'Solo un administrador puede mandar pruebas.' }, 403);
    if (!cuerpo.endpoint || !/^https:\/\//.test(cuerpo.endpoint)) return responder({ error: 'Falta el endpoint de este dispositivo.' }, 400);
    const subs = (await rest(`push_subscriptions?select=endpoint,p256dh,auth&endpoint=eq.${encodeURIComponent(cuerpo.endpoint)}`)) as SuscripcionPush[];
    if (!subs?.length) return responder({ error: 'Este dispositivo no está suscripto.' }, 404);
    const { resumen, errores } = await enviar(subs.slice(0, 1), MENSAJE_PRUEBA);
    await registrar({ modo: 'prueba', estado: resumen.enviadas ? 'enviada' : 'error', destinatarios: resumen.destinatarios, enviadas: resumen.enviadas, fallidas: resumen.fallidas, borradas: resumen.borradas, detalle: { errores } });
    return responder({ modo, ...resumen, errores });
  }

  if (modo !== 'pendientes' && modo !== 'simulacion') return responder({ error: `Modo desconocido: ${modo}` }, 400);
  if (modo === 'simulacion' && !esAdmin) return responder({ error: 'Solo un administrador puede simular.' }, 403);

  // ── Publicaciones pendientes de aviso ──
  let filtroComercio = '';
  if (!esCron && !esAdmin) {
    const propios = (await rest(`comercios?select=id&propietario_id=eq.${encodeURIComponent(usuario!.id)}`)) as { id: string }[];
    if (!propios?.length) return responder({ procesadas: [] });
    filtroComercio = `&comercio_id=in.(${propios.map((c) => c.id).join(',')})`;
  }
  const columnas = 'id,comercio_id,titulo,descripcion,tipo,precio_anterior,precio_promocional,fecha_inicio,fecha_fin,aprobada,created_at,notificada_at';
  const promos = ((await rest(`promociones?select=${columnas}&notificada_at=is.null${filtroComercio}&order=created_at.asc&limit=50`)) ?? []) as Promocion[];
  if (!promos.length) return responder({ modo, procesadas: [] });

  const idsComercios = [...new Set(promos.map((p) => p.comercio_id))];
  const comercios = ((await rest(`comercios?select=id,nombre,slug&id=in.(${idsComercios.join(',')})`)) ?? []) as ComercioAviso[];
  const porId = new Map(comercios.map((c) => [c.id, c]));
  const publico = new Map<string, boolean>();
  for (const id of idsComercios) {
    publico.set(id, (await rest('rpc/es_comercio_publico', { method: 'POST', body: JSON.stringify({ comercio_uuid: id }) })) === true);
  }

  const ahora = entorno.ahora();
  const deHoy = ((await rest(`notificaciones_envios?select=comercio_id&modo=eq.promocion&estado=eq.enviada&created_at=gte.${encodeURIComponent(inicioDelDiaArgentina(ahora))}`)) ?? []) as { comercio_id: string }[];
  const hoyPorComercio = new Map<string, number>();
  for (const f of deHoy) hoyPorComercio.set(f.comercio_id, (hoyPorComercio.get(f.comercio_id) ?? 0) + 1);
  let hoyTotal = deHoy.length;
  const limites = limitesDesdeEntorno(entorno.leer);

  let suscripciones: SuscripcionPush[] | null = null;
  const cargarSuscripciones = async () => {
    if (suscripciones) return suscripciones;
    const todas: SuscripcionPush[] = [];
    for (let desde = 0; ; desde += 1000) {
      const pagina = ((await rest(`push_subscriptions?select=endpoint,p256dh,auth&order=endpoint.asc&limit=1000&offset=${desde}`)) ?? []) as SuscripcionPush[];
      todas.push(...pagina.filter((s) => s.endpoint && s.p256dh && s.auth));
      if (pagina.length < 1000) break;
    }
    suscripciones = todas;
    return todas;
  };

  const procesadas: Record<string, unknown>[] = [];
  for (const p of promos) {
    const comercio = porId.get(p.comercio_id);
    const decision = decidir(p, {
      ahora,
      comercioPublico: !!comercio && publico.get(p.comercio_id) === true,
      enviadasHoyComercio: hoyPorComercio.get(p.comercio_id) ?? 0,
      enviadasHoyTotal: hoyTotal,
      limites,
    });

    if (modo === 'simulacion') {
      procesadas.push({ id: p.id, comercio: comercio?.nombre, ...decision, destinatarios: decision.accion === 'enviar' ? (await cargarSuscripciones()).length : 0 });
      if (decision.accion === 'enviar') {
        hoyPorComercio.set(p.comercio_id, (hoyPorComercio.get(p.comercio_id) ?? 0) + 1);
        hoyTotal++;
      }
      continue;
    }

    if (decision.accion === 'esperar') {
      procesadas.push({ id: p.id, ...decision });
      continue;
    }

    const estadoReserva = decision.accion === 'enviar' ? 'enviando' : `omitida_${decision.motivo}`;
    const reservada = (await rest(`promociones?id=eq.${encodeURIComponent(p.id)}&notificada_at=is.null`, {
      method: 'PATCH',
      body: JSON.stringify({ notificada_at: ahora.toISOString(), notificacion_estado: estadoReserva }),
      headers: { Prefer: 'return=representation' },
    })) as unknown[];
    if (!reservada?.length) {
      procesadas.push({ id: p.id, accion: 'omitir', motivo: 'tomada_por_otra_ejecucion' });
      continue;
    }

    if (decision.accion === 'omitir') {
      entorno.log({ evento: 'promo_omitida', promocion: p.id, comercio: p.comercio_id, motivo: decision.motivo });
      await registrar({ modo: 'promocion', promocion_id: p.id, comercio_id: p.comercio_id, estado: `omitida_${decision.motivo}`, destinatarios: 0, enviadas: 0, fallidas: 0, borradas: 0 });
      procesadas.push({ id: p.id, ...decision });
      continue;
    }

    const subs = await cargarSuscripciones();
    const mensaje = armarMensaje(p, comercio!);
    const { resumen, errores } = subs.length ? await enviar(subs, mensaje) : { resumen: resumir([], 0), errores: [] };
    // "enviada" cuenta para el límite diario: solo si le llegó a alguien
    const estado = !subs.length ? 'sin_destinatarios' : resumen.enviadas > 0 ? 'enviada' : 'fallida';
    await rest(`promociones?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', body: JSON.stringify({ notificacion_estado: estado }), headers: { Prefer: 'return=minimal' } });
    entorno.log({ evento: 'promo_notificada', promocion: p.id, comercio: comercio!.nombre, ...resumen, errores });
    await registrar({ modo: 'promocion', promocion_id: p.id, comercio_id: p.comercio_id, estado, destinatarios: resumen.destinatarios, enviadas: resumen.enviadas, fallidas: resumen.fallidas, borradas: resumen.borradas, detalle: { errores, porMotivo: resumen.porMotivo } });
    if (estado === 'enviada') {
      hoyPorComercio.set(p.comercio_id, (hoyPorComercio.get(p.comercio_id) ?? 0) + 1);
      hoyTotal++;
    }
    procesadas.push({ id: p.id, accion: 'enviar', estado, ...resumen });
  }

  return responder({ modo, procesadas });
}

const deno = (globalThis as { Deno?: { serve: (h: (req: Request) => Promise<Response>) => void; env: { get: (n: string) => string | undefined } } }).Deno;
if (deno) {
  deno.serve((req) =>
    manejar(req, {
      leer: (n) => deno.env.get(n),
      fetch: (...a) => fetch(...a),
      ahora: () => new Date(),
      log: (e) => console.log(JSON.stringify(e)),
    }).catch((e) => {
      console.error(JSON.stringify({ evento: 'error', error: String(e?.message ?? e) }));
      return responder({ error: 'No se pudieron procesar las notificaciones.', detalle: String(e?.message ?? e) }, 500);
    }),
  );
}