// src/lib/resenas.ts
//
// Reseñas: la base no garantiza que "estrellas" esté entre 1 y 5 (la tabla se
// creó a mano, sin restricción). Con un valor negativo o no entero,
// [...Array(n)] lanza RangeError y se cae la ficha entera.

export const LARGO_NOMBRE = 60;
export const LARGO_COMENTARIO = 1000;

/** Cantidad de estrellas a dibujar: entero entre 0 y 5. */
export function estrellasValidas(valor: unknown): number {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}
