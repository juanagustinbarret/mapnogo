import React from 'react';
import { Rubro } from '@/types/database.types';
import { visualDeRubro } from '@/lib/iconosRubro';

interface InsigniaRubroProps {
  rubro?: Pick<Rubro, 'nombre' | 'slug' | 'icono'> | null;
  className?: string;
}

// Circulito con el color y el ícono del rubro, igual al pin del mapa.
// Ícono blanco sobre color para que se lea bien en modo claro y oscuro.
export const InsigniaRubro: React.FC<InsigniaRubroProps> = ({ rubro, className = '' }) => {
  const { Icono, color } = visualDeRubro(rubro);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      <Icono className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
    </span>
  );
};
