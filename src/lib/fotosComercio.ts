// src/lib/fotosComercio.ts
//
// Fotos de los comercios con moderación. Las sube, borra y revisa la Edge
// Function imagenes-comercio (supabase/functions/imagenes-comercio): el
// navegador no puede escribir el almacenamiento ni la tabla fotos_comercio.
// El navegador solo achica y recodifica la foto antes de mandarla (eso ya le
// saca los metadatos), pero la barrera real es el servidor.

import { supabase } from './supabase';

export const FUNCION_IMAGENES = 'imagenes-comercio';

export type EstadoFoto = 'pendiente' | 'aprobada' | 'rechazada';

export interface FotoComercio {
  id: string;
  comercio_id: string;
  estado: EstadoFoto;
  motivo: string | null;
  url: string | null;
  ancho: number | null;
  alto: number | null;
  created_at: string;
}

export const COLUMNAS_FOTO = 'id, comercio_id, estado, motivo, url, ancho, alto, created_at';

export const TEXTO_ESTADO: Record<EstadoFoto, string> = {
  aprobada: 'Publicada',
  pendiente: 'En revisión',
  rechazada: 'Rechazada',
};

export const MOTIVOS_REPORTE = [
  { valor: 'sexual', texto: 'Contenido sexual o desnudos' },
  { valor: 'violencia', texto: 'Violencia o contenido chocante' },
  { valor: 'enganosa', texto: 'Engañosa o no es de este comercio' },
  { valor: 'otro', texto: 'Otro motivo' },
] as const;
export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number]['valor'];

/** ¿Falta la tabla? (todavía no se corrió el SQL de moderación) */
export const esTablaFaltante = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /fotos_comercio/.test(error.message ?? '') && /does not exist|not find/i.test(error.message ?? ''));

/**
 * Fotos de un comercio. `disponible` es false si la base todavía no tiene la
 * tabla: en ese caso la app sigue con la galería anterior.
 */
export async function cargarFotosComercio(comercioId: string): Promise<{ disponible: boolean; fotos: FotoComercio[] }> {
  const { data, error } = await supabase
    .from('fotos_comercio')
    .select(COLUMNAS_FOTO)
    .eq('comercio_id', comercioId)
    .neq('estado', 'rechazada')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (!esTablaFaltante(error)) console.warn('[fotos] No se pudieron leer las fotos:', error.message);
    return { disponible: !esTablaFaltante(error), fotos: [] };
  }
  return { disponible: true, fotos: (data ?? []) as FotoComercio[] };
}

export const MAX_BYTES_ENTRADA = 25_000_000;
export const MAX_BYTES_SALIDA = 3_000_000; // el mismo límite que el servidor
const BYTES_FOTO_CHICA = 300_000;
const MIME_FOTO = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

const ascii = (b: Uint8Array, desde: number, largo: number) => String.fromCharCode(...b.subarray(desde, desde + largo));

/** Tipo real por los primeros bytes, no por la extensión ni el tipo que declara el archivo. */
export function tipoDeFoto(b: Uint8Array): keyof typeof MIME_FOTO | 'heic' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(b, 8, 4))) return 'heic';
  return null;
}

/** Si trae EXIF (puede traer GPS o una rotación que el servidor perdería al limpiarlo). */
export function tieneExif(b: Uint8Array): boolean {
  const cabecera = ascii(b, 0, Math.min(b.length, 65_536));
  return cabecera.includes('Exif\0\0') || cabecera.includes('eXIf') || cabecera.includes('EXIF');
}

const bytesDeDataUrl = (d: string) => Math.floor(((d.length - d.indexOf(',') - 1) * 3) / 4);

function aDataUrl(b: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer la foto.'));
    lector.readAsDataURL(b);
  });
}

/** Achica (lado mayor ≤ 1600 px) y recodifica a WebP en el navegador. */
export function recodificarFoto(archivo: Blob, ladoMax = 1600, calidad = 0.82): Promise<{ dataUrl: string; ancho: number; alto: number }> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * escala));
      c.height = Math.max(1, Math.round(img.naturalHeight * escala));
      const ctx = c.getContext('2d');
      if (!ctx) return rechazar(new Error('Este navegador no puede procesar la imagen.'));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const webp = c.toDataURL('image/webp', calidad);
      const medidas = { ancho: img.naturalWidth, alto: img.naturalHeight };
      if (webp.startsWith('data:image/webp')) return resolver({ dataUrl: webp, ...medidas });
      // Safari viejo no genera WebP: usa JPEG, con fondo blanco para que lo transparente no quede negro
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      resolver({ dataUrl: c.toDataURL('image/jpeg', calidad), ...medidas });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo abrir la imagen. Probá con una foto JPG o PNG.'));
    };
    img.src = url;
  });
}

