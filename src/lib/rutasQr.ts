// src/lib/rutasQr.ts
//
// Direcciones de los QR de reseñas. Usamos el dominio real desplegado en Vercel.

/** Dominio fijo y absoluto para la generación de los códigos QR */
export const DOMINIO_QR = 'https://mapnogo.vercel.app';

export const rutaQrResenas = (slug: string) => `/n/${encodeURIComponent(slug)}/resenas`;

export const urlQrResenas = (slug: string, dominio: string = DOMINIO_QR) =>
  `${dominio.replace(/\/+$/, '')}${rutaQrResenas(slug)}`;

/** Destino actual de /n/{slug}/resenas dentro de la app */
export const destinoQrResenas = (slug: string) => `/comercio/${encodeURIComponent(slug)}#resenas`;