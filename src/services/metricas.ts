import { supabase } from '@/lib/supabase';
import type { Metricas, TipoInteraccion } from '@/types/database.types';

// Registra una interacción pública. Nunca rompe la pantalla si falla.
export const registrarInteraccion = async (comercioId: string, tipo: TipoInteraccion): Promise<void> => {
  try {
    await supabase.rpc('registrar_interaccion', { p_comercio_id: comercioId, p_tipo: tipo });
  } catch (e) {
    console.error('No se pudo registrar la métrica:', e);
  }
};

// Cuenta una visita por comercio y por sesión del navegador (recargar no suma)
export const registrarVisitaUnaVez = (comercioId: string): void => {
  const clave = `visita_${comercioId}`;
  try {
    if (sessionStorage.getItem(clave)) return;
    sessionStorage.setItem(clave, '1');
  } catch {
    // sin sessionStorage (modo privado): se registra igual
  }
  void registrarInteraccion(comercioId, 'visita');
};

// Totales reales de un comercio; solo el dueño o un admin pueden verlos
export const obtenerMetricas = async (comercioId: string, desdeIso?: string): Promise<Metricas> => {
  const { data, error } = await supabase.rpc('metricas_comercio', {
    p_comercio_id: comercioId,
    p_desde: desdeIso ?? null,
  });
  if (error) throw error;
  const fila = Array.isArray(data) ? data[0] : data;
  return {
    visitas: Number(fila?.visitas ?? 0),
    whatsapp: Number(fila?.whatsapp ?? 0),
    comoLlegar: Number(fila?.como_llegar ?? 0),
  };
};
