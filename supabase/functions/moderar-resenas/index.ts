// supabase/functions/moderar-resenas/index.ts
//
// Pedidos de eliminación de reseñas: el comercio pide, el admin decide.
//
// Acciones (POST JSON {accion, ...}, siempre con sesión):
//   solicitar { resena_id, motivo }               dueño del comercio de la reseña
//   resolver  { solicitud_id, aprobar, nota? }    admin
//
// Reglas: motivo de 10 a 500 caracteres, una sola solicitud pendiente por
// reseña, como mucho LIMITE_SOLICITUDES_RESENAS_POR_DIA (5) por comercio en
// 24 h. Al aprobar, la reseña queda marcada (eliminada_at / eliminada_por) y
// deja de verse (política de supabase/propuestas/20261026_moderacion_resenas.sql).
// Cada paso queda en auditoria_moderacion_resenas.
//
// Secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los pone Supabase).

import { LIMITE_SOLICITUDES_POR_DIA, validarMotivo, validarNota } from '../_shared/moderacionResenas.ts';

export interface Entorno {
  leer: (nombre: string) => string | undefined;
  fetch: typeof fetch;
  ahora: () => Date;
  log: (evento: Record<string, unknown>) => void;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const esUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export async function manejar(req: Request, entorno: Entorno): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Usá POST' }, 405);

