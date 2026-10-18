import { supabase } from '@/lib/supabase';
import { limitesDelRango } from '@/lib/fechasArgentina';
import { rangoAnterior, type RangoFechas } from '@/lib/rangosFechas';
import type { ValoresMetricas } from '@/lib/mensajeMetricas';

// ─── Qué se mide ──────────────────────────────────────────────────────────
// visita       Alguien abre la ficha del comercio (/comercio/:slug).
// whatsapp     Toca "WhatsApp" en la ficha o en una promoción.
// como_llegar  Toca "Cómo llegar" en la ficha o en el mapa.
// Un mismo visitante cuenta UNA vez por comercio y tipo cada 30 minutos
// (recargar la ficha no suma). No cuentan: bots, el dueño del comercio
// mirando su propia ficha, ni los administradores.
// Los días se cortan en hora de Argentina (00:00 a 23:59, UTC-3).

export type TipoInteraccion = 'visita' | 'whatsapp' | 'como_llegar';

export const VENTANA_SIN_REPETIR_MS = 30 * 60 * 1000;
const CLAVE_VISITANTE = 'nogomap:visitante';
const CLAVE_RECIENTES = 'nogomap:interacciones-recientes';

const PATRON_BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed/i;

/** ¿Lo que navega es un robot? (buscadores, vistas previas de links, pruebas automáticas) */
export function esBot(userAgent: string, webdriver = false): boolean {
  return webdriver || PATRON_BOT.test(userAgent);
}

type Recientes = Record<string, number>;

/**
 * ¿Hay que registrar esta interacción? Devuelve la decisión y el registro
 * actualizado (limpio de entradas viejas). Función pura para poder probarla.
 */
export function decidirRegistro(
  recientes: Recientes,
  comercioId: string,
  tipo: TipoInteraccion,
  ahora: number,
): { registrar: boolean; recientes: Recientes } {
  const vigentes: Recientes = {};
  for (const [clave, momento] of Object.entries(recientes)) {
    if (ahora - momento < VENTANA_SIN_REPETIR_MS) vigentes[clave] = momento;
  }
  const clave = `${comercioId}:${tipo}`;
  if (vigentes[clave] !== undefined) return { registrar: false, recientes: vigentes };
  return { registrar: true, recientes: { ...vigentes, [clave]: ahora } };
}

function leerAlmacen<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribirAlmacen(clave: string, valor: unknown) {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // navegación privada o almacenamiento lleno
  }
}

/** Identificador anónimo del navegador (no es un dato personal). */
export function idVisitante(): string {
  let id = leerAlmacen<string | null>(CLAVE_VISITANTE, null);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    escribirAlmacen(CLAVE_VISITANTE, id);
  }
  return id;
}

// Si la función registrar_interaccion todavía no existe en la base (ver
// supabase/propuestas/20261018_metricas.sql), se inserta directo como antes.
let rpcDisponible = true;

/** Registrar una interacción. Nunca tira error: una métrica perdida no rompe la página. */
export const registrarInteraccion = async (
  comercioId: string,
  tipo: TipoInteraccion,
  opciones: { excluir?: boolean } = {},
) => {
  try {
    if (opciones.excluir) return; // dueño del comercio o admin
    if (typeof navigator !== 'undefined' && esBot(navigator.userAgent, Boolean(navigator.webdriver))) return;

    const decision = decidirRegistro(leerAlmacen<Recientes>(CLAVE_RECIENTES, {}), comercioId, tipo, Date.now());
    escribirAlmacen(CLAVE_RECIENTES, decision.recientes);
    if (!decision.registrar) return;

    if (rpcDisponible) {
      const { error } = await supabase.rpc('registrar_interaccion', {
        p_comercio_id: comercioId,
        p_tipo: tipo,
        p_visitante: idVisitante(),
      });
      if (!error) return;
      // PGRST202: la función no existe (todavía no se corrió el SQL)
      if (error.code !== 'PGRST202' && error.code !== '42883') {
        console.error('[métricas] registrar_interaccion falló', error);
        return;
      }
      rpcDisponible = false;
    }

    const { error } = await supabase.from('metricas_interacciones').insert({
      comercio_id: comercioId,
      tipo_interaccion: tipo,
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[métricas] No se pudo registrar la interacción', error);
  } catch (e) {
    console.error('[métricas] Error al registrar la interacción:', e);
  }
};

// ─── Lectura ─────────────────────────────────────────────────────────────
// Se cuenta en la base (count exact, head) en vez de traer filas: PostgREST
// devuelve como máximo 1000 filas por consulta.

const contarInteracciones = async (tipo: TipoInteraccion, comercioId?: string, rango?: RangoFechas) => {
  let consulta = supabase
    .from('metricas_interacciones')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_interaccion', tipo);
  if (comercioId) consulta = consulta.eq('comercio_id', comercioId);
  if (rango) {
    const { desdeISO, hastaISO } = limitesDelRango(rango.desde, rango.hasta);
    consulta = consulta.gte('created_at', desdeISO).lt('created_at', hastaISO);
  }
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
};

const contarTodo = async (comercioId?: string, rango?: RangoFechas): Promise<ValoresMetricas> => {
  const [visitas, whatsapp, comoLlegar] = await Promise.all([
    contarInteracciones('visita', comercioId, rango),
    contarInteracciones('whatsapp', comercioId, rango),
    contarInteracciones('como_llegar', comercioId, rango),
  ]);
  return { visitas, whatsapp, comoLlegar };
};

/** Métricas de un comercio; sin rango, el total histórico. */
export const obtenerMetricasComercio = (comercioId: string, rango?: RangoFechas) => contarTodo(comercioId, rango);

/** Métricas de todos los comercios juntos (panel del admin). */
export const obtenerMetricasGlobales = (rango?: RangoFechas) => contarTodo(undefined, rango);

/** Métricas del período y del período anterior, para comparar. */
export async function obtenerMetricasConComparacion(comercioId: string | undefined, rango: RangoFechas) {
  const anteriorRango = rangoAnterior(rango);
  const [actual, anterior] = await Promise.all([contarTodo(comercioId, rango), contarTodo(comercioId, anteriorRango)]);
  return { actual, anterior, rango, rangoAnterior: anteriorRango };
}
