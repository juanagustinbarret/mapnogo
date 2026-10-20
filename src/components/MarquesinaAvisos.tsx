import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hoyArgentina } from '@/lib/fechasArgentina';
import { Calendar, Sparkles } from 'lucide-react';

interface Evento {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export const MarquesinaAvisos: React.FC = () => {
  const [eventosHoy, setEventosHoy] = useState<Evento[]>([]);

  useEffect(() => {
    const fetchEventos = async () => {
      const hoy = hoyArgentina();

      const { data } = await supabase
        .from('eventos')
        .select('*')
        .eq('activo', true)
        .lte('fecha_inicio', hoy)
        .gte('fecha_fin', hoy);

      if (data) setEventosHoy(data as Evento[]);
    };

    fetchEventos();
  }, []);

  if (eventosHoy.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-3.5 rounded-2xl shadow-md border border-amber-400/30 space-y-2">
      {eventosHoy.map((ev) => (
        <div key={ev.id} className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl shrink-0 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 text-[10px] uppercase font-black bg-white/20 px-2 py-0.5 rounded-full text-amber-100">
              <Calendar className="w-3 h-3" /> Evento Destacado
            </div>
            <h3 className="font-extrabold text-sm sm:text-base leading-tight mt-0.5">
              {ev.titulo}
            </h3>
            {ev.descripcion && (
              <p className="text-xs text-amber-100 mt-0.5 line-clamp-1">{ev.descripcion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};