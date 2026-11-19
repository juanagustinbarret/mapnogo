// src/lib/renovacion.ts

import { CONTACTO } from './contacto';
import { formatCurrency } from './formatters';
import { formatearFecha } from './fechasArgentina';
import { type ModalidadPlan, type TipoEntidad } from './planes';

export type EstadoSuscripcion = 'activa' | 'pendiente' | 'vencida' | 'suspendida';

export interface NegocioParaRenovar {
  id: string;
  nombre: string;
  direccion?: string | null;
  precio?: number | null;
  vencimiento?: string | null;
  estado?: EstadoSuscripcion | string | null;
  tipo?: TipoEntidad;
  modalidad?: ModalidadPlan;
}

export const ESTADOS_SUSCRIPCION: Record<EstadoSuscripcion, { texto: string; clase: string }> = {
  activa: { texto: 'Activa', clase: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
  pendiente: { texto: 'Pago pendiente', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
  suspendida: { texto: 'Suspendida', clase: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
};

export function estadoSuscripcion(estado?: string | null): { texto: string; clase: string } {
  return (
    ESTADOS_SUSCRIPCION[(estado ?? '') as EstadoSuscripcion] ?? {
      texto: 'Sin datos',
      clase: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    }
  );
}

/** Código corto para que el admin lo identifique sin dudas. */
export const codigoComercio = (id: string) => id.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();

export function mensajeRenovacion(n: NegocioParaRenovar): string {
  const esOficio = n.tipo === 'oficio';
  const etiquetaEntidad = esOficio ? 'Oficio / Servicio' : 'Comercio';
  const periodoTexto = n.modalidad === 'anual' ? 'por año (Plan Anual)' : 'por mes (Plan Mensual)';

  return [
    `Hola! Quiero renovar la suscripción de mi ${esOficio ? 'oficio' : 'comercio'} en NOGOYORK.`,
    '',
    `${etiquetaEntidad}: ${n.nombre}${n.direccion ? ` (${n.direccion})` : ''}`,
    `Código: ${codigoComercio(n.id)}`,
    n.precio != null ? `Plan elegido: ${formatCurrency(n.precio)} ${periodoTexto}` : '',
    n.vencimiento ? `Vencimiento actual: ${formatearFecha(n.vencimiento)}` : '',
    '',
    '¿Me pasás los datos para el pago? Gracias.',
  ]
    .filter((l, i, todas) => l !== '' || (todas[i - 1] ?? '') !== '')
    .join('\n');
}

export const urlRenovacion = (n: NegocioParaRenovar, numero: string = CONTACTO.whatsappSoporte) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(mensajeRenovacion(n))}`;