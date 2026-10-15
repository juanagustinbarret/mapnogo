const ZONA = 'America/Argentina/Cordoba';

// Fecha de hoy en Argentina como AAAA-MM-DD
export const hoyArgentina = (ahora: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);

// Suma días a una fecha AAAA-MM-DD sin depender de la zona horaria
export const sumarDias = (fecha: string, dias: number): string => {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

// Día 10 del mes siguiente a la fecha dada
export const diezDelMesSiguiente = (fecha: string): string => {
  const [a, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m, 10)).toISOString().slice(0, 10);
};
