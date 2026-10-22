// supabase/functions/notificar-promociones/logica.ts
//
// Reglas de las notificaciones de publicaciones nuevas (sin dependencias de
// Deno: se prueban con Node en tests/notificarPromociones.test.ts).
//
// REGLA (documentada también en el informe):
//  1. Se avisa UNA vez por publicación (oferta o novedad). La columna
//     promociones.notificada_at lo marca: editarla o volver a correr la
//     función no la vuelve a mandar.
//  2. Solo si está aprobada, vigente HOY (hora de Argentina, entre su fecha de
//     inicio y su fecha de fin) y el comercio es público (aprobado, habilitado
//     y con suscripción activa).
//  3. Si empieza en una fecha futura, se avisa ese día (la toma el cron).
//  4. Si pasaron más de 72 h desde que se publicó o empezó y nunca se avisó
//     (por ejemplo, el comercio estaba oculto), ya no se avisa.
//  5. Límite anti-spam: 1 aviso por comercio por día y 10 en total por día
//     (configurables). Las que superan el límite se publican igual, sin aviso.
//  6. Le llega a todos los dispositivos suscriptos con "Recibir Ofertas".

export interface Promocion {
  id: string;
  comercio_id: string;
  titulo: string;
  descripcion?: string | null;
  tipo?: string | null;
  precio_anterior?: number | string | null;
  precio_promocional?: number | string | null;
  fecha_inicio: string;
  fecha_fin: string;
  aprobada?: boolean | null;
  created_at?: string | null;
  notificada_at?: string | null;
}

export interface ComercioAviso {
  id: string;
  nombre: string;
  slug: string;
}

export interface Limites {
  porComercioPorDia: number;
  totalPorDia: number;
  antiguedadMaximaHoras: number;
}

export const LIMITES_POR_DEFECTO: Limites = { porComercioPorDia: 1, totalPorDia: 10, antiguedadMaximaHoras: 72 };

export function limitesDesdeEntorno(leer: (nombre: string) => string | undefined): Limites {
  const entero = (nombre: string, porDefecto: number) => {
    const n = Number.parseInt(leer(nombre) ?? '', 10);
    return Number.isFinite(n) && n >= 0 ? n : porDefecto;
  };
  return {
    porComercioPorDia: entero('LIMITE_DIARIO_POR_COMERCIO', LIMITES_POR_DEFECTO.porComercioPorDia),
    totalPorDia: entero('LIMITE_DIARIO_TOTAL', LIMITES_POR_DEFECTO.totalPorDia),
    antiguedadMaximaHoras: entero('ANTIGUEDAD_MAXIMA_HORAS', LIMITES_POR_DEFECTO.antiguedadMaximaHoras),
  };
}

/** YYYY-MM-DD en Argentina */
export function fechaArgentina(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(momento);
}

/** Inicio del día de hoy en Argentina, como ISO UTC (Argentina es UTC-3 todo el año). */
export function inicioDelDiaArgentina(momento: Date): string {
  return new Date(`${fechaArgentina(momento)}T00:00:00-03:00`).toISOString();
}

/** Día (Argentina) de una fecha guardada como "YYYY-MM-DD" o como timestamp. */
function diaDe(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor) || /^\d{4}-\d{2}-\d{2}[T ]00:00:00(\.0+)?(Z|\+00(:?00)?)$/.test(valor)) return valor.slice(0, 10);
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? valor.slice(0, 10) : fechaArgentina(d);
}

/** Momento desde el que cuenta la antigüedad: lo último entre publicada y empieza. */
function momentoDePublicacion(p: Promocion): number {
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_inicio) ? new Date(`${p.fecha_inicio}T00:00:00-03:00`).getTime() : new Date(p.fecha_inicio).getTime();
  const creada = p.created_at ? new Date(p.created_at).getTime() : 0;
  return Math.max(Number.isNaN(inicio) ? 0 : inicio, Number.isNaN(creada) ? 0 : creada);
}

export type Decision =
  | { accion: 'enviar' }
  | { accion: 'esperar'; motivo: 'empieza_despues' | 'comercio_no_publico' }
  | { accion: 'omitir'; motivo: 'ya_notificada' | 'no_aprobada' | 'vencida' | 'vieja' | 'limite_comercio' | 'limite_total' };

