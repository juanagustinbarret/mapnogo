// src/lib/resenasGoogle.ts
//
// Reseñas de Google (Places API New) en NOGOMAP: tipos y textos que usan el
// navegador y la función del servidor (src/lib/googleServidor.ts).
//
// Reglas de Google que condicionan el diseño (ver docs/google-places.md):
//  - Solo se puede guardar el place_id. El puntaje y las reseñas no se pueden
//    guardar ni cachear: se piden cada vez que alguien toca "Ver reseñas".
//  - El contenido de Places no se puede mostrar junto a un mapa que no sea de
//    Google (el de NOGOMAP es OpenStreetMap): por eso el popup del mapa usa
//    el puntaje de las reseñas propias de NOGOMAP, nunca el de Google.
//  - Hay que mostrar la atribución "Google Maps", el autor de cada reseña y
//    cómo están ordenadas.

import { formatearFecha } from './fechasArgentina';

export interface ResenaGoogle {
  autor: string;
  autorUrl: string | null;
  autorFoto: string | null;
  estrellas: number;
  texto: string;
  traducida: boolean;
  fecha: string | null; // ISO
  haceCuanto: string | null;
  url: string | null;
  reportarUrl: string | null;
}

export type RespuestaResenasGoogle =
  | {
      estado: 'ok';
      puntaje: number | null;
      total: number;
      resenas: ResenaGoogle[];
      links: { escribir: string; verTodas: string | null };
    }
  | { estado: 'sin_vincular' }
  | { estado: 'error'; mensaje: string };

export interface CandidatoGoogle {
  placeId: string;
  nombre: string;
  direccion: string;
  url: string | null;
}

export type EstadoGoogle = 'no_vinculado' | 'vinculado' | 'sin_ficha';

