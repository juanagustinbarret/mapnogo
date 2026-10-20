// src/lib/rutasQr.ts
//
// Direcciones de los QR de reseñas. Separado de qrResenas.ts para que la
// redirección /n/{slug}/resenas no cargue el generador de QR en el inicio.

import { CONTACTO } from './contacto';

/** Dominio fijo para los QR (no el de una vista previa): tiene que existir siempre. */
export const DOMINIO_QR = CONTACTO.sitio.replace(/\/+$/, '');

/**
 * "BIEN CRIOLLO PIZZAS" → "bien-criollo-pizzas". Misma regla que usa el alta
 * de comercios (supabase/functions/admin-crear-comerciante: makeSlug).
 *
 * Hace falta porque el slug se puede editar a mano en el panel del admin: con
 * espacios y mayúsculas el QR quedaba "…/n/BIEN%20CRIOLLO%20PIZZAS/resenas" y
 * algunos lectores (por ejemplo el de Xiaomi) lo mostraban como texto en vez
 * de ofrecer abrir el link.
 */
export const slugLimpio = (slug: string) =>
  (slug ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Para la URL: el slug limpio; si quedara vacío, el original codificado. */
const paraUrl = (slug: string) => slugLimpio(slug) || encodeURIComponent(slug);

export const rutaQrResenas = (slug: string) => `/n/${paraUrl(slug)}/resenas`;
export const urlQrResenas = (slug: string, dominio: string = DOMINIO_QR) => `${dominio.replace(/\/+$/, '')}${rutaQrResenas(slug)}`;

/** Destino actual de /n/{slug}/resenas dentro de la app. */
export const destinoQrResenas = (slug: string) => `/comercio/${paraUrl(slug)}#resenas`;

/** Destino de /n/{slug} (link recortado): la ficha. */
export const destinoQrFicha = (slug: string) => `/comercio/${paraUrl(slug)}`;

/**
 * Patrón ILIKE para encontrar, a partir de "almacen-don-tito", un slug cargado
 * a mano como "Almacén Don Tito" o "ALMACEN  DON TITO". Las vocales y la n
 * pasan a "_" (un carácter cualquiera: cubre tildes y ñ) y los guiones a "%".
 * Trae candidatos de más a propósito: después elegirPorSlugLimpio se queda
 * solo con el que coincide exactamente. El slug limpio solo tiene a-z, 0-9 y
 * "-", así que no se cuelan otros comodines.
 */
export const patronSlugLimpio = (limpio: string) => limpio.replace(/[aeioun]/g, '_').replace(/-/g, '%');

/** De varias filas candidatas, la que tiene exactamente ese slug limpio. */
export function elegirPorSlugLimpio<T extends { slug: string }>(filas: T[] | null | undefined, limpio: string): T | null {
  return (filas ?? []).find((f) => slugLimpio(f.slug) === limpio) ?? null;
}
