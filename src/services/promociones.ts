import { supabase } from '@/lib/supabase';
import { sumarDias, hoyArgentina } from '@/lib/fechas';
import type { Promocion } from '@/types/database.types';

const COLUMNAS_PROMO =
  'id, comercio_id, titulo, descripcion, imagen_url, fecha_inicio, fecha_fin, condiciones, precio_anterior, precio_promocional, aprobada, destacada, created_at';

// Promociones vigentes y aprobadas de comercios públicos (la base filtra el resto)
export const listarPromocionesVigentes = async (): Promise<Promocion[]> => {
  const { data, error } = await supabase
    .from('promociones')
    .select(`${COLUMNAS_PROMO}, comercio:comercios(id, nombre, slug, whatsapp)`)
    .eq('aprobada', true)
    .gte('fecha_fin', new Date().toISOString())
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Promocion[];
};

export const listarPromocionesDeComercio = async (comercioId: string): Promise<Promocion[]> => {
  const { data, error } = await supabase
    .from('promociones')
    .select(COLUMNAS_PROMO)
    .eq('comercio_id', comercioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promocion[];
};

export const listarPromocionesAdmin = async (): Promise<Promocion[]> => {
  const { data, error } = await supabase
    .from('promociones')
    .select(`${COLUMNAS_PROMO}, comercio:comercios(id, nombre, slug, whatsapp)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Promocion[];
};

export const estaVigente = (p: Pick<Promocion, 'fecha_fin'>): boolean => new Date(p.fecha_fin) >= new Date();

export interface NuevaPromocion {
  titulo: string;
  descripcion: string;
  precio_anterior: number | null;
  precio_promocional: number | null;
  dias_vigencia: number;
}

export const crearPromocion = async (comercioId: string, promo: NuevaPromocion): Promise<void> => {
  const inicio = hoyArgentina();
  const { error } = await supabase.from('promociones').insert({
    comercio_id: comercioId,
    titulo: promo.titulo.trim(),
    descripcion: promo.descripcion.trim(),
    precio_anterior: promo.precio_anterior,
    precio_promocional: promo.precio_promocional,
    // Vigente desde hoy hasta el final del último día, hora argentina
    fecha_inicio: `${inicio}T00:00:00-03:00`,
    fecha_fin: `${sumarDias(inicio, promo.dias_vigencia)}T23:59:59-03:00`,
  });
  if (error) throw error;
};

export const eliminarPromocion = async (id: string): Promise<void> => {
  const { error } = await supabase.from('promociones').delete().eq('id', id);
  if (error) throw error;
};

// Moderación del admin: ocultar o volver a mostrar una promoción
export const cambiarAprobacionPromocion = async (id: string, aprobada: boolean): Promise<void> => {
  const { error } = await supabase.from('promociones').update({ aprobada }).eq('id', id);
  if (error) throw error;
};
