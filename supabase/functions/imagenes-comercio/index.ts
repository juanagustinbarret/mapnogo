// supabase/functions/imagenes-comercio/index.ts
//
// Fotos de los comercios con moderación por capas:
//   1. Validación en el servidor: tipo real (firma), peso, medidas y limpieza
//      de metadatos y contenido pegado (../_shared/imagenes.ts).
//   2. Moderación automática ANTES de publicar (../_shared/moderacion.ts).
//   3. Estado: "aprobada" se ve en la ficha; "pendiente" espera a un admin;
//      "rechazada" (claramente explícita) no se guarda.
//   4. "Reportar" desde la ficha y cola de revisión en el admin.
//   5. Límites: subidas por usuario por hora, fotos por comercio y reportes
//      por conexión y por comercio por hora.
//
// Acciones (POST JSON {accion, ...}):
//   subir      { comercio_id, imagen }  dueño del comercio o admin
//   borrar     { foto_id }              dueño o admin
//   revisar    { foto_id, estado }      admin (aprobada | rechazada)
//   reportar   { comercio_id, foto_id? | indice_galeria?, motivo, detalle? }  cualquiera
//   resolver_reporte { reporte_id, estado }  admin (resuelto | descartado)
//
// Secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los pone Supabase).
// Opcionales: MODERACION_PROVEEDOR (openai | google), OPENAI_API_KEY,
// GOOGLE_VISION_API_KEY, LIMITE_SUBIDAS_POR_HORA (20), MAX_FOTOS_POR_COMERCIO
// (6), LIMITE_REPORTES_POR_HORA (5), LIMITE_REPORTES_POR_COMERCIO_HORA (10),
// IMAGEN_MAX_BYTES (3000000), REPORTES_SAL.

import { EXTENSION, MIME, REGLAS_POR_DEFECTO, validarImagen } from '../_shared/imagenes.ts';
import { moderarImagen } from '../_shared/moderacion.ts';
import { conCors, origenesPermitidos } from '../_shared/cors.ts';

export interface Entorno {
  leer: (nombre: string) => string | undefined;
  fetch: typeof fetch;
  ahora: () => Date;
  log: (evento: Record<string, unknown>) => void;
  nuevoId?: () => string;
}

export const BUCKET = 'fotos-comercios';
export const MOTIVOS_REPORTE = ['sexual', 'violencia', 'enganosa', 'otro'] as const;

