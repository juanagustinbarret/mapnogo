// src/lib/puntaje.ts
//
// Textos del puntaje de las reseñas de NOGOMAP: "★★★★☆ 4,6 (12)", con coma
// decimal y una etiqueta para lectores de pantalla.

import { formatearFecha } from './fechasArgentina';

/** 4.56 → "4,6"; null si no hay puntaje válido. */
export function formatearPuntaje(puntaje: number | null | undefined): string | null {
  if (puntaje == null || !Number.isFinite(puntaje) || puntaje <= 0) return null;
  const acotado = Math.min(5, Math.max(1, puntaje));
  return (Math.round(acotado * 10) / 10).toFixed(1).replace('.', ',');
}

/** Estrellas llenas (redondeo al entero más cercano). */
export function estrellasLlenas(puntaje: number | null | undefined): number {
  if (puntaje == null || !Number.isFinite(puntaje)) return 0;
  return Math.min(5, Math.max(0, Math.round(puntaje)));
}

export const textoEstrellas = (puntaje: number | null | undefined) =>
  '★'.repeat(estrellasLlenas(puntaje)) + '☆'.repeat(5 - estrellasLlenas(puntaje));

const miles = (n: number) => new Intl.NumberFormat('es-AR').format(n);

/** "4,6 (123)"; null si no hay reseñas (no se muestran estrellas vacías). */
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
