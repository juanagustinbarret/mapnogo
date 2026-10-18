import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { hoyArgentina } from '@/lib/fechasArgentina';
import { ATAJOS_PERIODO, describirRango, rangoDeAtajo, validarRango, type AtajoPeriodo, type RangoFechas } from '@/lib/rangosFechas';

export interface Periodo {
  atajo: AtajoPeriodo;
  rango: RangoFechas;
}

export const periodoDeAtajo = (atajo: Exclude<AtajoPeriodo, 'personalizado'>): Periodo => ({
  atajo,
  rango: rangoDeAtajo(atajo),
});

// Atajos (hoy, 7 días, 30 días, este mes, mes anterior) + rango personalizado.
// Los días se cuentan en hora de Argentina.
export const SelectorPeriodo: React.FC<{ valor: Periodo; onCambio: (p: Periodo) => void }> = ({ valor, onCambio }) => {
  const [borrador, setBorrador] = useState<RangoFechas>(valor.rango);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyArgentina();

  const aplicarPersonalizado = (rango: RangoFechas) => {
    setBorrador(rango);
    const problema = validarRango(rango, hoy);
    setError(problema);
    if (!problema) onCambio({ atajo: 'personalizado', rango });
  };

  const claseBoton = (activo: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shrink-0 ${
      activo ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
    }`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
        {ATAJOS_PERIODO.map(({ atajo, etiqueta }) => (
          <button
            key={atajo}
            type="button"
            aria-pressed={valor.atajo === atajo}
            onClick={() => {
              setError(null);
              const periodo = periodoDeAtajo(atajo);
              setBorrador(periodo.rango);
              onCambio(periodo);
            }}
            className={claseBoton(valor.atajo === atajo)}
          >
            {etiqueta}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={valor.atajo === 'personalizado'}
          onClick={() => onCambio({ atajo: 'personalizado', rango: valor.rango })}
          className={claseBoton(valor.atajo === 'personalizado')}
        >
          Personalizado
        </button>
      </div>

      {valor.atajo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="space-y-1">
            <span className="block font-semibold text-gray-500">Desde</span>
            <input
              type="date"
              max={hoy}
              value={borrador.desde}
              onChange={(e) => aplicarPersonalizado({ ...borrador, desde: e.target.value })}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
            />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-gray-500">Hasta</span>
            <input
              type="date"
              max={hoy}
              value={borrador.hasta}
              onChange={(e) => aplicarPersonalizado({ ...borrador, hasta: e.target.value })}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
            />
          </label>
        </div>
      )}

      {error ? (
        <p className="text-[11px] font-semibold text-red-600" role="alert">{error}</p>
      ) : (
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <CalendarDays className="w-3 h-3" aria-hidden="true" /> Período: {describirRango(valor.rango)} (hora de Argentina)
        </p>
      )}
    </div>
  );
};
