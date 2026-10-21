// src/lib/renovacion.ts
//
// "Renovar suscripción" del panel del comercio: arma el mensaje de WhatsApp
// para el administrador con el negocio elegido. Y los textos y colores del
// estado de la suscripción (antes siempre se veía verde, aunque estuviera
// vencida).

import { CONTACTO } from './contacto';
import { formatCurrency } from './formatters';
import { formatearFecha } from './fechasArgentina';

export type EstadoSuscripcion = 'activa' | 'pendiente' | 'vencida' | 'suspendida';

export interface NegocioParaRenovar {
  id: string;
  nombre: string;
  direccion?: string | null;
  precio?: number | null;
  vencimiento?: string | null;
  estado?: EstadoSuscripcion | string | null;
}

export const ESTADOS_SUSCRIPCION: Record<EstadoSuscripcion, { texto: string; clase: string }> = {
  activa: { texto: 'Activa', clase: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
  pendiente: { texto: 'Pago pendiente', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
  suspendida: { texto: 'Suspendida', clase: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
};

export function estadoSuscripcion(estado?: string | null): { texto: string; clase: string } {
  return ESTADOS_SUSCRIPCION[(estado ?? '') as EstadoSuscripcion] ?? { texto: 'Sin datos', clase: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };
}

/** Código corto del comercio para que el admin lo identifique sin dudas. */
export const codigoComercio = (id: string) => id.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();

export function mensajeRenovacion(n: NegocioParaRenovar): string {
  return [
    'Hola! Quiero renovar la suscripción de mi comercio en NOGOYORK.',
    '',
    `Comercio: ${n.nombre}${n.direccion ? ` (${n.direccion})` : ''}`,
    `Código: ${codigoComercio(n.id)}`,
    n.precio != null ? `Plan actual: ${formatCurrency(n.precio)} por mes` : '',
    n.vencimiento ? `Vencimiento: ${formatearFecha(n.vencimiento)}` : '',
    '',
    '¿Me pasás los datos para el pago? Gracias.',
  ]
    .filter((l, i, todas) => l !== '' || (todas[i - 1] ?? '') !== '')
    .join('\n');
}

export const urlRenovacion = (n: NegocioParaRenovar, numero: string = CONTACTO.whatsappSoporte) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(mensajeRenovacion(n))}`;
