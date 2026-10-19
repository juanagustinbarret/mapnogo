import React, { useEffect } from 'react';
import { CONTACTOS_EMERGENCIA } from '@/data/emergencias';
import { PhoneCall, X, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalEmergencias: React.FC<Props> = ({ isOpen, onClose }) => {
  // Se cierra con Escape
  useEffect(() => {
    if (!isOpen) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-emergencias"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-red-100 dark:border-red-900/30">
        
        {/* CABECERA */}
        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 rounded-2xl">
              <ShieldAlert className="w-6 h-6 motion-safe:animate-pulse" />
            </div>
            <div>
              <h3 id="titulo-emergencias" className="text-lg font-black text-gray-900 dark:text-white">
                Teléfonos de Emergencia
              </h3>
              <p className="text-xs text-gray-500">Contactos de guardia en Nogoyá</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
            autoFocus
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LISTADO DE CONTACTOS CON LLAMADA DIRECTA */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {CONTACTOS_EMERGENCIA.map((contacto) => (
            <div
              key={contacto.id}
              className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 hover:border-red-300 transition"
            >
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  {contacto.titulo}
                </h4>
                <p className="text-xs text-gray-500">{contacto.subtitulo}</p>
                <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono mt-0.5 block">
                  N° {contacto.telefono}
                </span>
              </div>

              <a
                href={`tel:${contacto.telefono}`}
                aria-label={`Llamar a ${contacto.titulo} al ${contacto.telefono}`}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition shrink-0 active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Llamar
              </a>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-center text-gray-400 pt-1">
          Llamada directa desde tu dispositivo celular.
        </p>
      </div>
    </div>
  );
};
