import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bike, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DIAS_SEMANA,
  es24Horas,
  fueraDelHorarioDelLocal,
  validarRangosDelDia,
  type RangoDelivery,
} from '@/lib/delivery';

interface Rango {
  hora_inicio: string;
  hora_fin: string;
}

interface EditorDeliveryProps {
  comercioId: string;
  tieneDelivery: boolean;
  /** Turnos del local, para avisar si el delivery cae fuera de ese horario */
  turnosLocal: Array<{ dia_semana: number; hora_apertura: string; hora_cierre: string; activo?: boolean }>;
  onGuardado?: (tieneDelivery: boolean) => void;
}

const vacio = (): Record<number, Rango[]> => Object.fromEntries(DIAS_SEMANA.map((_, i) => [i, []]));
const RANGO_24 = { hora_inicio: '00:00', hora_fin: '24:00' };

// "Tengo delivery": interruptor + rangos por día, con la misma estructura que
// los turnos del local (una tarjeta por día, uno o más rangos, agregar/quitar).
// Se guarda todo junto con "Guardar delivery".
export const EditorDelivery: React.FC<EditorDeliveryProps> = ({ comercioId, tieneDelivery, turnosLocal, onGuardado }) => {
  const [activo, setActivo] = useState(tieneDelivery);
  const [rangos, setRangos] = useState<Record<number, Rango[]>>(vacio);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => setActivo(tieneDelivery), [tieneDelivery]);

  useEffect(() => {
    let vigente = true;
    supabase
      .from('horarios_delivery')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('comercio_id', comercioId)
      .order('hora_inicio')
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          console.warn('[delivery] No se pudieron leer los horarios:', error.message);
          return;
        }
        const porDia = vacio();
        (data ?? []).forEach((r) => porDia[r.dia_semana].push({ hora_inicio: r.hora_inicio.slice(0, 5), hora_fin: r.hora_fin.slice(0, 5) }));
        setRangos(porDia);
      });
    return () => {
      vigente = false;
    };
  }, [comercioId]);

  const errores = Object.fromEntries(DIAS_SEMANA.map((_, d) => [d, validarRangosDelDia(rangos[d])])) as Record<
    number,
    ReturnType<typeof validarRangosDelDia>
  >;
  const hayErrores = activo && Object.values(errores).some((e) => e.length > 0);

  const cambiar = (dia: number, indice: number, campo: keyof Rango, valor: string) =>
    setRangos((r) => ({ ...r, [dia]: r[dia].map((x, i) => (i === indice ? { ...x, [campo]: valor } : x)) }));

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true);
    setMensaje(null);
    try {
      // Con el interruptor apagado solo se cambia la marca: los rangos quedan
      // guardados para cuando lo vuelvan a activar.
      if (activo) {
        // Reemplazar los rangos: copia de seguridad, borrar, insertar y, si el
        // alta falla, restaurar lo anterior.
        const { data: anteriores, error: errorLectura } = await supabase
          .from('horarios_delivery')
          .select('comercio_id, dia_semana, hora_inicio, hora_fin')
          .eq('comercio_id', comercioId);
        if (errorLectura) throw errorLectura;

        const nuevos = DIAS_SEMANA.flatMap((_, dia) =>
          rangos[dia].map((r) => ({ comercio_id: comercioId, dia_semana: dia, ...r })),
        );
        const { error: errorBorrado } = await supabase.from('horarios_delivery').delete().eq('comercio_id', comercioId);
        if (errorBorrado) throw errorBorrado;
        if (nuevos.length) {
          const { error: errorAlta } = await supabase.from('horarios_delivery').insert(nuevos);
          if (errorAlta) {
            if (anteriores?.length) await supabase.from('horarios_delivery').insert(anteriores);
            throw errorAlta;
          }
        }
      }

      const { error: errorComercio } = await supabase.from('comercios').update({ tiene_delivery: activo }).eq('id', comercioId);
      if (errorComercio) throw errorComercio;
      setMensaje({ tipo: 'ok', texto: activo ? '✅ Horarios de delivery guardados.' : 'Delivery desactivado.' });
      onGuardado?.(activo);
    } catch (e: any) {
      console.error('[delivery] No se pudo guardar', e);
      const sinTabla = e?.code === '42P01' || e?.code === 'PGRST205' || e?.code === '42703' || e?.code === 'PGRST204';
      setMensaje({
        tipo: 'error',
        texto: sinTabla
          ? 'Todavía no está habilitado el delivery en la base de datos (falta correr el SQL). Avisale al administrador.'
          : `No se pudo guardar: ${e?.message ?? e}`,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-700 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bike className="w-5 h-5 text-brand-600" /> Delivery
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Horarios de envío, independientes de los de atención. Un rango como 20:00–02:00 cuenta para el día en que empieza.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-800 dark:text-gray-100">
          <input
            type="checkbox"
            role="switch"
            aria-checked={activo}
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="sr-only peer"
          />
          <span className="w-10 h-6 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-brand-600 relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
          Tengo delivery
        </label>
      </div>

      {activo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIAS_SEMANA.map((dia, d) => {
            const lista = rangos[d];
            const todoElDia = lista.length === 1 && es24Horas(lista[0]);
            return (
              <div key={dia} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-gray-800 dark:text-white">{dia}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRangos((r) => ({ ...r, [d]: todoElDia ? [] : [RANGO_24] }))}
                      aria-pressed={todoElDia}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${todoElDia ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                      24 hs
                    </button>
                    {!todoElDia && (
                      <button
                        type="button"
                        onClick={() => setRangos((r) => ({ ...r, [d]: [...r[d], { hora_inicio: '20:00', hora_fin: '23:00' }] }))}
                        className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3 inline mr-1" /> Agregar rango
                      </button>
                    )}
                  </div>
                </div>

                {lista.length === 0 && <p className="text-xs text-gray-500">Sin delivery este día.</p>}
                {todoElDia && <p className="text-xs font-semibold text-brand-700 dark:text-brand-100">Delivery las 24 horas.</p>}

                {!todoElDia &&
                  lista.map((rango, i) => {
                    const error = errores[d].find((e) => e.indice === i);
                    const aviso =
                      !error && fueraDelHorarioDelLocal({ dia_semana: d, ...rango } as RangoDelivery, turnosLocal);
                    return (
                      <div key={i} className="border-t dark:border-gray-700 pt-3 space-y-1.5">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <label className="text-xs text-gray-500">
                            Desde
                            <input
                              type="time"
                              value={rango.hora_inicio}
                              onChange={(e) => cambiar(d, i, 'hora_inicio', e.target.value)}
                              className="mt-1 w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                            />
                          </label>
                          <label className="text-xs text-gray-500">
                            Hasta
                            <input
                              type="time"
                              value={rango.hora_fin === '24:00' ? '00:00' : rango.hora_fin}
                              onChange={(e) => cambiar(d, i, 'hora_fin', e.target.value)}
                              className="mt-1 w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setRangos((r) => ({ ...r, [d]: r[d].filter((_, j) => j !== i) }))}
                            className="p-2 text-red-500 hover:text-red-700"
                            aria-label={`Quitar rango ${rango.hora_inicio}–${rango.hora_fin} del ${dia}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {error && (
                          <p className="text-[11px] font-semibold text-red-600" role="alert">
                            {error.mensaje}
                          </p>
                        )}
                        {aviso && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Este rango queda fuera del horario de atención del local. Se permite igual.
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      {mensaje && (
        <p role="status" className={`text-xs font-semibold ${mensaje.tipo === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-red-600'}`}>
          {mensaje.texto}
        </p>
      )}

      <button
        type="button"
        disabled={guardando || hayErrores}
        onClick={() => void guardar()}
        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" /> {guardando ? 'Guardando...' : hayErrores ? 'Corregí los errores para guardar' : 'Guardar delivery'}
      </button>
    </div>
  );
};
