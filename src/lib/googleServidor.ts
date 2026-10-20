// src/lib/googleServidor.ts
//
// Lo que hace la función /api/google en el servidor (igual en Vercel y en
// Cloudflare Pages). La clave de Google vive SOLO acá, en la variable de
// entorno GOOGLE_PLACES_API_KEY: nunca llega al navegador ni al repositorio.
//
//  GET  /api/google?accion=resenas&slug=<slug>
//       Público. Busca en la base el place_id del comercio (el navegador no
//       elige qué lugar consultar: así nadie puede usar la clave para otra
//       cosa) y pide a Google puntaje + hasta 5 reseñas. Sin caché: los
//       términos de Google no permiten guardar ese contenido.
//  POST /api/google?accion=buscar  { texto?: string, placeId?: string }
//       Solo administradores (token de Supabase). Candidatos para vincular
//       un comercio con su ficha de Google.
//
// Protección de costos: límite por IP y por instancia (ver Limitador). El
// límite fuerte es la cuota diaria que se configura en Google Cloud
// (docs/google-places.md): esta función no puede garantizarlo sola porque
// Vercel/Cloudflare pueden correr varias instancias a la vez.

import {
  esPlaceId,
  urlEscribirResena,
  urlSegura,
  type CandidatoGoogle,
  type ResenaGoogle,
  type RespuestaResenasGoogle,
} from './resenasGoogle';

// Públicos (los mismos que usa el sitio): se pueden pisar con variables de entorno
const SUPABASE_URL_PUBLICA = 'https://graipurciaipsoonmtqk.supabase.co';
const SUPABASE_ANON_PUBLICA =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYWlwdXJjaWFpcHNvb25tdHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjI3MzQsImV4cCI6MjEwNzM5ODczNH0.reHxsRdjboBzIP71BNwzaClzG0XxAARiECRI4t1_ZFs';

const PLACES = 'https://places.googleapis.com/v1';
const CAMPOS_RESENAS = 'rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks';
const CAMPOS_CANDIDATO = 'id,displayName,formattedAddress,googleMapsUri';
const NOGOYA = { latitude: -32.3939, longitude: -59.7881 };

export interface Entorno {
  GOOGLE_PLACES_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /** Consultas de reseñas por instancia y por día (por defecto 300). */
  GOOGLE_LIMITE_DIARIO?: string;
}

// ─── Límite de consultas ─────────────────────────────────────────────────

export class Limitador {
  private ventanas = new Map<string, number[]>();
  private dia = '';
  private usadasHoy = 0;

  private reloj: () => number;

  constructor(reloj: () => number = Date.now) {
    this.reloj = reloj;
  }

  /** true si la clave todavía puede hacer otra consulta en la ventana. */
  permitir(clave: string, maximo: number, ventanaMs: number): boolean {
    const ahora = this.reloj();
    const recientes = (this.ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= maximo) {
      this.ventanas.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    this.ventanas.set(clave, recientes);
    if (this.ventanas.size > 5000) this.ventanas.clear(); // no crecer sin límite
    return true;
  }

  /** Tope diario por instancia (en hora UTC). */
  permitirHoy(maximo: number): boolean {
    const hoy = new Date(this.reloj()).toISOString().slice(0, 10);
    if (hoy !== this.dia) {
      this.dia = hoy;
      this.usadasHoy = 0;
    }
    if (this.usadasHoy >= maximo) return false;
    this.usadasHoy += 1;
    return true;
  }
}

const limitadorCompartido = new Limitador();

export const LIMITES = {
  resenasPorIp: { maximo: 12, ventanaMs: 60_000 },
  busquedasPorIp: { maximo: 20, ventanaMs: 60_000 },
};

// ─── Utilidades ───────────────────────────────────────────────────────────

const SIN_CACHE = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: SIN_CACHE });

