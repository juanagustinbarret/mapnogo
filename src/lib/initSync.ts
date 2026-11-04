// src/lib/initSync.ts
import { syncService } from './syncService';
import { supabase } from './supabase'; // Tu cliente configurado de Supabase

/**
 * Registra los manejadores para procesar la cola offline cuando vuelve la red
 */
export function initSyncHandlers() {
  // Manejador para enviar reseñas pendientes
  syncService.registerHandler('ENVIAR_RESENA', async (payload) => {
    const { data, error } = await supabase
      .from('resenas')
      .insert([payload]);

    if (error) {
      console.error('Error al sincronizar reseña:', error);
      return false; // Retornar false mantendrá la acción en la cola de IndexedDB
    }

    return true; // Retornar true confirma que se procesó y la elimina de la cola
  });

  // Manejador para guardar favoritos pendientes
  syncService.registerHandler('GUARDAR_FAVORITO', async (payload) => {
    const { error } = await supabase
      .from('favoritos')
      .insert([payload]);

    return !error;
  });
}