  const url = entorno.leer('SUPABASE_URL');
  const servicio = entorno.leer('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servicio) return responder({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }, 500);
  const ahora = entorno.ahora();

  const rest = async (ruta: string, init: RequestInit = {}) => {
    const r = await entorno.fetch(`${url}/rest/v1/${ruta}`, {
      ...init,
      headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!r.ok) throw Object.assign(new Error(`${init.method ?? 'GET'} ${ruta.split('?')[0]} → ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`), { status: r.status });
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  };
  const auditar = (fila: Record<string, unknown>) =>
    rest('auditoria_moderacion_resenas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fila) });

  // ── Sesión ──
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === servicio) return responder({ error: 'Iniciá sesión.' }, 401);
  const ru = await entorno.fetch(`${url}/auth/v1/user`, { headers: { apikey: servicio, Authorization: `Bearer ${token}` } });
  if (!ru.ok) return responder({ error: 'Sesión inválida' }, 401);
  const { id: uid } = (await ru.json()) as { id: string };

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return responder({ error: 'Pedido inválido' }, 400);
  }
  const accion = String(cuerpo.accion ?? '');

  if (accion === 'solicitar') {
    if (!esUuid(cuerpo.resena_id)) return responder({ error: 'Reseña inválida.' }, 400);
    const motivo = validarMotivo(cuerpo.motivo);
    if (!motivo.ok) return responder({ error: motivo.error }, 400);

    const resena = ((await rest(`resenas?select=id,comercio_id,nombre_usuario,comentario,eliminada_at&id=eq.${cuerpo.resena_id}`)) ?? [])[0] as
      | { id: string; comercio_id: string; nombre_usuario: string | null; comentario: string | null; eliminada_at: string | null }
      | undefined;
    if (!resena || resena.eliminada_at) return responder({ error: 'No encontramos esa reseña.' }, 404);
    const comercio = ((await rest(`comercios?select=id,propietario_id&id=eq.${resena.comercio_id}`)) ?? [])[0] as { propietario_id?: string } | undefined;
    if (!comercio || comercio.propietario_id !== uid) return responder({ error: 'Solo podés pedir la eliminación de reseñas de tu comercio.' }, 403);

    const pendiente = ((await rest(`solicitudes_eliminacion_resena?select=id&resena_id=eq.${resena.id}&estado=eq.pendiente`)) ?? []) as unknown[];
    if (pendiente.length) return responder({ error: 'Ya hay un pedido pendiente para esta reseña.' }, 409);
    const desde = encodeURIComponent(new Date(ahora.getTime() - 24 * 3600_000).toISOString());
    const recientes = ((await rest(`solicitudes_eliminacion_resena?select=id&comercio_id=eq.${resena.comercio_id}&created_at=gte.${desde}`)) ?? []) as unknown[];
    const limite = Number.parseInt(entorno.leer('LIMITE_SOLICITUDES_RESENAS_POR_DIA') ?? '', 10) || LIMITE_SOLICITUDES_POR_DIA;
    if (recientes.length >= limite) return responder({ error: `Podés hacer hasta ${limite} pedidos por día. Probá mañana.` }, 429);

    const resumen = `${resena.nombre_usuario ?? 'Anónimo'}: ${resena.comentario ?? ''}`.slice(0, 300);
    let solicitud: Record<string, unknown>;
    try {
      solicitud = ((await rest('solicitudes_eliminacion_resena', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ resena_id: resena.id, comercio_id: resena.comercio_id, solicitado_por: uid, motivo: motivo.motivo, resena_resumen: resumen, estado: 'pendiente' }),
      })) ?? [])[0];
    } catch (e) {
      // Dos pedidos a la vez: el índice único de pendientes deja pasar uno solo
      if ((e as { status?: number }).status === 409) return responder({ error: 'Ya hay un pedido pendiente para esta reseña.' }, 409);
      throw e;
    }
    await auditar({ solicitud_id: solicitud.id, resena_id: resena.id, accion: 'solicitada', actor: uid, detalle: { motivo: motivo.motivo } });
    entorno.log({ evento: 'eliminacion_resena_solicitada', solicitud: solicitud.id, resena: resena.id, comercio: resena.comercio_id });
    return responder({ ok: true, solicitud });
  }

  if (accion === 'resolver') {
    const perfil = ((await rest(`profiles?select=rol&id=eq.${encodeURIComponent(uid)}`)) ?? [])[0] as { rol?: string } | undefined;
    if (perfil?.rol !== 'admin') return responder({ error: 'Solo un administrador puede aprobar o rechazar.' }, 403);
    if (!esUuid(cuerpo.solicitud_id) || typeof cuerpo.aprobar !== 'boolean') return responder({ error: 'Pedido inválido.' }, 400);
    const nota = validarNota(cuerpo.nota);
    if (!nota.ok) return responder({ error: nota.error }, 400);

    const momento = ahora.toISOString();
    const estado = cuerpo.aprobar ? 'aprobada' : 'rechazada';
    // Solo pasa de "pendiente" una vez (si dos admins resuelven a la vez, gana uno)
    const resuelta = ((await rest(`solicitudes_eliminacion_resena?id=eq.${cuerpo.solicitud_id}&estado=eq.pendiente`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ estado, nota_admin: nota.nota, resuelta_por: uid, resuelta_at: momento }),
    })) ?? [])[0] as { id: string; resena_id: string } | undefined;
    if (!resuelta) {
      const existe = ((await rest(`solicitudes_eliminacion_resena?select=id&id=eq.${cuerpo.solicitud_id}`)) ?? []) as unknown[];
      return existe.length ? responder({ error: 'Ese pedido ya estaba resuelto.' }, 409) : responder({ error: 'No encontramos ese pedido.' }, 404);
    }
    if (cuerpo.aprobar) {
      await rest(`resenas?id=eq.${resuelta.resena_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ eliminada_at: momento, eliminada_por: uid }) });
    }
    await auditar({ solicitud_id: resuelta.id, resena_id: resuelta.resena_id, accion: estado, actor: uid, detalle: nota.nota ? { nota: nota.nota } : null });
    entorno.log({ evento: 'eliminacion_resena_resuelta', solicitud: resuelta.id, estado, admin: uid });
    return responder({ ok: true, estado });
  }

  return responder({ error: `Acción desconocida: ${accion}` }, 400);
}

// En Supabase (Deno); en las pruebas (Node) se usa manejar().
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
      return responder({ error: 'No se pudo procesar el pedido. Probá de nuevo.' }, 500);
    }),
  );
}