export function ipDe(request: Request): string {
  const h = request.headers;
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    (h.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'desconocida'
  );
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

const texto = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Convierte una reseña de Google a lo que muestra NOGOMAP (solo campos conocidos, links validados). */
export function adaptarResena(r: Record<string, any>): ResenaGoogle | null {
  const estrellas = Number(r?.rating);
  if (!Number.isFinite(estrellas)) return null;
  const autor = r?.authorAttribution ?? {};
  const original = r?.originalText?.languageCode;
  const mostrado = r?.text?.languageCode;
  return {
    autor: texto(autor.displayName, 120) || 'Usuario de Google',
    autorUrl: urlSegura(autor.uri),
    autorFoto: urlSegura(autor.photoUri),
    estrellas: Math.min(5, Math.max(1, Math.round(estrellas))),
    texto: texto(r?.text?.text ?? r?.originalText?.text),
    traducida: !!original && !!mostrado && original !== mostrado,
    fecha: typeof r?.publishTime === 'string' ? r.publishTime : null,
    haceCuanto: texto(r?.relativePublishTimeDescription, 80) || null,
    url: urlSegura(r?.googleMapsUri),
    reportarUrl: urlSegura(r?.flagContentUri),
  };
}

export function adaptarLugar(lugar: Record<string, any>, placeId: string): RespuestaResenasGoogle {
  const puntaje = Number(lugar?.rating);
  const total = Number(lugar?.userRatingCount);
  const resenas = (Array.isArray(lugar?.reviews) ? lugar.reviews : [])
    .slice(0, 5)
    .map(adaptarResena)
    .filter((r: ResenaGoogle | null): r is ResenaGoogle => r !== null);
  const links = lugar?.googleMapsLinks ?? {};
  return {
    estado: 'ok',
    puntaje: Number.isFinite(puntaje) && puntaje > 0 ? puntaje : null,
    total: Number.isFinite(total) && total > 0 ? Math.round(total) : 0,
    resenas,
    links: {
      escribir: urlSegura(links.writeAReviewUri) ?? urlEscribirResena(placeId),
      verTodas: urlSegura(links.reviewsUri) ?? urlSegura(lugar?.googleMapsUri),
    },
  };
}

function adaptarCandidato(p: Record<string, any>): CandidatoGoogle | null {
  if (!esPlaceId(p?.id)) return null;
  return {
    placeId: p.id,
    nombre: texto(p?.displayName?.text, 200) || '(sin nombre)',
    direccion: texto(p?.formattedAddress, 300),
    url: urlSegura(p?.googleMapsUri),
  };
}

// ─── Servidor ─────────────────────────────────────────────────────────────

interface Dependencias {
  fetch?: typeof fetch;
  limitador?: Limitador;
}

export async function responderGoogle(request: Request, entorno: Entorno, deps: Dependencias = {}): Promise<Response> {
  const pedir = deps.fetch ?? fetch;
  const limitador = deps.limitador ?? limitadorCompartido;
  const url = new URL(request.url);
  const accion = url.searchParams.get('accion');
  const clave = entorno.GOOGLE_PLACES_API_KEY;
  const supabaseUrl = (entorno.SUPABASE_URL || SUPABASE_URL_PUBLICA).replace(/\/+$/, '');
  const anon = entorno.SUPABASE_ANON_KEY || SUPABASE_ANON_PUBLICA;
  const ip = ipDe(request);

  try {
    // ── Reseñas de un comercio (público)
    if (request.method === 'GET' && accion === 'resenas') {
      const slug = url.searchParams.get('slug') ?? '';
      if (!SLUG.test(slug)) return json({ estado: 'error', mensaje: 'Comercio inválido.' }, 400);
      if (!limitador.permitir(`r:${ip}`, LIMITES.resenasPorIp.maximo, LIMITES.resenasPorIp.ventanaMs)) {
        return json({ estado: 'error', mensaje: 'Demasiadas consultas. Probá en un minuto.' }, 429);
      }

      // place_id desde la base (solo comercios publicados)
      const r = await pedir(
        `${supabaseUrl}/rest/v1/comercios?select=google_place_id&slug=eq.${encodeURIComponent(slug)}&aprobado=eq.true&habilitado_admin=eq.true&limit=1`,
        { headers: { apikey: anon, Authorization: `Bearer ${anon}`, Accept: 'application/json' } },
      );
      if (!r.ok) {
        // Sin la columna (falta la migración) o la base no respondió: como "sin vincular"
        return json({ estado: 'sin_vincular' } satisfies RespuestaResenasGoogle);
      }
      const filas = (await r.json()) as Array<{ google_place_id?: string | null }>;
      const placeId = filas?.[0]?.google_place_id;
      if (!esPlaceId(placeId)) return json({ estado: 'sin_vincular' } satisfies RespuestaResenasGoogle);

      if (!clave) return json({ estado: 'error', mensaje: 'Reseñas de Google no configuradas.' }, 503);
      const limiteDiario = Number(entorno.GOOGLE_LIMITE_DIARIO) > 0 ? Number(entorno.GOOGLE_LIMITE_DIARIO) : 300;
      if (!limitador.permitirHoy(limiteDiario)) {
        return json({ estado: 'error', mensaje: 'Se alcanzó el límite diario de consultas a Google.' }, 429);
      }

      const g = await pedir(`${PLACES}/places/${encodeURIComponent(placeId)}?languageCode=es&regionCode=AR`, {
        headers: { 'X-Goog-Api-Key': clave, 'X-Goog-FieldMask': CAMPOS_RESENAS },
      });
      if (!g.ok) {
        console.error('[google] Place Details respondió', g.status);
        return json({ estado: 'error', mensaje: 'Google no respondió.' }, 502);
      }
      return json(adaptarLugar(await g.json(), placeId));
    }

    // ── Buscar candidatos (solo admin)
    if (request.method === 'POST' && accion === 'buscar') {
      if (!limitador.permitir(`b:${ip}`, LIMITES.busquedasPorIp.maximo, LIMITES.busquedasPorIp.ventanaMs)) {
        return json({ error: 'Demasiadas búsquedas. Probá en un minuto.' }, 429);
      }
      const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (!token || !(await esAdmin(pedir, supabaseUrl, anon, token))) return json({ error: 'No autorizado.' }, 401);
      if (!clave) return json({ error: 'Falta configurar GOOGLE_PLACES_API_KEY en el servidor.' }, 503);

      const cuerpo = (await request.json().catch(() => ({}))) as { texto?: unknown; placeId?: unknown };
      if (esPlaceId(cuerpo.placeId)) {
        const g = await pedir(`${PLACES}/places/${encodeURIComponent(cuerpo.placeId)}?languageCode=es`, {
          headers: { 'X-Goog-Api-Key': clave, 'X-Goog-FieldMask': CAMPOS_CANDIDATO },
        });
        if (g.status === 404 || g.status === 400) return json({ candidatos: [] });
        if (!g.ok) return json({ error: 'Google no respondió.' }, 502);
        const c = adaptarCandidato(await g.json());
        return json({ candidatos: c ? [c] : [] });
      }

      const consulta = texto(cuerpo.texto, 200).trim();
      if (consulta.length < 3) return json({ error: 'Escribí al menos el nombre del comercio.' }, 400);
      const g = await pedir(`${PLACES}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': clave,
          'X-Goog-FieldMask': CAMPOS_CANDIDATO.split(',').map((c) => `places.${c}`).join(','),
        },
        body: JSON.stringify({
          textQuery: consulta,
          languageCode: 'es',
          regionCode: 'AR',
          pageSize: 5,
          locationBias: { circle: { center: NOGOYA, radius: 30000 } },
        }),
      });
      if (!g.ok) return json({ error: 'Google no respondió.' }, 502);
      const datos = (await g.json()) as { places?: unknown[] };
      const candidatos = (datos.places ?? [])
        .map((p) => adaptarCandidato(p as Record<string, any>))
        .filter((c): c is CandidatoGoogle => c !== null);
      return json({ candidatos });
    }

    return json({ error: 'Acción no válida.' }, 404);
  } catch (error) {
    console.error('[google]', error);
    return json({ estado: 'error', mensaje: 'Error al consultar Google.' }, 502);
  }
}

/** ¿El token de Supabase es de un administrador? (perfil con rol 'admin'). */
async function esAdmin(pedir: typeof fetch, supabaseUrl: string, anon: string, token: string): Promise<boolean> {
  const usuario = await pedir(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!usuario.ok) return false;
  const { id } = (await usuario.json()) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const perfil = await pedir(`${supabaseUrl}/rest/v1/profiles?select=rol&id=eq.${id}`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!perfil.ok) return false;
  const filas = (await perfil.json()) as Array<{ rol?: string }>;
  return filas?.[0]?.rol === 'admin';
}
