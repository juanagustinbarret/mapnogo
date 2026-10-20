import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FichaGoogleAdmin } from '@/components/FichaGoogleAdmin';
import { estadoGoogle } from '@/lib/resenasGoogle';
import { guardarVinculoGoogle, type VinculoGoogle } from '@/services/googleAdmin';
import type { Comercio } from '@/types/database.types';

interface Props {
  comercios: Comercio[];
  onCerrar: () => void;
  onGuardado: (comercioId: string, vinculo: VinculoGoogle) => void;
}

/**
 * Vincular los comercios existentes de a uno: para cada comercio sin
 * vincular se buscan candidatos en Google (una búsqueda por comercio, al
 * llegar a él) y el admin confirma cuál es. Nunca se vincula solo.
 */
export const VincularGoogleLote: React.FC<Props> = ({ comercios, onCerrar, onGuardado }) => {
  // Se fija la lista al abrir: los que se vinculan no desaparecen mientras se recorre
  const pendientes = useMemo(() => comercios.filter((c) => estadoGoogle(c) === 'no_vinculado'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [indice, setIndice] = useState(0);
  const [hechos, setHechos] = useState<Record<string, VinculoGoogle>>({});

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const actual = pendientes[indice];
  const valor: VinculoGoogle = actual
    ? hechos[actual.id] ?? { placeId: actual.google_place_id ?? null, estado: estadoGoogle(actual) }
    : { placeId: null, estado: 'no_vinculado' };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-lote-google">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-lote-google" className="text-lg font-black text-gray-900 dark:text-white">Vincular comercios con Google</h2>
            <p className="text-xs text-gray-500">
              {pendientes.length === 0
                ? 'No hay comercios sin vincular.'
                : `Comercio ${Math.min(indice + 1, pendientes.length)} de ${pendientes.length} sin vincular. Confirmá el correcto o marcá que no tiene ficha.`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {actual && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700">
              <p className="font-bold text-gray-900 dark:text-white">{actual.nombre}</p>
              <p className="text-xs text-gray-500">
                {actual.direccion} · {actual.rubro?.nombre ?? 'Sin rubro'}
              </p>
            </div>
            <FichaGoogleAdmin
              key={actual.id}
              buscarAlAbrir={!hechos[actual.id]}
              comercio={{ id: actual.id, nombre: actual.nombre, direccion: actual.direccion, telefono: actual.telefono || actual.whatsapp, rubro: actual.rubro?.nombre }}
              valor={valor}
              onCambiar={async (vinculo) => {
                await guardarVinculoGoogle(actual.id, vinculo);
                setHechos((h) => ({ ...h, [actual.id]: vinculo }));
                onGuardado(actual.id, vinculo);
              }}
            />
          </div>
        )}

        {pendientes.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t dark:border-gray-700">
            <button type="button" disabled={indice === 0} onClick={() => setIndice((i) => i - 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-700 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anterior
            </button>
            <span className="text-xs text-gray-500">{Object.keys(hechos).length} resueltos</span>
            {indice < pendientes.length - 1 ? (
              <button type="button" onClick={() => setIndice((i) => i + 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                {hechos[actual.id] ? 'Siguiente' : 'Saltar'} <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white">
                Terminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
