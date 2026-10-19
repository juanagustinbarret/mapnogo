import type { HorarioAtencion } from '@/types/database.types';
import { estadoDeliveryEn, minutosHastaElFin, momentoArgentina, type RangoDelivery } from '@/lib/delivery';

export interface StatusHorarioResult {
  estado: 'abierto' | 'cierra_pronto' | 'cerrado' | 'no_informado';
  mensaje: string;
}

const MINUTOS_CIERRA_PRONTO = 30;

/**
 * ¿Está abierto el comercio? Siempre en hora de Argentina.
 *
 * Usa las mismas reglas que el delivery (src/lib/delivery.ts): apertura
 * inclusiva, cierre exclusivo, y un turno que cruza la medianoche pertenece
 * al día en que empieza. Antes un turno del lunes 20:00–02:00 no contaba el
 * martes a la 01:00 (decía "Cerrado hoy" si el martes no tenía turnos) y un
 * turno de 00:00 a 00:00 (24 hs) nunca figuraba abierto.
 */
export const evaluarEstadoHorario = (
  horarios: HorarioAtencion[],
  nowDate: Date = new Date()
): StatusHorarioResult => {
  if (!horarios || horarios.length === 0) {
    return { estado: 'no_informado', mensaje: 'Horario no informado' };
  }

  const momento = momentoArgentina(nowDate);
  const turnos: RangoDelivery[] = horarios
    .filter((h) => h.activo && h.hora_apertura && h.hora_cierre)
    .map((h) => ({ dia_semana: Number(h.dia_semana), hora_inicio: h.hora_apertura, hora_fin: h.hora_cierre }));

  const estado = estadoDeliveryEn(turnos, momento);

  if (estado.estado === 'activo') {
    if (estado.hasta === null) return { estado: 'abierto', mensaje: 'Abierto las 24 hs' };
    const faltan = minutosHastaElFin(turnos, momento) ?? Infinity;
    if (faltan <= MINUTOS_CIERRA_PRONTO) {
      return { estado: 'cierra_pronto', mensaje: `Cierra pronto (${faltan} min)` };
    }
    return { estado: 'abierto', mensaje: `Abierto hasta las ${estado.hasta}` };
  }

  const tieneTurnosHoy = turnos.some((t) => t.dia_semana === momento.dia);
  if (!tieneTurnosHoy) return { estado: 'cerrado', mensaje: 'Cerrado hoy' };
  return { estado: 'cerrado', mensaje: 'Cerrado en este momento' };
};

/** "Abierto Ahora" incluye a los que cierran pronto. */
export const estaAbierto = (estado: StatusHorarioResult) => estado.estado === 'abierto' || estado.estado === 'cierra_pronto';
