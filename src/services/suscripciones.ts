import { supabase } from '@/lib/supabase';
import type { MetodoPago, Pago, Suscripcion } from '@/types/database.types';

export interface SuscripcionConComercio extends Suscripcion {
  comercio: { id: string; nombre: string; whatsapp: string; eliminado_en: string | null } | null;
}

export const listarSuscripcionesAdmin = async (): Promise<SuscripcionConComercio[]> => {
  const { data, error } = await supabase
    .from('suscripciones')
    .select('*, comercio:comercios(id, nombre, whatsapp, eliminado_en)')
    .order('proximo_vencimiento', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as SuscripcionConComercio[]).filter((s) => s.comercio && !s.comercio.eliminado_en);
};

// IDs de suscripciones con el período indicado (AAAA-MM) ya pagado
export const suscripcionesPagadasEnPeriodo = async (periodo: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('periodos_suscripcion')
    .select('suscripcion_id')
    .eq('periodo_facturado', periodo)
    .eq('estado_pago', 'pagado');
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.suscripcion_id));
};

export interface RegistroPago {
  comercioId: string;
  importe: number;
  metodo: MetodoPago;
  periodo: string; // AAAA-MM
  referencia?: string;
}

// Guarda el pago, marca el período como pagado y extiende el vencimiento (función de la base)
export const registrarPago = async (pago: RegistroPago): Promise<Pago> => {
  const { data, error } = await supabase.rpc('registrar_pago', {
    p_comercio_id: pago.comercioId,
    p_importe: pago.importe,
    p_metodo: pago.metodo,
    p_periodo: pago.periodo,
    p_referencia: pago.referencia ?? null,
  });
  if (error) throw error;
  return data as Pago;
};

export interface PagoConDetalle extends Pago {
  periodo: { periodo_facturado: string; suscripcion: { comercio: { nombre: string } | null } | null } | null;
}

// Pagos cobrados desde una fecha (ISO), con el comercio y el período
export const listarPagosDesde = async (desdeIso: string): Promise<PagoConDetalle[]> => {
  const { data, error } = await supabase
    .from('pagos')
    .select('*, periodo:periodos_suscripcion(periodo_facturado, suscripcion:suscripciones(comercio:comercios(nombre)))')
    .gte('fecha_pago', desdeIso)
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PagoConDetalle[];
};

// Primer instante del mes (AAAA-MM) en hora argentina, en ISO
export const inicioDelPeriodo = (periodo: string): string => `${periodo}-01T00:00:00-03:00`;

export const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'mercado_pago', etiqueta: 'Mercado Pago' },
  { valor: 'otro', etiqueta: 'Otro' },
];
