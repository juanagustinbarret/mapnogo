// src/components/CarruselFotosComercio.tsx
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarruselFotosProps {
  fotos?: string[];
  nombreComercio: string;
}

export const CarruselFotosComercio: React.FC<CarruselFotosProps> = ({ fotos = [], nombreComercio }) => {
  const [indice, setIndice] = useState(0);

  if (!fotos || fotos.length === 0) return null;

  const anterior = () => setIndice((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
  const siguiente = () => setIndice((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));

  return (
    <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden group border border-gray-200 dark:border-gray-700 bg-gray-900 shadow-md">
      <img
        src={fotos[indice]}
        alt={`${nombreComercio} - foto ${indice + 1}`}
        className="w-full h-full object-cover transition-all duration-300"
      />

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={siguiente}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition"
            aria-label="Siguiente foto"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
            {fotos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndice(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  indice === i ? 'bg-white w-4' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};