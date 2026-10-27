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

/** Achica (lado mayor ≤ 1600 px) y recodifica a WebP en el navegador. */
export function recodificarFoto(archivo: File, ladoMax = 1600, calidad = 0.82): Promise<string> {
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
      // Safari viejo no genera WebP: usa JPEG
      resolver(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo abrir la imagen. Probá con una foto JPG o PNG.'));
    };
    img.src = url;
  });
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

export async function subirFoto(comercioId: string, archivo: File): Promise<Resultado<FotoComercio>> {
  if (!archivo.type.startsWith('image/')) return { ok: false, mensaje: 'Elegí una foto (JPG, PNG o WebP).' };
  let imagen: string;
  try {
    imagen = await recodificarFoto(archivo);
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
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
