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

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Argentina/Cordoba',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(nowDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';

  const currentHour = parseInt(getPart('hour'), 10);
  const currentMinute = parseInt(getPart('minute'), 10);
  const currentMinutes = currentHour * 60 + currentMinute;
  const dayOfWeek = nowDate.getDay();

  const horariosHoy = horarios.filter((h) => h.dia_semana === dayOfWeek && h.activo);

  if (horariosHoy.length === 0) {
    return { estado: 'cerrado', mensaje: 'Cerrado hoy' };
  }

  for (const h of horariosHoy) {
    const [hOpen, mOpen] = h.hora_apertura.split(':').map(Number);
    const [hClose, mClose] = h.hora_cierre.split(':').map(Number);
    const startMinutes = hOpen * 60 + mOpen;
    let endMinutes = hClose * 60 + mClose;

    if (h.cruza_medianoche) {
      endMinutes += 24 * 60;
    }

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      const diff = endMinutes - currentMinutes;
      if (diff <= 30) {
        return { estado: 'cierra_pronto', mensaje: `Cierra pronto (${diff} min)` };
      }
      return { estado: 'abierto', mensaje: `Abierto hasta las ${h.hora_cierre}` };
    }
  }

  return { estado: 'cerrado', mensaje: 'Cerrado en este momento' };
};