import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, AlertTriangle, Calendar, ChevronRight, X } from 'lucide-react';

interface AvisoLocal {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: 'servicios' | 'municipal' | 'cultura' | 'alerta';
  prioritario: boolean;
}

export const MarquesinaAvisos: React.FC = () => {
  const [avisos, setAvisos] = useState<AvisoLocal[]>([]);
  const [modalAviso, setModalAviso] = useState<AvisoLocal | null>(null);

  useEffect(() => {
    const fetchAvisos = async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('avisos_locales')
        .select('*')
        .eq('activo', true)
        .or(`fecha_expiracion.is.null,fecha_expiracion.gte.${hoy}`)
        .order('prioritario', { ascending: false });

      if (!error && data) {
        setAvisos(data);
      }
    };

    fetchAvisos();
  }, []);

  if (avisos.length === 0) return null;

  const prioritario = avisos.find((a) => a.prioritario) || avisos[0];

  return (
    <>
      {/* BANNER MARQUESINA DESTACADO */}
      <div
        onClick={() => setModalAviso(prioritario)}
        className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-3 sm:p-3.5 text-gray-950 shadow-md flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 transition border border-amber-300"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1.5 bg-gray-950/10 rounded-xl shrink-0">
            {prioritario.categoria === 'alerta' ? (
              <AlertTriangle className="w-4 h-4 text-gray-950 animate-bounce" />
            ) : prioritario.categoria === 'cultura' ? (
              <Calendar className="w-4 h-4 text-gray-950" />
            ) : (
              <Megaphone className="w-4 h-4 text-gray-950" />
            )}
          </div>

          <div className="truncate">
            <span className="text-[10px] font-black uppercase tracking-wider bg-gray-950/15 px-2 py-0.5 rounded-md mr-2">
              Aviso de la Ciudad
            </span>
            <strong className="text-xs sm:text-sm font-black truncate">{prioritario.titulo}</strong>
          </div>
        </div>

        <button className="text-xs font-black flex items-center gap-0.5 shrink-0 bg-gray-950 text-white px-2.5 py-1 rounded-xl shadow-sm">
          Ver <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* MODAL DETALLE DE AVISO / EVENTO */}
      {modalAviso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start border-b dark:border-gray-700 pb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {modalAviso.categoria}
              </span>
              <button onClick={() => setModalAviso(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-black text-gray-900 dark:text-white">{modalAviso.titulo}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {modalAviso.descripcion}
            </p>

            <div className="pt-3 border-t dark:border-gray-700 text-right">
              <button
                onClick={() => setModalAviso(null)}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};