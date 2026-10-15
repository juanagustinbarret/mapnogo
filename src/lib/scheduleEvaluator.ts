import { HorarioAtencion } from '@/types/database.types';

export interface StatusHorarioResult {
  estado: 'abierto' | 'cierra_pronto' | 'cerrado' | 'no_informado';
  mensaje: string;
}

export const evaluarEstadoHorario = (
  horarios: HorarioAtencion[],
  nowDate: Date = new Date()
): StatusHorarioResult => {
  if (!horarios || horarios.length === 0) {
    return { estado: 'no_informado', mensaje: 'Horario no informado' };
  }

  // Convertir día de JavaScript (0 = Domingo) a índice DB (0 = Lunes, ..., 6 = Domingo)
  const jsDay = nowDate.getDay();
  const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1;

  const currentHour = nowDate.getHours();
  const currentMinute = nowDate.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;

  const horariosHoy = horarios.filter((h) => h.dia_semana === currentDayIndex && h.activo);

  if (horariosHoy.length === 0) {
    return { estado: 'cerrado', mensaje: 'Cerrado hoy' };
  }

  for (const h of horariosHoy) {
    if (!h.hora_apertura || !h.hora_cierre) continue;

    const [hOpen, mOpen] = h.hora_apertura.split(':').map(Number);
    const [hClose, mClose] = h.hora_cierre.split(':').map(Number);
    const startMinutes = hOpen * 60 + mOpen;
    let endMinutes = hClose * 60 + mClose;

    // Si la hora de cierre es menor a la de apertura, cruza la medianoche (ej: 20:00 a 02:00)
    const cruzaMedianoche = endMinutes < startMinutes || h.cruza_medianoche;

    if (cruzaMedianoche) {
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return { estado: 'abierto', mensaje: `Abierto hasta las ${h.hora_cierre}` };
      }
    } else {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        const diff = endMinutes - currentMinutes;
        if (diff <= 30) {
          return { estado: 'cierra_pronto', mensaje: `Cierra pronto (${diff} min)` };
        }
        return { estado: 'abierto', mensaje: `Abierto hasta las ${h.hora_cierre}` };
      }
    }
  }

  return { estado: 'cerrado', mensaje: 'Cerrado en este momento' };
};