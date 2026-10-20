// src/lib/puntajePropio.ts
//
// Puntaje de las reseñas propias de NOGOMAP (tabla resenas). Es el que se
// muestra en el popup del mapa: el de Google no se puede usar junto a un mapa
// que no sea de Google (ver docs/google-places.md).

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
