import React from 'react';
import { Star } from 'lucide-react';
import { estrellasLlenas, etiquetaPuntaje } from '@/lib/puntaje';

/**
 * Cinco estrellas: llenas y vacías se distinguen por la forma (rellena o
 * solo contorno), no solo por el color. El lector de pantalla lee la
 * etiqueta ("4,6 de 5 estrellas, 123 reseñas"), no las estrellas sueltas.
 */
export const Estrellas: React.FC<{ puntaje: number | null; total?: number; tamano?: string; etiqueta?: string }> = ({
  puntaje,
  total = 1,
  tamano = 'w-3.5 h-3.5',
  etiqueta,
}) => {
  const llenas = estrellasLlenas(puntaje);
  return (
    <span role="img" aria-label={etiqueta ?? etiquetaPuntaje(puntaje, total)} className="inline-flex items-center gap-0.5 shrink-0">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${tamano} ${i < llenas ? 'fill-amber-400 text-amber-500' : 'fill-transparent text-gray-400'}`}
          strokeWidth={i < llenas ? 1.5 : 2}
        />
      ))}
    </span>
  );
};
