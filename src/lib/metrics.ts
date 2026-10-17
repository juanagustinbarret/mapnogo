import { supabase } from '@/lib/supabase';

// Registrar evento de métrica
export const registrarInteraccion = async (comercioId: string, tipo: 'visita' | 'whatsapp' | 'como_llegar') => {
  try {
    await supabase.from('metricas_interacciones').insert({
      comercio_id: comercioId,
      tipo_interaccion: tipo,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error al registrar métrica:', e);
  }
};

// Consultar métricas reales acumuladas por comercio
export const obtenerMetricasComercio = async (comercioId: string) => {
  const { data: interacciones } = await supabase
    .from('metricas_interacciones')
    .select('*')
    .eq('comercio_id', comercioId);

  if (!interacciones) return { visitas: 0, whatsapp: 0, comoLlegar: 0 };

  const visitas = interacciones.filter(i => i.tipo_interaccion === 'visita').length;
  const whatsapp = interacciones.filter(i => i.tipo_interaccion === 'whatsapp').length;
  const comoLlegar = interacciones.filter(i => i.tipo_interaccion === 'como_llegar').length;

  return { visitas, whatsapp, comoLlegar };
};