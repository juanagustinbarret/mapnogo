// src/lib/rutasQr.ts
import { CONTACTO } from './contacto';

// Forzamos siempre la URL absoluta con https:// para que MIUI/Xiaomi/iOS lo abran directamente
const sitioLimpio = CONTACTO.sitio.replace(/\/+$/, '');
export const DOMINIO_QR = sitioLimpio.startsWith('http://') || sitioLimpio.startsWith('https://')
  ? sitioLimpio
  : `https://${sitioLimpio || 'mapnogo.vercel.app'}`;

/** Sanitiza el slug garantizando minúsculas y sin espacios */
const sanitizarSlug = (slug: string) =>
  encodeURIComponent(slug.trim().toLowerCase().replace(/\s+/g, '-'));

export const rutaQrResenas = (slug: string) => `/n/${sanitizarSlug(slug)}/resenas`;

export const urlQrResenas = (slug: string, dominio: string = DOMINIO_QR) =>
  `${dominio.replace(/\/+$/, '')}${rutaQrResenas(slug)}`;

/** Destino actual de /n/{slug}/resenas dentro de la app */
export const destinoQrResenas = (slug: string) => `/comercio/${sanitizarSlug(slug)}#resenas`;