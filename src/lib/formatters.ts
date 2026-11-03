import { formatearFecha } from './fechasArgentina';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Importe en pesos (número o texto de la base) a centavos enteros
export const aCentavos = (monto: number | string | null | undefined): number => Math.round(Number(monto) * 100) || 0;

// Importe en centavos (entero) como pesos con centavos: $ 1.234.567,89
export const formatearCentavos = (centavos: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((centavos || 0) / 100);

// Fecha en formato argentino (dd/mm/aaaa). Fechas de calendario sin correr
// el día; instantes (created_at) en hora de Argentina. Ver fechasArgentina.ts.
export const formatDate = (dateString: string): string => formatearFecha(dateString);
