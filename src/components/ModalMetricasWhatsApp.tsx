import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Comercio } from '@/types/database.types';
import { obtenerMetricasConComparacion } from '@/lib/metrics';
import { armarMensajeMetricas, urlDetalleMetricas } from '@/lib/mensajeMetricas';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { SelectorPeriodo, periodoDeAtajo, type Periodo } from '@/components/SelectorPeriodo';

// Vista previa del mensaje de métricas antes de abrir WhatsApp. No envía nada
// por su cuenta: abre WhatsApp con el texto y el admin decide si lo manda.
export const ModalMetricasWhatsApp: React.FC<{ comercio: Comercio; onCerrar: () => void }> = ({ comercio, onCerrar }) => {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAtajo('7d'));
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const telefono = normalizeWhatsAppNumber(comercio.whatsapp);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    obtenerMetricasConComparacion(comercio.id, periodo.rango)
      .then(({ actual, anterior, rango }) => {
        if (!vigente) return;
        setMensaje(
          armarMensajeMetricas({
            nombreComercio: comercio.nombre,
            rango,
            actual,
            anterior,
            urlDetalle: urlDetalleMetricas(window.location.origin, rango),
          }),
        );
      })
      .catch((e) => {
        console.error('[métricas] No se pudieron leer', e);
        if (vigente) {
          setMensaje('');
          setError('No se pudieron leer las métricas. No se va a enviar nada.');
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [comercio.id, comercio.nombre, periodo.rango.desde, periodo.rango.hasta]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="titulo-metricas">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-metricas" className="text-base font-bold text-gray-900 dark:text-white">Métricas para {comercio.nombre}</h3>
            <p className="text-xs text-gray-500">Elegí el período y revisá el mensaje antes de abrir WhatsApp.</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />

        {error ? (
          <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>
        ) : (
          <textarea
            readOnly
            aria-label="Vista previa del mensaje"
            value={cargando ? 'Calculando…' : mensaje}
            rows={11}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono dark:bg-gray-900"
          />
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 border rounded-xl text-xs font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={cargando || !mensaje || !telefono.isValid}
            onClick={() => {
              window.open(buildWhatsAppUrl(telefono.normalized, mensaje), '_blank', 'noopener');
              onCerrar();
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
          </button>
        </div>
        {!telefono.isValid && <p className="text-[11px] text-red-600">El comercio no tiene un WhatsApp válido cargado.</p>}
      </div>
    </div>
  );
};
