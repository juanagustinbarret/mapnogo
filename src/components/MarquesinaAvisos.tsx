import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Megaphone, MapPin, Clock, CalendarDays, ChevronRight } from 'lucide-react';
import { textoFechaEvento, textoHorarioEvento } from '@/lib/eventos';
import { FichaEvento } from '@/components/FichaEvento';

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

  // Ficha del evento tocado (o del que llega en el link compartido: ?evento=id)
  const [parametros, setParametros] = useSearchParams();
  const [abierto, setAbierto] = useState<Evento | null>(null);
  const idCompartido = parametros.get('evento');

  useEffect(() => {
    if (!idCompartido || abierto) return;
    const evento = eventosActivos.find((ev) => ev.id === idCompartido);
    if (evento) setAbierto(evento);
  }, [idCompartido, eventosActivos, abierto]);

  const cerrarFicha = useCallback(() => {
    setAbierto(null);
    if (parametros.has('evento')) {
      const siguientes = new URLSearchParams(parametros);
      siguientes.delete('evento');
      setParametros(siguientes, { replace: true });
    }
  }, [parametros, setParametros]);

  if (eventosActivos.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-gray-900 p-4 rounded-3xl shadow-lg border border-amber-300/50 space-y-3">
      {eventosActivos.map((ev) => (
        <div key={ev.id} className="relative flex items-start gap-3.5 rounded-2xl hover:bg-white/10 transition focus-within:ring-2 focus-within:ring-gray-900/60">
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
              {/* Toda la tarjeta abre la ficha (el botón se estira sobre ella) */}
              <button
                type="button"
                onClick={() => setAbierto(ev)}
                aria-haspopup="dialog"
                className="text-left after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
              >
                {ev.titulo}
              </button>
            </h3>

            {ev.descripcion && (
              <p className="text-xs font-semibold text-gray-800 leading-relaxed line-clamp-2">
                {ev.descripcion}
              </p>
            )}

            <p className="inline-flex items-center gap-0.5 text-[11px] font-black text-gray-900/80" aria-hidden="true">
              Ver info y cómo llegar <ChevronRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </div>
      ))}

      <FichaEvento evento={abierto} onClose={cerrarFicha} />
    </div>
  );
};