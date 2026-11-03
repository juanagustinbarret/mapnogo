// src/services/pagos.service.ts
import { supabase } from '@/lib/supabase';

export const fetchHistorialComercio = async (comercioId: string) => {
  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id,
      importe,
      metodo_pago,
      referencia,
      created_at,
      registrado_por,
      comercio_id,
      periodo_id,
      periodos_suscripcion (
        periodo_facturado
      )
    `)
    .or(`comercio_id.eq.${comercioId},periodos_suscripcion.suscripciones.comercio_id.eq.${comercioId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al cargar historial:', error.message);
    return [];
  }

  return data;
};