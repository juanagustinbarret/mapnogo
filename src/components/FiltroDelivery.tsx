import React, { useState } from 'react';
import { Bike, CalendarClock } from 'lucide-react';
import { DIAS_SEMANA, aHora, aMinutos, type MomentoArgentina } from '@/lib/delivery';

interface FiltroDeliveryProps {
  activo: boolean;
  onCambiarActivo: (activo: boolean) => void;
  /** null = ahora */
  momento: MomentoArgentina | null;
  momentoAhora: MomentoArgentina;
  onCambiarMomento: (momento: MomentoArgentina | null) => void;
  anchoCompleto?: boolean;
}

// Botón "Delivery activo" (mismo estilo que "Abiertos Ahora") con la opción
// de elegir otro día y hora para planificar ("Delivery a las 21:30").
export const FiltroDelivery: React.FC<FiltroDeliveryProps> = ({
  activo,
  onCambiarActivo,
  momento,
  momentoAhora,
  onCambiarMomento,
  anchoCompleto = false,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(momento?.dia ?? momentoAhora.dia);
  const [hora, setHora] = useState(aHora(momento?.minutos ?? momentoAhora.minutos));

  const etiqueta = momento
    ? `Delivery ${momento.dia === momentoAhora.dia ? '' : `el ${DIAS_SEMANA[momento.dia].toLowerCase()} `}a las ${aHora(momento.minutos)}`
    : 'Delivery activo';

  const claseBase = `text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 ${
    activo
      ? 'bg-green-600 text-white shadow-sm'
      : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
  }`;

  return (
    <div className={`relative flex gap-1 ${anchoCompleto ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-pressed={activo}
        onClick={() => onCambiarActivo(!activo)}
        className={`${claseBase} px-3.5 py-1.5 ${anchoCompleto ? 'flex-1 py-2' : ''}`}
      >
        <Bike className="w-3.5 h-3.5" aria-hidden="true" /> {activo ? `✓ ${etiqueta}` : etiqueta}
      </button>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label="Elegir día y hora del delivery"
        title="Elegir día y hora"
        className={`${claseBase} px-2.5 ${anchoCompleto ? 'py-2' : 'py-1.5'}`}
      >
        <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {abierto && (
        <div className="absolute z-20 top-full mt-1 right-0 w-64 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl space-y-2 text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-200">¿Cuándo querés pedir?</p>
          <div className="flex gap-2">
            <select
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              aria-label="Día"
              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900"
            >
              {DIAS_SEMANA.map((nombre, i) => (
                <option key={nombre} value={i}>
                  {nombre}
                  {i === momentoAhora.dia ? ' (hoy)' : ''}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              aria-label="Hora"
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900"
            />
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onCambiarMomento(null);
                setAbierto(false);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 font-bold"
            >
              Ahora
            </button>
            <button
              type="button"
              disabled={Number.isNaN(aMinutos(hora))}
              onClick={() => {
                onCambiarMomento({ dia, minutos: aMinutos(hora) });
                onCambiarActivo(true);
                setAbierto(false);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50"
            >
              Ver delivery a esa hora
            </button>
          </div>
          <p className="text-[10px] text-gray-500">Horario de Argentina.</p>
        </div>
      )}
    </div>
  );
};
