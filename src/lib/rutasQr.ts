// src/lib/rutasQr.ts
//
// Direcciones de los QR de reseñas. Separado de qrResenas.ts para que la
// redirección /n/{slug}/resenas no cargue el generador de QR en el inicio.

import { CONTACTO } from './contacto';

/** Dominio fijo para los QR (no el de una vista previa): tiene que existir siempre. */
export const DOMINIO_QR = CONTACTO.sitio.replace(/\/+$/, '');

export const rutaQrResenas = (slug: string) => `/n/${encodeURIComponent(slug)}/resenas`;
export const urlQrResenas = (slug: string, dominio: string = DOMINIO_QR) => `${dominio.replace(/\/+$/, '')}${rutaQrResenas(slug)}`;

/** Destino actual de /n/{slug}/resenas dentro de la app. */
export const destinoQrResenas = (slug: string) => `/comercio/${encodeURIComponent(slug)}#resenas`;

