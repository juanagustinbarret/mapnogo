// src/lib/puntajePropio.ts
//
// Puntaje de las reseñas de NOGOYORK (tabla resenas): el que se muestra en el
// popup del mapa y en la ficha.

import { estrellasValidas } from './resenas';

export interface PuntajePropio {
  puntaje: number | null;
  total: number;
}

/** Promedio de estrellas (las inválidas se descartan). */
export function calcularPuntaje(estrellas: unknown[]): PuntajePropio {
  const validas = estrellas.map(estrellasValidas).filter((n) => n >= 1);
  if (validas.length === 0) return { puntaje: null, total: 0 };
  return { puntaje: validas.reduce((a, b) => a + b, 0) / validas.length, total: validas.length };
}
