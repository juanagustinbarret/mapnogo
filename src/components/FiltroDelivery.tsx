// src/components/FiltroDelivery.tsx
import React, { useState } from 'react';
import { Bike, Clock, X } from 'lucide-react';
import {
  diasDelivery,
  horasDelivery,
  textoMomentoElegido,
  type MomentoElegido,
} from '@/lib/delivery';
import { hoyArgentina } from '@/lib/fechasArgentina';

interface FiltroDeliveryProps {
  activo: boolean;
  onCambiarActivo: (activo: boolean) => void;
  elegido: MomentoElegido | null;
  onElegir: (momento: MomentoElegido | null) => void;
  minutosAhora: number;
}

export const FiltroDelivery: React.FC<FiltroDeliveryProps> = ({
  activo,
  onCambiarActivo,
  elegido,
  onElegir,
}) => {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [dia, setDia] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // 0=Lunes, 6=Domingo
  });
  const [minutos, setMinutos] = useState<number>(20 * 60); // 20:00 por defecto

  const hoyIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const handleAplicar = () => {
    onElegir({ diaSemana: dia, minutosEnDia: minutos, instante: new Date() });
    onCambiarActivo(true);
    setModalAbierto(false);
  };

  const handleLimpiarHora = () => {
    onElegir(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* BOTÓN PRINCIPAL: CON DELIVERY */}
        <button
          type="button"
          onClick={() => {
            if (activo && elegido) {
              onElegir(null);
            } else {
              onCambiarActivo(!activo);
            }
          }}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
            activo
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
              : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          {elegido
            ? `Delivery ${textoMomentoElegido(elegido, hoyArgentina())}`
            : 'Con Delivery'}
        </button>

        {/* BOTÓN EXPLÍCITO DE CONSULTA */}
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className={`px-3.5 py-1.5 text-xs font-extrabold tracking-tight rounded-xl transition flex items-center gap-1.5 shrink-0 uppercase ${
            elegido
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Consultar qué comercios tienen delivery en un día u hora específico"
        >
          <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          <span>Consultar horario delivery</span>
        </button>

        {elegido && (
          <button
            type="button"
            onClick={handleLimpiarHora}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition"
            title="Volver a consultar delivery de ahora"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* MODAL COMPLETAMENTE CENTRADO Y RESPONSIVE EN MÓVILES */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setModalAbierto(false)}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Consultar Horario Delivery
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Día de la semana
                </label>
                <select
                  value={dia}
                  onChange={(e) => setDia(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {diasDelivery.map((d, i) => (
                    <option key={d} value={i}>
                      {d} {i === hoyIndex ? '(Hoy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Hora de entrega deseada
                </label>
                <select
                  value={minutos}
                  onChange={(e) => setMinutos(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {horasDelivery.map((h) => (
                    <option key={h.m} value={h.m}>
                      {h.t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAplicar}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                Consultar Comercios
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
