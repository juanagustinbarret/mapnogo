import { supabase } from '@/lib/supabase';
import type { Comercio, Suscripcion } from '@/types/database.types';

// Columnas que puede leer un visitante anónimo (ver migración 20261015000001).
// No usar select('*') en consultas públicas: la base lo rechaza para anon.
export const COLUMNAS_PUBLICAS_COMERCIO =
  'id, nombre, slug, descripcion_corta, descripcion_completa, rubro_id, direccion, latitud, longitud, telefono, whatsapp, sitio_web, instagram, facebook, logo_url, google_place_id, aprobado, habilitado_admin, propietario_id, created_at';

// PostgREST devuelve la relación 1 a 1 como objeto o como lista según la versión
const unaSuscripcion = (valor: unknown): Suscripcion | null =>
  (Array.isArray(valor) ? valor[0] : valor) ?? null;

const normalizar = (c: any): Comercio => ({ ...c, suscripcion: unaSuscripcion(c.suscripcion) });

export const listarComerciosPublicos = async (): Promise<Comercio[]> => {
  const { data, error } = await supabase
    .from('comercios')
    .select(`${COLUMNAS_PUBLICAS_COMERCIO}, rubro:rubros(*)`)
    .eq('aprobado', true)
    .eq('habilitado_admin', true)
    .is('eliminado_en', null)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as unknown as Comercio[];
};

export const obtenerComercioPorSlug = async (slug: string): Promise<Comercio | null> => {
  const { data, error } = await supabase
    .from('comercios')
    .select(`${COLUMNAS_PUBLICAS_COMERCIO}, rubro:rubros(*)`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Comercio | null;
};

// Comercio del usuario logueado, con su suscripción y plan
export const obtenerComercioDelUsuario = async (userId: string): Promise<Comercio | null> => {
  const { data, error } = await supabase
    .from('comercios')
    .select('*, rubro:rubros(*), suscripcion:suscripciones(*, plan:planes(*))')
    .eq('propietario_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizar(data) : null;
};

export const listarComerciosAdmin = async (): Promise<Comercio[]> => {
  const { data, error } = await supabase
    .from('comercios')
    .select('*, rubro:rubros(*), suscripcion:suscripciones(*)')
    .is('eliminado_en', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizar);
};

export type CambiosComercio = Partial<
  Pick<
    Comercio,
    | 'nombre'
    | 'rubro_id'
    | 'descripcion_corta'
    | 'direccion'
    | 'whatsapp'
    | 'telefono'
    | 'email_comercial'
    | 'latitud'
    | 'longitud'
    | 'google_place_id'
    | 'habilitado_admin'
  >
>;

export const actualizarComercio = async (id: string, cambios: CambiosComercio): Promise<void> => {
  const { error } = await supabase.from('comercios').update(cambios).eq('id', id);
  if (error) throw error;
};

// Baja lógica: el comercio deja de verse, pero se conservan pagos e historial
export const darDeBajaComercio = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('comercios')
    .update({ eliminado_en: new Date().toISOString(), habilitado_admin: false })
    .eq('id', id);
  if (error) throw error;
};

// Un comercio aparece en el mapa si cumple lo mismo que es_comercio_publico()
export const esVisibleEnMapa = (c: Comercio): boolean =>
  c.aprobado && c.habilitado_admin && !c.eliminado_en && c.suscripcion?.estado === 'activa';

export interface NuevoComercio {
  email: string;
  password: string;
  nombreComerciante: string;
  datosComercio: {
    nombre: string;
    rubro_id: string;
    descripcion_corta: string;
    direccion: string;
    whatsapp: string;
    latitud: number;
    longitud: number;
    email_comercial?: string | null;
    telefono?: string | null;
  };
}

// Alta de comerciante + comercio + suscripción mediante la Edge Function
export const crearComercioConUsuario = async (datos: NuevoComercio): Promise<Comercio> => {
  const { data, error } = await supabase.functions.invoke('admin-crear-comerciante', { body: datos });

  if (error) {
    // El cuerpo de la respuesta trae el motivo real del error
    let mensaje = error.message;
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.json === 'function') {
      try {
        const cuerpo = await contexto.json();
        if (cuerpo?.error) mensaje = cuerpo.error;
      } catch {
        // respuesta sin JSON: se usa el mensaje genérico
      }
    }
    throw new Error(mensaje);
  }

  return data.comercio as Comercio;
};
