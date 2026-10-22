import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { MOTIVOS_REPORTE, reportarFoto, type MotivoReporte } from '@/lib/fotosComercio';

interface Props {
  comercioId: string;
  foto: { url: string; fotoId?: string; indiceGaleria?: number };
  onCerrar: () => void;
}

// "Reportar foto" en la ficha: el reporte va a la cola de revisión del admin.
export const ReportarFoto: React.FC<Props> = ({ comercioId, foto, onCerrar }) => {
  const [motivo, setMotivo] = useState<MotivoReporte | ''>('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) return;
    setEnviando(true);
    const r = await reportarFoto({ comercio_id: comercioId, foto_id: foto.fotoId, indice_galeria: foto.indiceGaleria, motivo, detalle: detalle.trim() || undefined });
    setResultado(r.ok ? { ok: true, texto: r.mensaje ?? 'Gracias. Un administrador lo va a revisar.' } : { ok: false, texto: r.mensaje });
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-reportar" className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="titulo-reportar" className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-600" aria-hidden="true" /> Reportar foto
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {resultado?.ok ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400 font-semibold">{resultado.texto}</p>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">¿Qué problema tiene?</legend>
              {MOTIVOS_REPORTE.map((m) => (
                <label key={m.valor} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input type="radio" name="motivo" value={m.valor} checked={motivo === m.valor} onChange={() => setMotivo(m.valor)} />
                  {m.texto}
                </label>
              ))}
            </fieldset>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
              Detalle (opcional)
              <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900 dark:text-white" />
            </label>
            {resultado && !resultado.ok && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-semibold">{resultado.texto}</p>}
            <button type="submit" disabled={!motivo || enviando} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
