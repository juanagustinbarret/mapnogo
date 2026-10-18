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

type TipoInteraccion = 'visita' | 'whatsapp' | 'como_llegar';

// Cuenta en la base en vez de traer todas las filas: PostgREST devuelve como
// máximo 1000 filas por consulta, así que al contar en el navegador los totales
// se clavaban en 1000 sin avisar (y se descargaba toda la tabla).
const contarInteracciones = async (tipo: TipoInteraccion, comercioId?: string) => {
  let consulta = supabase
    .from('metricas_interacciones')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_interaccion', tipo);
  if (comercioId) consulta = consulta.eq('comercio_id', comercioId);
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
};

const contarTodo = async (comercioId?: string) => {
  const [visitas, whatsapp, comoLlegar] = await Promise.all([
    contarInteracciones('visita', comercioId),
    contarInteracciones('whatsapp', comercioId),
    contarInteracciones('como_llegar', comercioId),
  ]);
  return { visitas, whatsapp, comoLlegar };
};

// Consultar métricas reales acumuladas por comercio
export const obtenerMetricasComercio = (comercioId: string) => contarTodo(comercioId);

// Métricas de todos los comercios juntos (panel del admin)
export const obtenerMetricasGlobales = () => contarTodo();
