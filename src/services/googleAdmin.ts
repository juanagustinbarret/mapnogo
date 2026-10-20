// src/services/googleAdmin.ts
//
// Vincular un comercio con su ficha de Google (solo admin). La búsqueda pasa
// por /api/google (la clave de Google está en el servidor); lo que se guarda
// en la base es solo el place_id y el estado (lo único que Google permite
// guardar). Ver docs/google-places.md.

import { supabase } from '@/lib/supabase';
import type { CandidatoGoogle, EstadoGoogle } from '@/lib/resenasGoogle';

export async function buscarEnGoogle(consulta: { texto: string } | { placeId: string }): Promise<CandidatoGoogle[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  let respuesta: Response;
  try {
    respuesta = await fetch('/api/google?accion=buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(consulta),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const cuerpo = (await respuesta.json().catch(() => ({}))) as { candidatos?: CandidatoGoogle[]; error?: string };
  if (!respuesta.ok) throw new Error(cuerpo.error || `El servidor respondió ${respuesta.status}.`);
  return cuerpo.candidatos ?? [];
}

export interface VinculoGoogle {
  placeId: string | null;
  estado: EstadoGoogle;
}

/** Guarda el vínculo. Si la base todavía no tiene las columnas, avisa qué SQL falta. */
export async function guardarVinculoGoogle(comercioId: string, vinculo: VinculoGoogle): Promise<void> {
  const { error } = await supabase
    .from('comercios')
    .update({
      google_place_id: vinculo.estado === 'vinculado' ? vinculo.placeId : null,
      google_estado: vinculo.estado,
      google_vinculado_en: vinculo.estado === 'vinculado' ? new Date().toISOString() : null,
    })
    .eq('id', comercioId);
  if (!error) return;
  if (error.code === 'PGRST204' || /google_/.test(error.message)) {
    throw new Error('Falta correr supabase/propuestas/20261020_google_places.sql en la base.');
  }
  if (error.code === '23505') throw new Error('Esa ficha de Google ya está vinculada a otro comercio.');
  throw new Error(error.message);
}

export async function horariosDelComercio(comercioId: string) {
  const { data } = await supabase
    .from('horarios_atencion')
    .select('dia_semana, hora_apertura, hora_cierre, activo')
    .eq('comercio_id', comercioId);
  return (data ?? []) as Array<{ dia_semana: number; hora_apertura: string; hora_cierre: string; activo?: boolean | null }>;
}
