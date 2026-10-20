import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, MapPin, Clock, CalendarDays } from 'lucide-react';
import { textoFechaEvento, textoHorarioEvento } from '@/lib/eventos';

interface Evento {
  id: string;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  ubicacion_texto?: string | null;
  imagen_url?: string | null;
  mostrar_desde?: string | null;
  mostrar_hasta?: string | null;
}

export const MarquesinaAvisos: React.FC = () => {
  const [eventosActivos, setEventosActivos] = useState<Evento[]>([]);

  useEffect(() => {
    const fetchEventos = async () => {
      const ahora = new Date().toISOString();

      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('activo', true)
        .lte('mostrar_desde', ahora)
        .gte('mostrar_hasta', ahora)
        .order('fecha_evento', { ascending: true });

      if (!error && data) {
        setEventosActivos(data as Evento[]);
      }
    };

    fetchEventos();

    const interval = setInterval(fetchEventos, 60000);
    return () => clearInterval(interval);
  }, []);

  if (eventosActivos.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-gray-900 p-4 rounded-3xl shadow-lg border border-amber-300/50 space-y-3">
      {eventosActivos.map((ev) => (
        <div key={ev.id} className="flex items-start gap-3.5">
          {/* Contenedor del ícono principal de evento / megáfono */}
          <div className="p-2.5 bg-gray-900 text-amber-400 rounded-2xl shrink-0 shadow-md mt-0.5 border border-gray-800">
            <Megaphone className="w-5 h-5 motion-safe:animate-bounce" aria-hidden="true" />
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            {/* Badges de fecha, hora y lugar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black bg-white/90 text-gray-900 px-2.5 py-0.5 rounded-full shadow-sm border border-white/60">
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                {textoFechaEvento(ev.fecha_evento)}
              </span>

              {ev.hora_inicio && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-white/90 text-gray-900 px-2.5 py-0.5 rounded-full shadow-sm border border-white/60">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {textoHorarioEvento(ev.hora_inicio, ev.hora_fin)}
                </span>
              )}

              {ev.ubicacion_texto && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-gray-900/10 text-gray-900 px-2.5 py-0.5 rounded-full border border-gray-900/10">
                  <MapPin className="w-3.5 h-3.5 text-gray-900" />
                  {ev.ubicacion_texto}
                </span>
              )}
            </div>

            {/* Título e información en texto negro destacado */}
            <h3 className="font-black text-base sm:text-lg text-gray-900 leading-tight">
              {ev.titulo}
            </h3>

            {ev.descripcion && (
              <p className="text-xs font-semibold text-gray-800 leading-relaxed line-clamp-2">
                {ev.descripcion}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};