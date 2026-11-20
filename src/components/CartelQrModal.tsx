// src/components/CartelQrModal.tsx

import React, { useState } from 'react';
import { QrCode, X, Download, Copy, Check } from 'lucide-react';
import { generarCartelQrNogoyork } from '@/lib/cartelQr';

interface CartelQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  nombre: string;
  slug: string;
  subtitulo?: string;
  urlFicha: string;
  tituloModal?: string;
}

export const CartelQrModal: React.FC<CartelQrModalProps> = ({
  isOpen,
  onClose,
  nombre,
  slug,
  subtitulo,
  urlFicha,
  tituloModal = 'Código QR de la Ficha',
}) => {
  const [descargandoQr, setDescargandoQr] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    urlFicha
  )}`;

  const descargarQr = async () => {
    if (descargandoQr) return;
    setDescargandoQr(true);
    try {
      await generarCartelQrNogoyork(nombre, slug, urlFicha);
    } catch (err) {
      console.error('Error al generar el cartel QR:', err);
      alert('No se pudo generar el cartel QR. Probá nuevamente.');
    } finally {
      setDescargandoQr(false);
    }
  };

  const copiarEnlace = async () => {
    await navigator.clipboard.writeText(urlFicha);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Código QR de ${nombre}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-600" /> {tituloModal}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-2 flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-white rounded-2xl shadow-inner border border-gray-200">
            <img
              src={qrApiUrl}
              alt={`QR para acceder a la ficha de ${nombre}`}
              className="w-48 h-48 object-contain"
            />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">{nombre}</h4>
            {subtitulo && (
              <p className="text-[11px] font-bold uppercase text-purple-600 dark:text-purple-400 mt-0.5">
                {subtitulo}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 px-3">
            Escaneá este código con la cámara del celular o descargá el cartel listo para imprimir y compartir en redes.
          </p>
        </div>

        <div className="pt-2 border-t dark:border-gray-700 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={descargandoQr}
              onClick={descargarQr}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {descargandoQr ? 'Generando cartel...' : 'Descargar Cartel PNG'}
            </button>
            <button
              type="button"
              onClick={copiarEnlace}
              title="Copiar enlace de la ficha"
              className="px-3 py-2.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold rounded-xl text-xs transition inline-flex items-center justify-center gap-1"
            >
              {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
