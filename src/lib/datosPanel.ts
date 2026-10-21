// src/lib/datosPanel.ts
//
// Datos del panel del comercio que sobreviven a cambiar de sección o de
// pestaña (stale-while-revalidate sin librerías):
//   - un caché en memoria con lo último que se cargó, para mostrarlo al toque
//     y actualizar por detrás;
//   - un aviso entre secciones ("cambié algo") para que la otra se refresque
//     y nunca muestre datos viejos después de una modificación;
//   - la regla de cuándo vale la pena volver a pedir al volver a la pestaña.
// Es memoria de la pestaña: se pierde al recargar y se borra al cerrar sesión.

import { useEffect, useRef } from 'react';

export interface EntradaCache<T> {
  datos: T;
  /** Momento de la última carga desde la base (ms) */
  en: number;
}

const cache = new Map<string, EntradaCache<unknown>>();

export const leerCachePanel = <T>(clave: string): EntradaCache<T> | undefined => cache.get(clave) as EntradaCache<T> | undefined;

export function guardarCachePanel<T>(clave: string, datos: T, en: number) {
  cache.set(clave, { datos, en });
}

/** Al cerrar sesión: que el próximo usuario del dispositivo no vea nada del anterior. */
export function borrarCachePanel() {
  cache.clear();
}

/** Al volver a la pestaña del navegador se vuelve a pedir solo si pasó este tiempo. */
export const REVALIDAR_AL_VOLVER_MS = 5 * 60_000;
/** Al volver a entrar al panel (desde el mapa, por ejemplo) con datos en caché. */
export const REVALIDAR_AL_ENTRAR_MS = 30_000;

export const hayQueRevalidar = (cargadoEn: number, ahora: number, umbralMs: number) => ahora - cargadoEn >= umbralMs;

/**
 * Misma persona y mismos datos visibles. Supabase entrega un objeto `user`
 * nuevo cada vez que la pestaña vuelve a estar visible: si es la misma
 * persona, la app no tiene que enterarse (ver AuthContext).
 */
export function mismoUsuario(a: { id: string; email?: string | null } | null, b: { id: string; email?: string | null } | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && (a.email ?? null) === (b.email ?? null);
}

// ─── Avisos entre secciones ─────────────────────────────────────────────
export type SeccionPanel = 'inicio' | 'perfil';

/** /panel → "inicio", /panel/perfil → "perfil" */
export const seccionDeRuta = (ruta: string): SeccionPanel => (ruta.replace(/\/+$/, '') === '/panel/perfil' ? 'perfil' : 'inicio');
type Oyente = (origen: SeccionPanel) => void;
const oyentes = new Set<Oyente>();

/** "Guardé algo": las otras secciones se refrescan por detrás. */
export function avisarCambioPanel(origen: SeccionPanel) {
  for (const oyente of [...oyentes]) oyente(origen);
}

export function escucharCambiosPanel(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Escucha los cambios hechos en OTRA sección del panel. */
export function useCambiosDeOtraSeccion(propia: SeccionPanel, alCambiar: () => void) {
  const ultimo = useRef(alCambiar);
  ultimo.current = alCambiar;
  useEffect(
    () =>
      escucharCambiosPanel((origen) => {
        if (origen !== propia) ultimo.current();
      }),
    [propia],
  );
}

/**
 * Al volver a la pestaña del navegador, llama a `revalidar` solo si los datos
 * tienen más de REVALIDAR_AL_VOLVER_MS. Nunca muestra pantalla de carga: eso
 * lo decide quien revalida.
 */
export function useRevalidarAlVolver(cargadoEn: () => number | null, revalidar: () => void, umbralMs = REVALIDAR_AL_VOLVER_MS) {
  const ref = useRef({ cargadoEn, revalidar });
  ref.current = { cargadoEn, revalidar };
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const alCambiar = () => {
      if (document.visibilityState !== 'visible') return;
      const en = ref.current.cargadoEn();
      if (en !== null && hayQueRevalidar(en, Date.now(), umbralMs)) ref.current.revalidar();
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [umbralMs]);
}
