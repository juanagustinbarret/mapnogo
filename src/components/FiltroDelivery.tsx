// src/components/FiltroDelivery.tsx
import React, { useState } from 'react';
import { Bike, Clock, X } from 'lucide-react';
import {
  aHora,
  momentoDesdeFechaHora,
  textoMomentoElegido,
  type MomentoElegido,
} from '@/lib/delivery';
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

export const FiltroDelivery: React.FC<FiltroDeliveryProps> = ({
  activo,
  onCambiarActivo,
  elegido,
  onElegir,
  minutosAhora,
}) => {
  const hoy = hoyArgentina();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(elegido?.fecha ?? hoy);
  const [hora, setHora] = useState(elegido?.hora ?? aHora(minutosAhora));

  const candidato = momentoDesdeFechaHora(fecha, hora);

  const etiqueta = elegido
    ? `Delivery ${textoMomentoElegido(elegido, hoy)}`
    : 'Con Delivery';

  const campoClase =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* BOTÓN 1: CON DELIVERY */}
        <button
          type="button"
          aria-pressed={activo}
          onClick={() => onCambiarActivo(!activo)}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
            activo
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
              : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Bike className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{etiqueta}</span>
        </button>

        {/* BOTÓN 2: CONSULTAR HORARIO DELIVERY */}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-expanded={abierto}
          aria-label="Elegir fecha y hora del delivery"
          title="¿Delivery otro día u hora?"
          className={`px-3.5 py-1.5 text-xs font-extrabold tracking-tight rounded-xl transition flex items-center gap-1.5 shrink-0 uppercase ${
            elegido
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
          <span>Consultar horario delivery</span>
        </button>

        {elegido && (
          <button
            type="button"
            onClick={() => {
              onElegir(null);
              setFecha(hoy);
              setHora(aHora(minutosAhora));
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition"
            title="Volver a la hora actual"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* MODAL RESPONSIVE CENTRADO (Z-INDEX 2000 PARA PWA Y MÓVILES) */}
      {abierto && (
        <div
          role="dialog"
          aria-label="Delivery en otro día y hora"
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setAbierto(false)}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Consultar Horario Delivery
              </h3>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Fecha de pedido
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={hoy}
                  max={sumarDias(hoy, 60)}
                  onChange={(e) => setFecha(e.target.value)}
                  className={campoClase}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Hora aproximada
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className={campoClase}
                />
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-3 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  onElegir(null);
                  setFecha(hoy);
                  setHora(aHora(minutosAhora));
                  setAbierto(false);
                }}
                className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Ahora
              </button>
              <button
                type="button"
                disabled={!candidato}
                onClick={() => {
                  if (candidato) {
                    onElegir(candidato);
                    onCambiarActivo(true);
                    setAbierto(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 shadow-sm transition"
              >
                Ver quién tiene delivery
              </button>
            </div>

            <p className="text-[10px] text-gray-500 text-center">
              Horarios cargados por cada comercio (Hora de Argentina).
            </p>
          </div>
        </div>
      )}
    </>
  );
};
