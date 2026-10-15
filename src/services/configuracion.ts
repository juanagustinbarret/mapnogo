import { supabase } from '@/lib/supabase';
import type { EstadoRecordatorio, PlantillasWhatsApp, RecordatorioWhatsApp, Rubro } from '@/types/database.types';

export const PLANTILLAS_POR_DEFECTO: PlantillasWhatsApp = {
  proximo_vencimiento:
    'Hola, ¿cómo estás? 👋\nTe recordamos que el [FECHA DE VENCIMIENTO] vence la suscripción mensual de [NOMBRE DEL COMERCIO], por un importe de [IMPORTE].\nCuando realices el pago, avisanos para que podamos registrarlo. ¡Gracias! 🙌',
  pago_vencido:
    'Hola, ¿cómo estás? 👋\nRegistramos pendiente el pago del período [PERIODO] de [NOMBRE DEL COMERCIO] por un importe de [IMPORTE].\nPor favor, confirmanos si pudiste realizar la transferencia. ¡Gracias! 🙌',
};

export const obtenerPlantillas = async (): Promise<PlantillasWhatsApp> => {
  const { data, error } = await supabase
    .from('configuracion_sistema')
    .select('valor')
    .eq('clave', 'plantillas_whatsapp')
    .maybeSingle();
  if (error) throw error;
  return { ...PLANTILLAS_POR_DEFECTO, ...(data?.valor ?? {}) };
};

export const guardarPlantillas = async (plantillas: PlantillasWhatsApp): Promise<void> => {
  const { error } = await supabase.from('configuracion_sistema').upsert({
    clave: 'plantillas_whatsapp',
    valor: plantillas,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export const listarRecordatorios = async (periodo: string): Promise<RecordatorioWhatsApp[]> => {
  const { data, error } = await supabase.from('recordatorios_whatsapp').select('*').eq('periodo_facturado', periodo);
  if (error) throw error;
  return data ?? [];
};

export const marcarRecordatorio = async (params: {
  comercioId: string;
  suscripcionId: string;
  periodo: string;
  estado: EstadoRecordatorio;
  usuarioId?: string;
}): Promise<void> => {
  const { error } = await supabase.from('recordatorios_whatsapp').upsert(
    {
      comercio_id: params.comercioId,
      suscripcion_id: params.suscripcionId,
      periodo_facturado: params.periodo,
      estado: params.estado,
      fecha_gestion: params.estado === 'pendiente' ? null : new Date().toISOString(),
      gestionado_por: params.estado === 'pendiente' ? null : params.usuarioId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'comercio_id,periodo_facturado' },
  );
  if (error) throw error;
};

export const listarRubrosActivos = async (): Promise<Rubro[]> => {
  const { data, error } = await supabase.from('rubros').select('*').eq('estado', true).order('orden');
  if (error) throw error;
  return data ?? [];
};