export function decidir(
  p: Promocion,
  contexto: { ahora: Date; comercioPublico: boolean; enviadasHoyComercio: number; enviadasHoyTotal: number; limites?: Limites },
): Decision {
  const limites = contexto.limites ?? LIMITES_POR_DEFECTO;
  if (p.notificada_at) return { accion: 'omitir', motivo: 'ya_notificada' };
  if (p.aprobada === false) return { accion: 'omitir', motivo: 'no_aprobada' };
  const hoy = fechaArgentina(contexto.ahora);
  if (diaDe(p.fecha_fin) < hoy) return { accion: 'omitir', motivo: 'vencida' };
  if (diaDe(p.fecha_inicio) > hoy) return { accion: 'esperar', motivo: 'empieza_despues' };
  if (contexto.ahora.getTime() - momentoDePublicacion(p) > limites.antiguedadMaximaHoras * 3600_000) return { accion: 'omitir', motivo: 'vieja' };
  if (!contexto.comercioPublico) return { accion: 'esperar', motivo: 'comercio_no_publico' };
  if (contexto.enviadasHoyComercio >= limites.porComercioPorDia) return { accion: 'omitir', motivo: 'limite_comercio' };
  if (contexto.enviadasHoyTotal >= limites.totalPorDia) return { accion: 'omitir', motivo: 'limite_total' };
  return { accion: 'enviar' };
}

const recortar = (texto: string, max: number) => {
  // Espacios y saltos de línea comunes; el espacio duro de "$ 9.000" se respeta
  const limpio = texto.replace(/[ \t\r\n]+/g, ' ').trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1).trimEnd()}…`;
};

const pesos = (valor: number | string | null | undefined) => {
  const n = typeof valor === 'string' ? Number.parseFloat(valor) : valor;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n).replace(/\s/g, ' ');
};

export interface MensajePush {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Lo que muestra la notificación (el service worker usa title, body, url y tag). */
export function armarMensaje(p: Promocion, comercio: ComercioAviso): MensajePush {
  const esNovedad = p.tipo === 'novedad';
  const precio = pesos(p.precio_promocional);
  const antes = pesos(p.precio_anterior);
  const detalle = [p.titulo, precio ? (antes ? `${precio} (antes ${antes})` : precio) : null].filter(Boolean).join(' · ');
  return {
    title: recortar(`${esNovedad ? 'Novedad' : 'Nueva oferta'} en ${comercio.nombre}`, 80),
    body: recortar(detalle || (p.descripcion ?? ''), 160),
    url: `/comercio/${encodeURIComponent(comercio.slug)}#promociones`,
    tag: `promo-${p.id}`,
  };
}

export const MENSAJE_PRUEBA: MensajePush = {
  title: 'NOGOYORK: notificación de prueba',
  body: 'Si ves esto, las notificaciones funcionan en este dispositivo.',
  url: '/promociones',
  tag: 'prueba',
};

export type ResultadoEnvio = 'ok' | 'vencida' | 'reintentar' | 'claves' | 'demasiado_grande' | 'error';

/**
 * Respuesta del servicio push → qué hacer.
 *  201/202: entregado al servicio. 404/410: la suscripción ya no existe (se
 *  borra). 401/403: las claves VAPID no coinciden con las de la suscripción o
 *  el JWT es inválido. 413: mensaje demasiado grande. 429/5xx: probar más tarde.
 */
export function clasificarRespuesta(status: number): ResultadoEnvio {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || status === 410) return 'vencida';
  if (status === 401 || status === 403) return 'claves';
  if (status === 413) return 'demasiado_grande';
  if (status === 429 || status >= 500) return 'reintentar';
  return 'error';
}

export interface ResumenEnvio {
  destinatarios: number;
  enviadas: number;
  fallidas: number;
  borradas: number;
  porMotivo: Partial<Record<ResultadoEnvio, number>>;
}

export function resumir(resultados: ResultadoEnvio[], borradas: number): ResumenEnvio {
  const porMotivo: Partial<Record<ResultadoEnvio, number>> = {};
  for (const r of resultados) porMotivo[r] = (porMotivo[r] ?? 0) + 1;
  const enviadas = porMotivo.ok ?? 0;
  return { destinatarios: resultados.length, enviadas, fallidas: resultados.length - enviadas, borradas, porMotivo };
}

/** Corre `tarea` sobre la lista con a lo sumo `limite` a la vez, esperando todas. */
export async function enParalelo<T, R>(lista: T[], limite: number, tarea: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(lista.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      salida[i] = await tarea(lista[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, lista.length) }, trabajador));
  return salida;
}
