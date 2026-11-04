// src/lib/resenasService.ts
import { supabase } from './supabase';
import { enqueuePendingAction, setCachedData, getCachedData } from './offlineStore';

export interface ResenaPayload {
  comercio_id: string;
  comentario: string;
  puntaje: number;
}

/**
 * Guarda una reseña: si hay red va directo a Supabase, si no, se va a la cola offline.
 */
export async function crearResena(resena: ResenaPayload) {
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.from('resenas').insert([resena]).select();
      if (error) throw error;
      return { success: true, offline: false, data };
    } catch (err) {
      console.warn('Error de red puntual, guardando en cola offline...', err);
    }
  }

  // Si no hay conexión o falló la red, encolar en IndexedDB
  await enqueuePendingAction('ENVIAR_RESENA', resena);
  return { success: true, offline: true };
}

/**
 * Obtiene reseñas: usa Supabase si hay red y actualiza la caché local; si no hay red, lee IndexedDB.
 */
export async function obtenerResenas(comercioId: string) {
  const cacheKey = `resenas_${comercioId}`;

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('resenas')
        .select('*')
        .eq('comercio_id', comercioId);

      if (!error && data) {
        // Guardar copia en caché local para uso offline futuro
        await setCachedData(cacheKey, data);
        return data;
      }
    } catch (err) {
      console.warn('Error al consultar servidor, usando datos en caché local', err);
    }
  }

  // Cargar desde el almacenamiento local si estamos offline
  const cachedData = await getCachedData(cacheKey);
  return cachedData || [];
}
