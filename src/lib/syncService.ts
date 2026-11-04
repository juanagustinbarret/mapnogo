// src/lib/syncService.t

import { getPendingActions, removePendingAction, PendingAction } from './offlineStore';

type ActionHandler = (payload: any) => Promise<boolean>;

class SyncService {
  private handlers: Map<string, ActionHandler> = new Map();
  private isSyncing = false;

  constructor() {
    // Escuchar el retorno de la conexión
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
    }
  }

  /**
   * Registra un manejador para un tipo específico de acción
   */
  public registerHandler(type: string, handler: ActionHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Ejecuta el proceso de sincronización iterando la cola de acciones
   */
  public async sync(): Promise<{ processed: number; failed: number }> {
    if (this.isSyncing || !navigator.onLine) {
      return { processed: 0, failed: 0 };
    }

    this.isSyncing = true;
    let processed = 0;
    let failed = 0;

    try {
      const actions: PendingAction[] = await getPendingActions();

      for (const action of actions) {
        const handler = this.handlers.get(action.type);

        if (handler) {
          try {
            const success = await handler(action.payload);
            if (success && action.id !== undefined) {
              await removePendingAction(action.id);
              processed++;
            } else {
              failed++;
            }
          } catch (error) {
            console.error(`Error al procesar acción tipo ${action.type}:`, error);
            failed++;
          }
        } else {
          console.warn(`No existe manejador registrado para la acción: ${action.type}`);
        }
      }
    } catch (error) {
      console.error('Error durante el proceso de sincronización:', error);
    } finally {
      this.isSyncing = false;
    }

    return { processed, failed };
  }
}

export const syncService = new SyncService();
