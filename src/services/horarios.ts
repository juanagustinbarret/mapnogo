import { supabase } from '@/lib/supabase';
import type { HorarioAtencion } from '@/types/database.types';

export type TurnoEditable = Pick<HorarioAtencion, 'dia_semana' | 'hora_apertura' | 'hora_cierre'> & {
  id?: string;
};

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const MAX_TURNOS_POR_DIA = 2;

export const listarHorarios = async (comercioId: string): Promise<HorarioAtencion[]> => {
  const { data, error } = await supabase
    .from('horarios_atencion')
    .select('*')
    .eq('comercio_id', comercioId)
    .order('dia_semana')
    .order('turno');
  if (error) throw error;
  return data ?? [];
};

// Horarios de varios comercios, agrupados por comercio
export const listarHorariosDeComercios = async (
  comercioIds: string[],
): Promise<Record<string, HorarioAtencion[]>> => {
  if (comercioIds.length === 0) return {};
  const { data, error } = await supabase.from('horarios_atencion').select('*').in('comercio_id', comercioIds);
  if (error) throw error;

  const porComercio: Record<string, HorarioAtencion[]> = {};
  for (const h of data ?? []) {
    (porComercio[h.comercio_id] ??= []).push(h);
  }
  return porComercio;
};

// Valida los turnos antes de guardar; devuelve un mensaje de error o null
export const validarTurnos = (turnos: TurnoEditable[]): string | null => {
  for (let dia = 0; dia < 7; dia++) {
    const delDia = turnos.filter((t) => t.dia_semana === dia);
    if (delDia.length > MAX_TURNOS_POR_DIA) {
      return `${DIAS_SEMANA[dia]}: se permiten hasta ${MAX_TURNOS_POR_DIA} turnos por día.`;
    }
    for (const t of delDia) {
      if (!t.hora_apertura || !t.hora_cierre) return `${DIAS_SEMANA[dia]}: completá apertura y cierre.`;
      if (t.hora_apertura.slice(0, 5) === t.hora_cierre.slice(0, 5)) {
        return `${DIAS_SEMANA[dia]}: la apertura y el cierre no pueden ser iguales.`;
      }
    }
  }
  return null;
};

/**
 * Reemplaza todos los horarios del comercio por los indicados, en una sola
 * transacción (función guardar_horarios de la base). Asigna el número de
 * turno (1 o 2) por día; la base marca los que cruzan la medianoche.
 */
export const guardarHorarios = async (comercioId: string, turnos: TurnoEditable[]): Promise<void> => {
  const errorValidacion = validarTurnos(turnos);
  if (errorValidacion) throw new Error(errorValidacion);

  const ordenados = [...turnos].sort(
    (a, b) => a.dia_semana - b.dia_semana || a.hora_apertura.localeCompare(b.hora_apertura),
  );
  const filas = ordenados.map((t) => ({
    dia_semana: t.dia_semana,
    turno: ordenados.filter((x) => x.dia_semana === t.dia_semana).indexOf(t) + 1,
    hora_apertura: t.hora_apertura.slice(0, 5),
    hora_cierre: t.hora_cierre.slice(0, 5),
  }));

  const { error } = await supabase.rpc('guardar_horarios', { p_comercio_id: comercioId, p_turnos: filas });
  if (error) throw error;
};
