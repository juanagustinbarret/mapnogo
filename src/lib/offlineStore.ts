// src/lib/offlineStore.ts

const DB_NAME = 'NogoyorkOfflineDB';
const DB_VERSION = 1;
const STORE_PENDING_ACTIONS = 'pending_actions';
const STORE_CACHE = 'general_cache';

export interface PendingAction {
  id?: number;
  type: string;
  payload: any;
  timestamp: number;
}

/**
 * Abre y configura la base de datos IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Almacén para acciones pendientes de sincronización
      if (!db.objectStoreNames.contains(STORE_PENDING_ACTIONS)) {
        db.createObjectStore(STORE_PENDING_ACTIONS, { keyPath: 'id', autoIncrement: true });
      }

      // Almacén para caché local de datos
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda una acción pendiente de sincronización cuando no hay conexión
 */
export async function enqueuePendingAction(type: string, payload: any): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_ACTIONS);
    const action: PendingAction = { type, payload, timestamp: Date.now() };

    const request = store.add(action);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las acciones pendientes
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ACTIONS, 'readonly');
    const store = tx.objectStore(STORE_PENDING_ACTIONS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina una acción pendiente tras sincronizarse con éxito
 */
export async function removePendingAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_ACTIONS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda o actualiza un registro en el caché local
 */
export async function setCachedData<T>(key: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const request = store.put({ key, data, updatedAt: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene datos desde el caché local
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const store = tx.objectStore(STORE_CACHE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ? request.result.data : null);
    request.onerror = () => reject(request.error);
  });
}
