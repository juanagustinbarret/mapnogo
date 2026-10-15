export const formatCurrency = (amount: number | null | undefined): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
};

// Muestra una fecha como DD/MM/AAAA sin correrse de día:
// - "AAAA-MM-DD" (columnas DATE) se muestra tal cual;
// - un timestamp con hora se convierte a hora argentina.
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  const fecha = new Date(dateString);
  if (Number.isNaN(fecha.getTime())) return dateString;

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Cordoba',
  }).format(fecha);
};

// "2026-10" → "octubre 2026"
export const formatPeriodo = (periodo: string): string => {
  const [anio, mes] = periodo.split('-').map(Number);
  if (!anio || !mes) return periodo;
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  );
  return `${nombre} ${anio}`;
};

// Hora "08:00:00" → "08:00"
export const formatHora = (hora: string): string => (hora ?? '').slice(0, 5);

// Mensaje legible para errores de Supabase o de red
export const mensajeError = (error: unknown): string => {
  if (!error) return 'Error desconocido';
  if (typeof error === 'string') return error;
  const e = error as { message?: string; details?: string };
  return e.message || e.details || 'Error desconocido';
};