/**
 * Valida la foto por su contenido y la achica. Manda la original solo si ya es
 * chica o si achicarla no la hace más liviana, y nunca si trae EXIF.
 */
export async function prepararFoto(archivo: File, ladoMax = 1600): Promise<string> {
  if (archivo.size > MAX_BYTES_ENTRADA) throw new Error(`La foto pesa más de ${MAX_BYTES_ENTRADA / 1_000_000} MB. Elegí una más liviana.`);
  const buffer = await archivo.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const tipo = tipoDeFoto(bytes);
  if (tipo === 'heic') throw new Error('La foto está en formato HEIC (iPhone). Elegila de nuevo como JPG, o en el iPhone poné Ajustes → Cámara → Formatos → Más compatible.');
  if (!tipo) throw new Error('Ese archivo no es una foto JPG, PNG o WebP.');
  const original = new Blob([buffer], { type: MIME_FOTO[tipo] });
  const sinExif = !tieneExif(bytes);
  const { dataUrl, ancho, alto } = await recodificarFoto(original, ladoMax);
  const entraEnLado = Math.max(ancho, alto) <= ladoMax;
  let elegida = dataUrl;
  if (sinExif && entraEnLado && (bytes.length <= BYTES_FOTO_CHICA || bytes.length <= bytesDeDataUrl(dataUrl))) {
    elegida = await aDataUrl(original);
  }
  if (bytesDeDataUrl(elegida) > MAX_BYTES_SALIDA) throw new Error('La foto sigue pesando más de 3 MB después de achicarla. Probá con otra.');
  return elegida;
}

/** El mensaje de error que mandó la función (o uno genérico). */
export async function mensajeDeError(error: unknown, generico: string): Promise<string> {
  try {
    const cuerpo = await (error as { context?: Response }).context?.json();
    if (cuerpo?.error) return String(cuerpo.error);
  } catch {
    /* sin cuerpo */
  }
  return generico;
}

export type Resultado<T> = { ok: true; valor: T; mensaje?: string } | { ok: false; mensaje: string };

export async function subirFoto(comercioId: string, archivo: File, alAvanzar?: (etapa: 'achicando' | 'subiendo') => void): Promise<Resultado<FotoComercio>> {
  let imagen: string;
  try {
    alAvanzar?.('achicando');
    imagen = await prepararFoto(archivo);
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
  alAvanzar?.('subiendo');
  const { data, error } = await supabase.functions.invoke(FUNCION_IMAGENES, { body: { accion: 'subir', comercio_id: comercioId, imagen } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo subir la foto. Probá de nuevo.') };
  return { ok: true, valor: data.foto as FotoComercio, mensaje: data.mensaje };
}

export async function borrarFoto(fotoId: string): Promise<Resultado<null>> {
  const { error } = await supabase.functions.invoke(FUNCION_IMAGENES, { body: { accion: 'borrar', foto_id: fotoId } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo borrar la foto.') };
  return { ok: true, valor: null };
}

export async function reportarFoto(datos: { comercio_id: string; foto_id?: string; indice_galeria?: number; motivo: MotivoReporte; detalle?: string }): Promise<Resultado<null>> {
  const { data, error } = await supabase.functions.invoke(FUNCION_IMAGENES, { body: { accion: 'reportar', ...datos } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo enviar el reporte.') };
  return { ok: true, valor: null, mensaje: data?.mensaje };
}

export async function revisarFoto(fotoId: string, estado: 'aprobada' | 'rechazada', motivo?: string): Promise<Resultado<null>> {
  const { error } = await supabase.functions.invoke(FUNCION_IMAGENES, { body: { accion: 'revisar', foto_id: fotoId, estado, motivo } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo guardar la revisión.') };
  return { ok: true, valor: null };
}

export async function resolverReporte(reporteId: string, estado: 'resuelto' | 'descartado'): Promise<Resultado<null>> {
  const { error } = await supabase.functions.invoke(FUNCION_IMAGENES, { body: { accion: 'resolver_reporte', reporte_id: reporteId, estado } });
  if (error) return { ok: false, mensaje: await mensajeDeError(error, 'No se pudo cerrar el reporte.') };
  return { ok: true, valor: null };
}

/**
 * Fotos para mostrar en la ficha: primero las nuevas aprobadas y después las
 * viejas (guardadas en galeria_urls). Cada una sabe cómo reportarse.
 */
export function fotosParaMostrar(aprobadas: FotoComercio[], galeriaVieja: string[] | null | undefined) {
  return [
    ...aprobadas.filter((f) => f.estado === 'aprobada' && f.url).map((f) => ({ url: f.url as string, fotoId: f.id as string | undefined, indiceGaleria: undefined as number | undefined })),
    ...(galeriaVieja ?? [])
      .map((url, i) => ({ url, fotoId: undefined as string | undefined, indiceGaleria: i as number | undefined }))
      .filter((f) => !!f.url),
  ];
}
