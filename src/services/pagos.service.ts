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
      fecha_pago,
      created_at,
      periodos_suscripcion!inner (
        periodo_facturado,
        vencimiento,
        suscripciones!inner (
          comercio_id
        )
      )
    `)
    .eq('periodos_suscripcion.suscripciones.comercio_id', comercioId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al cargar historial:', error.message);
    return [];
  }

  return data;
};