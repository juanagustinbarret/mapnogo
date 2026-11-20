// src/lib/planes.ts

export type TipoEntidad = 'negocio' | 'emprendimiento' | 'oficio';
export type ModalidadPlan = 'mensual' | 'anual';

export interface ConfiguracionTarifas {
  etiqueta: string;
  mensual: number;
  anual: number;
}

export const TARIFAS_PLANES: Record<TipoEntidad, ConfiguracionTarifas> = {
  negocio: {
    etiqueta: 'Negocio / Comercio',
    mensual: 10000,
    anual: 100000,
  },
  emprendimiento: {
    etiqueta: 'Emprendimiento',
    mensual: 8000,
    anual: 80000,
  },
  oficio: {
    etiqueta: 'Oficio / Servicio',
    mensual: 6000,
    anual: 60000,
  },
};

export function obtenerPrecioPlan(tipo: TipoEntidad, modalidad: ModalidadPlan): number {
  return TARIFAS_PLANES[tipo][modalidad];
}