export const ESTADOS_GOOGLE: Record<EstadoGoogle, { texto: string; clase: string }> = {
  no_vinculado: { texto: 'No vinculado', clase: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  vinculado: { texto: 'Vinculado', clase: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
  sin_ficha: { texto: 'Sin ficha en Google (pendiente de crear)', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
};

/** Estado de un comercio a partir de sus columnas (sirve aunque falte google_estado). */
export function estadoGoogle(c: { google_place_id?: string | null; google_estado?: string | null }): EstadoGoogle {
  if (c.google_place_id) return 'vinculado';
  return c.google_estado === 'sin_ficha' ? 'sin_ficha' : 'no_vinculado';
}

// ─── Puntaje ───────────────────────────────────────────────────────────────

/** 4.56 → "4,6"; null si no hay puntaje válido. */
export function formatearPuntaje(puntaje: number | null | undefined): string | null {
  if (puntaje == null || !Number.isFinite(puntaje) || puntaje <= 0) return null;
  const acotado = Math.min(5, Math.max(1, puntaje));
  return (Math.round(acotado * 10) / 10).toFixed(1).replace('.', ',');
}

/** Estrellas llenas (redondeo al entero más cercano) para dibujar ★★★★☆. */
export function estrellasLlenas(puntaje: number | null | undefined): number {
  if (puntaje == null || !Number.isFinite(puntaje)) return 0;
  return Math.min(5, Math.max(0, Math.round(puntaje)));
}

export const textoEstrellas = (puntaje: number | null | undefined) =>
  '★'.repeat(estrellasLlenas(puntaje)) + '☆'.repeat(5 - estrellasLlenas(puntaje));

const miles = (n: number) => new Intl.NumberFormat('es-AR').format(n);

/** "4,6 (123)"; null si no hay reseñas. */
export function textoPuntaje(puntaje: number | null | undefined, total: number | null | undefined): string | null {
  const p = formatearPuntaje(puntaje);
  if (!p || !total || total <= 0) return null;
  return `${p} (${miles(total)})`;
}

/** Para lectores de pantalla: "4,6 de 5 estrellas, 123 reseñas". */
export function etiquetaPuntaje(puntaje: number | null | undefined, total: number | null | undefined): string {
  const p = formatearPuntaje(puntaje);
  if (!p || !total || total <= 0) return 'Sin reseñas todavía';
  return `${p} de 5 estrellas, ${miles(total)} ${total === 1 ? 'reseña' : 'reseñas'}`;
}

/** Fecha de una reseña en formato argentino; '' si no se entiende. */
export const fechaResena = (iso: string | null | undefined) => formatearFecha(iso ?? '');

// ─── Links seguros ─────────────────────────────────────────────────────────

const DOMINIOS_GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(google\.com|google\.com\.ar|googleusercontent\.com|goo\.gl|g\.co)(\/|$)/i;

/** Solo links https de Google (el contenido de terceros no es confiable). */
export function urlSegura(url: unknown): string | null {
  return typeof url === 'string' && DOMINIOS_GOOGLE.test(url) ? url : null;
}

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
export const esPlaceId = (texto: unknown): texto is string => typeof texto === 'string' && PLACE_ID.test(texto);

/** Link para escribir una reseña cuando Google no manda writeAReviewUri. */
export const urlEscribirResena = (placeId: string) =>
  `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;

/**
 * Lo que pega el admin: un place_id, o un link de Google Maps que lo traiga
 * (place_id:..., query_place_id=..., placeid=...). Si es un link sin place_id
 * (lo más común en links compartidos), devuelve el nombre del lugar para
 * buscarlo. Los links cortos (maps.app.goo.gl) no se pueden leer sin abrirlos.
 */
export function interpretarFichaPegada(texto: string): { placeId: string } | { busqueda: string } | { error: string } {
  const limpio = texto.trim();
  if (!limpio) return { error: 'Pegá un link de Google Maps o un place_id.' };
  if (/^ChIJ[A-Za-z0-9_-]+$/.test(limpio) || (esPlaceId(limpio) && !/[./:]/.test(limpio) && limpio.length > 20)) {
    return { placeId: limpio };
  }
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return { busqueda: limpio };
  }
  const desdeParametros =
    url.searchParams.get('query_place_id') || url.searchParams.get('placeid') || url.searchParams.get('place_id');
  if (desdeParametros && esPlaceId(desdeParametros)) return { placeId: desdeParametros };
  const enQuery = /place_id:([A-Za-z0-9_-]+)/.exec(decodeURIComponent(url.search));
  if (enQuery && esPlaceId(enQuery[1])) return { placeId: enQuery[1] };
  if (/goo\.gl$|app\.goo\.gl$/.test(url.hostname)) {
    return { error: 'Los links cortos (maps.app.goo.gl) no traen el lugar. Abrilo, copiá el link largo de la barra o buscá por nombre.' };
  }
  const nombre = /\/maps\/place\/([^/]+)/.exec(url.pathname);
  if (nombre) return { busqueda: decodeURIComponent(nombre[1].replace(/\+/g, ' ')) };
  return { error: 'No encontré el lugar en ese link. Buscalo por nombre y dirección.' };
}

// ─── Crear la ficha en Google (lo hace el dueño) ───────────────────────────

export const URL_CREAR_FICHA = 'https://business.google.com/create';

export interface DatosParaFicha {
  nombre: string;
  direccion: string;
  telefono?: string | null;
  rubro?: string | null;
  horarios?: string | null;
}

/** Datos listos para copiar al crear la ficha en Google Business Profile. */
export function textoParaCrearFicha(d: DatosParaFicha): string {
  return [
    `Nombre: ${d.nombre}`,
    `Categoría: ${d.rubro || '(elegir la más parecida)'}`,
    `Dirección: ${d.direccion}, Nogoyá, Entre Ríos, Argentina`,
    d.telefono ? `Teléfono: ${d.telefono}` : '',
    d.horarios ? `Horarios:\n${d.horarios}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const PASOS_CREAR_FICHA = [
  'El dueño entra a business.google.com/create con SU cuenta de Google.',
  'Busca el nombre del negocio: si aparece, lo reclama ("Reclamar este negocio") en vez de crear otro.',
  'Si no aparece, lo crea con los datos de abajo (copiar y pegar).',
  'Google le pide verificar que es el dueño (video, llamada o postal). Solo el dueño puede hacerlo.',
  'Cuando la ficha esté publicada, avisanos y la vinculamos en NOGOMAP.',
];

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Horarios de NOGOMAP (dia_semana 0 = lunes) en texto para copiar a Google. */
export function textoHorariosParaFicha(
  horarios: Array<{ dia_semana: number; hora_apertura: string; hora_cierre: string; activo?: boolean | null }>,
): string {
  return DIAS.map((dia, i) => {
    const turnos = horarios
      .filter((h) => h.dia_semana === i && h.activo !== false)
      .map((h) => `${h.hora_apertura.slice(0, 5)} a ${h.hora_cierre.slice(0, 5)}`);
    return `${dia}: ${turnos.length ? turnos.join(' y ') : 'Cerrado'}`;
  }).join('\n');
}
