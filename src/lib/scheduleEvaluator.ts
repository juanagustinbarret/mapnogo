import { HorarioAtencion } from '@/types/database.types';
import { momentoArgentina } from '@/lib/delivery';

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

  // Día (0 = Lunes … 6 = Domingo) y minuto en hora de Argentina. Antes se
  // usaba la hora del dispositivo (getDay/getHours): un celular con otra zona
  // horaria veía comercios abiertos o cerrados a destiempo.
  const { dia: currentDayIndex, minutos: currentMinutes } = momentoArgentina(nowDate);

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
        return { estado: 'abierto', mensaje: `Abierto hasta las ${h.hora_cierre.slice(0, 5)}` };
      }
    } else {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        const diff = endMinutes - currentMinutes;
        if (diff <= 30) {
          return { estado: 'cierra_pronto', mensaje: `Cierra pronto (${diff} min)` };
        }
        return { estado: 'abierto', mensaje: `Abierto hasta las ${h.hora_cierre.slice(0, 5)}` };
      }
    }
  }

  return { estado: 'cerrado', mensaje: 'Cerrado en este momento' };
};