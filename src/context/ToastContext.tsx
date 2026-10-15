import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';

type TipoAviso = 'exito' | 'error' | 'info';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
}

interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligroso?: boolean;
}

interface ToastContextType {
  avisar: (mensaje: string, tipo?: TipoAviso) => void;
  confirmar: (opciones: OpcionesConfirmacion) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ESTILOS: Record<TipoAviso, { clase: string; Icono: typeof Info }> = {
  exito: { clase: 'bg-green-600 text-white', Icono: CheckCircle },
  error: { clase: 'bg-red-600 text-white', Icono: XCircle },
  info: { clase: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900', Icono: Info },
};

// Avisos breves y diálogos de confirmación propios, en lugar de alert() y confirm()
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [confirmacion, setConfirmacion] = useState<OpcionesConfirmacion | null>(null);
  const resolverConfirmacion = useRef<((valor: boolean) => void) | null>(null);
  const siguienteId = useRef(1);

  const cerrarAviso = (id: number) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  const avisar = useCallback((mensaje: string, tipo: TipoAviso = 'info') => {
    const id = siguienteId.current++;
    setAvisos((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => cerrarAviso(id), tipo === 'error' ? 7000 : 4000);
  }, []);

  const confirmar = useCallback((opciones: OpcionesConfirmacion) => {
    setConfirmacion(opciones);
    return new Promise<boolean>((resolve) => {
      resolverConfirmacion.current = resolve;
    });
  }, []);

  const responder = (valor: boolean) => {
    resolverConfirmacion.current?.(valor);
    resolverConfirmacion.current = null;
    setConfirmacion(null);
  };

  return (
    <ToastContext.Provider value={{ avisar, confirmar }}>
      {children}

      <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {avisos.map(({ id, tipo, mensaje }) => {
          const { clase, Icono } = ESTILOS[tipo];
          return (
            <div key={id} role="status" className={`${clase} rounded-xl shadow-lg px-4 py-3 text-sm font-semibold flex items-start gap-2`}>
              <Icono className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 whitespace-pre-line">{mensaje}</span>
              <button onClick={() => cerrarAviso(id)} aria-label="Cerrar aviso" className="opacity-80 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {confirmacion && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmacion-titulo"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 id="confirmacion-titulo" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${confirmacion.peligroso ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
              {confirmacion.titulo}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{confirmacion.mensaje}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => responder(false)} className="px-4 py-2 border dark:border-gray-600 rounded-xl text-sm font-semibold">
                Cancelar
              </button>
              <button
                onClick={() => responder(true)}
                autoFocus
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${
                  confirmacion.peligroso ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {confirmacion.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
};
