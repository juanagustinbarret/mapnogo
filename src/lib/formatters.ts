import { formatearFecha } from './fechasArgentina';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Fecha en formato argentino (dd/mm/aaaa). Fechas de calendario sin correr
// el día; instantes (created_at) en hora de Argentina. Ver fechasArgentina.ts.
export const formatDate = (dateString: string): string => formatearFecha(dateString);
