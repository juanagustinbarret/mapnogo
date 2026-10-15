import type { HorarioAtencion } from '../types/database.types';
import { momentoArgentina } from './fechas';

export interface StatusHorarioResult {
  estado: 'abierto' | 'cierra_pronto' | 'cerrado' | 'no_informado';
  mensaje: string;
}

const MINUTOS_DIA = 24 * 60;
const AVISO_CIERRE = 30;

const aMinutos = (hora: string): number | null => {
  const [h, m] = (hora ?? '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const formatearHora = (hora: string) => hora.slice(0, 5);

const cruzaMedianoche = (h: HorarioAtencion, inicio: number, fin: number) =>
  h.cruza_medianoche || fin <= inicio;

/**
 * Indica si un comercio está abierto, usando la hora de Argentina.
 * dia_semana: 0 = Lunes ... 6 = Domingo.
 * Un turno que cruza la medianoche (por ejemplo 20:00 a 02:00 del viernes)
 * cuenta como abierto hasta las 02:00 del sábado.
 */
export const evaluarEstadoHorario = (
  horarios: HorarioAtencion[],
  ahora: Date = new Date(),
): StatusHorarioResult => {
  const activos = (horarios ?? []).filter((h) => h.activo);
  if (activos.length === 0) {
    return { estado: 'no_informado', mensaje: 'Horario no informado' };
  }

  const { dia, minutos } = momentoArgentina(ahora);
  const diaAnterior = (dia + 6) % 7;

  // Minutos que faltan para el cierre si el turno está abierto ahora; si no, null
  const minutosParaCerrar = (h: HorarioAtencion): number | null => {
    const inicio = aMinutos(h.hora_apertura);
    const fin = aMinutos(h.hora_cierre);
    if (inicio === null || fin === null) return null;
    const nocturno = cruzaMedianoche(h, inicio, fin);

    if (h.dia_semana === dia) {
      if (!nocturno && minutos >= inicio && minutos < fin) return fin - minutos;
      if (nocturno && minutos >= inicio) return MINUTOS_DIA - minutos + fin;
    }
    // Madrugada de un turno nocturno que empezó el día anterior
    if (h.dia_semana === diaAnterior && nocturno && minutos < fin) return fin - minutos;
    return null;
  };

  for (const h of activos) {
    const faltan = minutosParaCerrar(h);
    if (faltan === null) continue;
    if (faltan <= AVISO_CIERRE) {
      return { estado: 'cierra_pronto', mensaje: `Cierra pronto (${faltan} min)` };
    }
    return { estado: 'abierto', mensaje: `Abierto hasta las ${formatearHora(h.hora_cierre)}` };
  }

  const tieneTurnoHoy = activos.some((h) => h.dia_semana === dia);
  return {
    estado: 'cerrado',
    mensaje: tieneTurnoHoy ? 'Cerrado en este momento' : 'Cerrado hoy',
  };
};
