// src/lib/rutasQr.ts

export const DOMINIO_QR = 'https://mapnogo.vercel.app';

/** Convierte "Farmacia del Centro" en "farmacia-del-centro" sin %20 ni mayúsculas */
export const sanitizarSlug = (slug: string) =>
  slug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^a-z0-9 -]/g, '')     // Elimina caracteres especiales
    .replace(/\s+/g, '-')            // Cambia espacios por guiones
    .replace(/-+/g, '-');            // Evita guiones dobles

export const rutaQrResenas = (slug: string) => `/n/${sanitizarSlug(slug)}/resenas`;

export const urlQrResenas = (slug: string, dominio: string = DOMINIO_QR) =>
  `${dominio.replace(/\/+$/, '')}${rutaQrResenas(slug)}`;

export const destinoQrResenas = (slug: string) => `/comercio/${sanitizarSlug(slug)}#resenas`;