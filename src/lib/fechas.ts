// Fechas en hora argentina, independientes de la zona horaria del navegador.
export const ZONA_HORARIA = 'America/Argentina/Cordoba';

// Hoy en Argentina como AAAA-MM-DD
export const hoyArgentina = (ahora: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(ahora);

// Período actual (AAAA-MM) en Argentina
export const periodoActual = (ahora: Date = new Date()): string => hoyArgentina(ahora).slice(0, 7);

// Suma días a una fecha AAAA-MM-DD
export const sumarDias = (fecha: string, dias: number): string => {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

// Días entre hoy (Argentina) y una fecha AAAA-MM-DD; negativo si ya pasó
export const diasHasta = (fecha: string, ahora: Date = new Date()): number => {
  const [a1, m1, d1] = hoyArgentina(ahora).split('-').map(Number);
  const [a2, m2, d2] = fecha.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
};

// Primer instante del día de hace N días, en ISO, para filtros "últimos N días"
export const haceDias = (dias: number, ahora: Date = new Date()): string =>
  new Date(ahora.getTime() - dias * 86_400_000).toISOString();

// Día de la semana y minutos del día en Argentina (0 = Lunes ... 6 = Domingo)
export const momentoArgentina = (ahora: Date = new Date()): { dia: number; minutos: number } => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const dias = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    dia: dias.indexOf(valor('weekday')),
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
};