// Access-Control-Allow-Origin lo agrega conCors según el origen del pedido.
const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const entero = (v: string | undefined, porDefecto: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

function desdeBase64(texto: string): Uint8Array {
  const limpio = texto.includes(',') ? texto.slice(texto.indexOf(',') + 1) : texto;
  const bin = atob(limpio);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

async function sha256Hex(texto: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function manejar(req: Request, entorno: Entorno): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Usá POST' }, 405);

  const url = entorno.leer('SUPABASE_URL');
  const servicio = entorno.leer('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servicio) return responder({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }, 500);
  const ahora = entorno.ahora();
  const haceUnaHora = encodeURIComponent(new Date(ahora.getTime() - 3600_000).toISOString());
  const nuevoId = entorno.nuevoId ?? (() => crypto.randomUUID());

  const pedirBase = async (ruta: string, init: RequestInit = {}) => {
    const r = await entorno.fetch(`${url}${ruta}`, {
      ...init,
      headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, ...(init.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${ruta.split('?')[0]} → ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  };
  const rest = (ruta: string, init: RequestInit = {}) =>
    pedirBase(`/rest/v1/${ruta}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return responder({ error: 'Pedido inválido' }, 400);
  }
  const accion = String(cuerpo.accion ?? '');

  // ── Reportar: no necesita cuenta ──
  if (accion === 'reportar') {
    const comercioId = String(cuerpo.comercio_id ?? '');
    const fotoId = cuerpo.foto_id ? String(cuerpo.foto_id) : null;
    const indice = cuerpo.indice_galeria === undefined || cuerpo.indice_galeria === null ? null : Number(cuerpo.indice_galeria);
    const motivo = String(cuerpo.motivo ?? '');
    const detalle = String(cuerpo.detalle ?? '').trim().slice(0, 500);
    if (!/^[0-9a-f-]{36}$/i.test(comercioId) || (!fotoId && (indice === null || !Number.isInteger(indice) || indice < 0 || indice > 50))) {
      return responder({ error: 'Falta indicar qué foto querés reportar.' }, 400);
    }
    if (fotoId && !/^[0-9a-f-]{36}$/i.test(fotoId)) return responder({ error: 'Foto inválida.' }, 400);
    if (!(MOTIVOS_REPORTE as readonly string[]).includes(motivo)) return responder({ error: 'Elegí un motivo.' }, 400);
    if (fotoId && !((await rest(`fotos_comercio?select=id&id=eq.${fotoId}&comercio_id=eq.${comercioId}`)) ?? []).length) {
      return responder({ error: 'Esa foto no existe.' }, 404);
    }
    const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '').trim();
    // Sin IP no se saltea el tope: todos los pedidos sin IP comparten una huella.
    const huella = await sha256Hex(`${ip || 'sin-ip'}|${entorno.leer('REPORTES_SAL') ?? servicio}`);
    const recientes = ((await rest(`reportes_contenido?select=id,foto_id,indice_galeria,comercio_id&ip_hash=eq.${huella}&created_at=gte.${haceUnaHora}`)) ?? []) as { foto_id: string | null; indice_galeria: number | null; comercio_id: string }[];
    if (recientes.some((r) => r.comercio_id === comercioId && (fotoId ? r.foto_id === fotoId : r.indice_galeria === indice))) {
      return responder({ ok: true, mensaje: 'Ya habías reportado esta foto. Gracias.' });
    }
    if (recientes.length >= entero(entorno.leer('LIMITE_REPORTES_POR_HORA'), 5)) {
      return responder({ error: 'Hiciste muchos reportes seguidos. Probá más tarde.' }, 429);
    }
    // Tope por comercio que no depende de la IP: cambiar de IP no sirve para llenarlo de reportes.
    const delComercio = ((await rest(`reportes_contenido?select=id&comercio_id=eq.${comercioId}&created_at=gte.${haceUnaHora}`)) ?? []) as unknown[];
    if (delComercio.length >= entero(entorno.leer('LIMITE_REPORTES_POR_COMERCIO_HORA'), 10)) {
      entorno.log({ evento: 'reporte_descartado_tope_comercio', comercio: comercioId });
      return responder({ ok: true, mensaje: 'Ya recibimos varios reportes de este comercio. Un administrador lo está revisando.' });
    }
    await rest('reportes_contenido', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ comercio_id: comercioId, foto_id: fotoId, indice_galeria: fotoId ? null : indice, motivo, detalle: detalle || null, ip_hash: huella, estado: 'abierto' }),
    });
    entorno.log({ evento: 'foto_reportada', comercio: comercioId, foto: fotoId, indice, motivo });
    return responder({ ok: true, mensaje: 'Gracias. Un administrador lo va a revisar.' });
  }

  // ── El resto necesita sesión ──
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === servicio) return responder({ error: 'Iniciá sesión.' }, 401);
  const ru = await entorno.fetch(`${url}/auth/v1/user`, { headers: { apikey: servicio, Authorization: `Bearer ${token}` } });
  if (!ru.ok) return responder({ error: 'Sesión inválida' }, 401);
  const { id: uid } = (await ru.json()) as { id: string };
  const perfil = ((await rest(`profiles?select=rol&id=eq.${encodeURIComponent(uid)}`)) ?? [])[0] as { rol?: string } | undefined;
  const esAdmin = perfil?.rol === 'admin';

  const comercioPropio = async (comercioId: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(comercioId)) return false;
    const c = ((await rest(`comercios?select=id,propietario_id&id=eq.${comercioId}`)) ?? [])[0] as { propietario_id?: string } | undefined;
    return !!c && (esAdmin || c.propietario_id === uid);
  };
  const borrarArchivo = async (ruta: string | null) => {
    if (!ruta) return;
    await pedirBase(`/storage/v1/object/${BUCKET}/${ruta}`, { method: 'DELETE' }).catch((e) => entorno.log({ evento: 'no_se_pudo_borrar_archivo', ruta, error: String(e) }));
  };

  if (accion === 'subir') {
    const comercioId = String(cuerpo.comercio_id ?? '');
    if (!(await comercioPropio(comercioId))) return responder({ error: 'No podés subir fotos a este comercio.' }, 403);

    const porHora = ((await rest(`fotos_comercio?select=id&subida_por=eq.${uid}&created_at=gte.${haceUnaHora}`)) ?? []) as unknown[];
    const limiteHora = entero(entorno.leer('LIMITE_SUBIDAS_POR_HORA'), 20);
    if (porHora.length >= limiteHora) return responder({ error: `Llegaste al límite de ${limiteHora} fotos por hora. Probá más tarde.` }, 429);

    const vigentes = ((await rest(`fotos_comercio?select=id&comercio_id=eq.${comercioId}&estado=in.(pendiente,aprobada)`)) ?? []) as unknown[];
    const maxFotos = entero(entorno.leer('MAX_FOTOS_POR_COMERCIO'), 6);
    if (vigentes.length >= maxFotos) return responder({ error: `Podés tener hasta ${maxFotos} fotos. Borrá alguna para subir otra.` }, 409);

    const maxBytes = entero(entorno.leer('IMAGEN_MAX_BYTES'), REGLAS_POR_DEFECTO.maxBytes);
    const textoImagen = String(cuerpo.imagen ?? '');
    if (textoImagen.length > Math.ceil(maxBytes * 1.4) + 100) return responder({ error: `La imagen pesa más de ${Math.round(maxBytes / 1_000_000)} MB.`, codigo: 'muy_pesada' }, 413);
    let bytes: Uint8Array;
    try {
      bytes = desdeBase64(textoImagen);
    } catch {
      return responder({ error: 'No se pudo leer la imagen.', codigo: 'dañada' }, 400);
    }

    const v = validarImagen(bytes, { ...REGLAS_POR_DEFECTO, maxBytes });
    if (!v.ok) {
      entorno.log({ evento: 'imagen_invalida', comercio: comercioId, codigo: v.codigo });
      return responder({ error: v.mensaje, codigo: v.codigo }, 422);
    }

    const veredicto = await moderarImagen(v.bytes, MIME[v.tipo], {
      proveedor: entorno.leer('MODERACION_PROVEEDOR'),
      openaiKey: entorno.leer('OPENAI_API_KEY'),
      googleKey: entorno.leer('GOOGLE_VISION_API_KEY'),
      fetch: entorno.fetch,
    });
    const id = nuevoId();
    const base = { id, comercio_id: comercioId, subida_por: uid, ancho: v.ancho, alto: v.alto, bytes: v.bytes.length, moderacion: veredicto };
    entorno.log({ evento: 'imagen_moderada', comercio: comercioId, foto: id, estado: veredicto.estado, proveedor: veredicto.proveedor, motivo: veredicto.motivo });

    if (veredicto.estado === 'rechazada') {
      // No se guarda la imagen; queda el registro (cuenta para el límite por hora)
      await rest('fotos_comercio', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...base, estado: 'rechazada', motivo: `automatica:${veredicto.motivo}`, ruta: null, url: null }) });
      return responder({ error: 'Esta imagen no se puede publicar porque parece tener contenido explícito. Si creés que es un error, escribile al administrador.', codigo: 'rechazada' }, 422);
    }

    const ruta = `${comercioId}/${id}.${EXTENSION[v.tipo]}`;
    await pedirBase(`/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': MIME[v.tipo], 'x-upsert': 'false', 'cache-control': '31536000' },
      body: v.bytes as BodyInit,
    });
    const filas = (await rest('fotos_comercio', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...base, estado: veredicto.estado, motivo: veredicto.estado === 'pendiente' ? `revision:${veredicto.motivo}` : null, ruta, url: `${url}/storage/v1/object/public/${BUCKET}/${ruta}` }),
    })) as unknown[];
    return responder(
      {
        foto: filas?.[0] ?? null,
        mensaje: veredicto.estado === 'aprobada' ? 'Foto publicada.' : 'Tu foto quedó en revisión: se va a ver en tu ficha cuando la apruebe un administrador.',
      },
      201,
    );
  }

  if (accion === 'borrar') {
    const fotoId = String(cuerpo.foto_id ?? '');
    const foto = ((await rest(`fotos_comercio?select=id,comercio_id,ruta&id=eq.${encodeURIComponent(fotoId)}`)) ?? [])[0] as { comercio_id: string; ruta: string | null } | undefined;
    if (!foto || !(await comercioPropio(foto.comercio_id))) return responder({ error: 'No encontramos esa foto.' }, 404);
    await borrarArchivo(foto.ruta);
    await rest(`fotos_comercio?id=eq.${encodeURIComponent(fotoId)}`, { method: 'DELETE' });
    return responder({ ok: true });
  }

  if (accion === 'revisar' || accion === 'resolver_reporte') {
    if (!esAdmin) return responder({ error: 'Solo un administrador puede revisar.' }, 403);
    const momento = ahora.toISOString();
    if (accion === 'resolver_reporte') {
      const estado = String(cuerpo.estado ?? '');
      if (!['resuelto', 'descartado'].includes(estado)) return responder({ error: 'Estado inválido' }, 400);
      await rest(`reportes_contenido?id=eq.${encodeURIComponent(String(cuerpo.reporte_id ?? ''))}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado, resuelto_por: uid, resuelto_at: momento }) });
      return responder({ ok: true });
    }
    const estado = String(cuerpo.estado ?? '');
    if (!['aprobada', 'rechazada'].includes(estado)) return responder({ error: 'Estado inválido' }, 400);
    const fotoId = String(cuerpo.foto_id ?? '');
    const foto = ((await rest(`fotos_comercio?select=id,ruta&id=eq.${encodeURIComponent(fotoId)}`)) ?? [])[0] as { ruta: string | null } | undefined;
    if (!foto) return responder({ error: 'No encontramos esa foto.' }, 404);
    const cambios: Record<string, unknown> = { estado, revisada_por: uid, revisada_at: momento, motivo: estado === 'rechazada' ? `admin:${String(cuerpo.motivo ?? 'rechazada').slice(0, 100)}` : null };
    if (estado === 'rechazada') {
      await borrarArchivo(foto.ruta);
      Object.assign(cambios, { ruta: null, url: null });
    }
    await rest(`fotos_comercio?id=eq.${encodeURIComponent(fotoId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(cambios) });
    await rest(`reportes_contenido?foto_id=eq.${encodeURIComponent(fotoId)}&estado=eq.abierto`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'resuelto', resuelto_por: uid, resuelto_at: momento }) });
    entorno.log({ evento: 'foto_revisada', foto: fotoId, estado, admin: uid });
    return responder({ ok: true });
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
      return responder({ error: 'No se pudo procesar la imagen. Probá de nuevo.' }, 500);
    }).then((res) => conCors(req, res, origenesPermitidos(deno.env.get('ORIGENES_PERMITIDOS')))),
  );
}
