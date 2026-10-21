import React, { useState } from 'react';
import { CalendarClock, Truck } from 'lucide-react';
import { aHora, momentoDesdeFechaHora, textoMomentoElegido, type MomentoElegido } from '@/lib/delivery';
import { hoyArgentina, sumarDias } from '@/lib/fechasArgentina';

interface FiltroDeliveryProps {
  activo: boolean;
  onCambiarActivo: (activo: boolean) => void;
  /** null = sin día y hora elegidos */
  elegido: MomentoElegido | null;
  onElegir: (elegido: MomentoElegido | null) => void;
  /** Minuto actual del día en Argentina, para proponer la hora */
  minutosAhora: number;
}

// "Con Delivery" (como antes) + elegir fecha y hora: "¿quién tiene delivery
// el sábado a las 21:30?". Todo se calcula con los horarios cargados en
// NOGOMAP, en hora de Argentina.
export const FiltroDelivery: React.FC<FiltroDeliveryProps> = ({ activo, onCambiarActivo, elegido, onElegir, minutosAhora }) => {
  const hoy = hoyArgentina();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(elegido?.fecha ?? hoy);
  const [hora, setHora] = useState(elegido?.hora ?? aHora(minutosAhora));
  const candidato = momentoDesdeFechaHora(fecha, hora);

  const etiqueta = elegido ? `Delivery ${textoMomentoElegido(elegido, hoy)}` : 'Con Delivery';
  const clase = `px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
    activo
      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
      : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
  }`;
  const campo = 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white';

  return (
    <div className="relative flex gap-1">
      <button type="button" aria-pressed={activo} onClick={() => onCambiarActivo(!activo)} className={clase}>
        <Truck className="w-3.5 h-3.5" aria-hidden="true" /> {etiqueta}
      </button>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label="Elegir fecha y hora del delivery"
        title="¿Delivery otro día u hora?"
        className={`${clase} px-2.5`}
      >
        <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Delivery en otro día y hora"
          className="absolute z-[500] top-full mt-1 left-0 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl space-y-2 text-xs"
        >
          <p className="font-semibold text-gray-700 dark:text-gray-200">¿Cuándo querés pedir?</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] text-gray-500">Fecha</span>
              <input type="date" value={fecha} min={hoy} max={sumarDias(hoy, 60)} onChange={(e) => setFecha(e.target.value)} className={campo} />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-gray-500">Hora</span>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
            </label>
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onElegir(null);
                setFecha(hoy);
                setHora(aHora(minutosAhora));
                setAbierto(false);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 font-bold"
            >
              Ahora
            </button>
            <button
              type="button"
              disabled={!candidato}
              onClick={() => {
                onElegir(candidato);
                onCambiarActivo(true);
                setAbierto(false);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
            >
              Ver quién tiene delivery
            </button>
          </div>
          <p className="text-[10px] text-gray-500">Según los horarios que cargó cada comercio. Hora de Argentina.</p>
        </div>
      )}
    </div>
  );
};
