import React, { Suspense, lazy } from 'react';

// Carga diferida de páginas que el visitante del mapa no usa (paneles del
// comercio y del admin): su código ya no viaja en el paquete inicial.

const Cargando: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center" role="status">
    <p className="text-sm font-semibold text-gray-500 animate-pulse">Cargando...</p>
  </div>
);

const CLAVE_RECARGA = 'nogomap-recarga-por-version';

/**
 * Si después de un deploy el navegador tiene la página vieja, el archivo de la
 * sección puede ya no existir: se recarga una vez para traer la versión nueva.
 */
function importarConReintento<T>(importar: () => Promise<T>): Promise<T> {
  return importar().catch((error) => {
    try {
      if (!sessionStorage.getItem(CLAVE_RECARGA)) {
        sessionStorage.setItem(CLAVE_RECARGA, '1');
        window.location.reload();
        return new Promise<T>(() => {});
      }
    } catch {
      /* sin sessionStorage: se muestra el error */
    }
    throw error;
  });
}

export function diferida<M extends Record<string, unknown>, K extends keyof M>(importar: () => Promise<M>, nombre: K) {
  const Pagina = lazy(() =>
    importarConReintento(importar).then((modulo) => {
      try {
        sessionStorage.removeItem(CLAVE_RECARGA);
      } catch {
        /* nada */
      }
      return { default: modulo[nombre] as React.ComponentType };
    }),
  );
  const ConCarga: React.FC = () => (
    <Suspense fallback={<Cargando />}>
      <Pagina />
    </Suspense>
  );
  return ConCarga;
}
