
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { Save, Store, Clock, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TurnoHorario {
  id?: string;
  comercio_id?: string;
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
  activo: boolean;
}

export const MerchantProfilePage: React.FC = () => {
  const { user } = useAuth();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [horarios, setHorarios] = useState<TurnoHorario[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const diasSemana = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  const fetchComercioYHorarios = useCallback(async () => {
    if (!user) {
      setFetching(false);
      return;
    }

    setFetching(true);
    setError('');

    try {
      // Primero buscamos el comercio vinculado al usuario.
      const { data: porPropietario, error: errorPropietario } =
        await supabase
          .from('comercios')
          .select('*')
          .eq('propietario_id', user.id)
          .maybeSingle();

      if (errorPropietario) {
        throw errorPropietario;
      }

      let comercioEncontrado = porPropietario;

      // Si no está vinculado, intentamos encontrarlo por el correo
      // comercial de la cuenta autenticada.
      if (!comercioEncontrado && user.email) {
        const { data: porEmail, error: errorEmail } = await supabase
          .from('comercios')
          .select('*')
          .ilike('email_comercial', user.email)
          .maybeSingle();

        if (errorEmail) {
          throw errorEmail;
        }

        comercioEncontrado = porEmail;
      }

      if (!comercioEncontrado) {
        setComercio(null);
        setHorarios([]);
        setError(
          'No encontramos un comercio vinculado a tu cuenta. Verificá que hayas ingresado con el usuario correcto o contactá al administrador.'
        );
        return;
      }

      setComercio(comercioEncontrado as Comercio);

      const { data: datosHorarios, error: errorHorarios } = await supabase
        .from('horarios_atencion')
        .select('*')
        .eq('comercio_id', comercioEncontrado.id)
        .order('dia_semana', { ascending: true });

      if (errorHorarios) {
        throw errorHorarios;
      }

      setHorarios((datosHorarios ?? []) as TurnoHorario[]);
    } catch (err) {
      console.error('Error cargando el perfil comercial:', err);
      setError(
        'No pudimos cargar los datos del comercio. Revisá tu conexión y los permisos de acceso e intentá nuevamente.'
      );
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchComercioYHorarios();
  }, [fetchComercioYHorarios]);

  const handleAddHorario = (diaIndex: number) => {
    setSuccess(false);
    setHorarios((actuales) => [
      ...actuales,
      {
        dia_semana: diaIndex,
        hora_apertura: '08:00',
        hora_cierre: '12:00',
        activo: true,
      },
    ]);
  };

  const handleUpdateHorario = (
    index: number,
    campo: 'hora_apertura' | 'hora_cierre',
    valor: string
  ) => {
    setSuccess(false);
    setHorarios((actuales) =>
      actuales.map((horario, i) =>
        i === index ? { ...horario, [campo]: valor } : horario
      )
    );
  };

  const handleDeleteHorario = async (index: number, id?: string) => {
    setError('');
    setSuccess(false);

    if (id) {
      const horario = horarios[index];

      if (!horario || !comercio) return;

      const { error: errorEliminar } = await supabase
        .from('horarios_atencion')
        .delete()
        .eq('id', id)
        .eq('comercio_id', comercio.id);

      if (errorEliminar) {
        console.error('Error eliminando horario:', errorEliminar);
        setError('No se pudo eliminar el horario. Intentá nuevamente.');
        return;
      }
    }

    setHorarios((actuales) => actuales.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!comercio || loading) return;

    setLoading(true);
    setSuccess(false);
    setError('');

    try {
      // 1. Guardar los datos generales del comercio.
      const { error: errorComercio } = await supabase
        .from('comercios')
        .update({
          descripcion_corta: comercio.descripcion_corta,
          direccion: comercio.direccion,
          whatsapp: comercio.whatsapp,
        })
        .eq('id', comercio.id);

      if (errorComercio) {
        throw errorComercio;
      }

      // 2. Guardar los horarios existentes y los nuevos.
      for (const horario of horarios) {
        if (
          !horario.hora_apertura ||
          !horario.hora_cierre
        ) {
          throw new Error('Completá la hora de apertura y cierre de cada turno.');
        }

        if (horario.hora_apertura >= horario.hora_cierre) {
          throw new Error(
            'La hora de cierre debe ser posterior a la hora de apertura en cada turno.'
          );
        }

        if (horario.id) {
          const { error: errorActualizar } = await supabase
            .from('horarios_atencion')
            .update({
              hora_apertura: horario.hora_apertura,
              hora_cierre: horario.hora_cierre,
              activo: horario.activo,
            })
            .eq('id', horario.id)
            .eq('comercio_id', comercio.id);

          if (errorActualizar) {
            throw errorActualizar;
          }
        } else {
          const { error: errorInsertar } = await supabase
            .from('horarios_atencion')
            .insert({
              comercio_id: comercio.id,
              dia_semana: horario.dia_semana,
              hora_apertura: horario.hora_apertura,
              hora_cierre: horario.hora_cierre,
              activo: horario.activo,
            });

          if (errorInsertar) {
            throw errorInsertar;
          }
        }
      }

      await fetchComercioYHorarios();
      setSuccess(true);
    } catch (err) {
      console.error('Error guardando el perfil comercial:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar todos los cambios. Revisá los permisos e intentá nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="p-8 text-center text-gray-500">
        Cargando perfil del comercio...
      </div>
    );
  }

  if (!comercio) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-5">
        <Link
          to="/panel"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel comercial
        </Link>

        <div className="p-5 rounded-xl border border-red-200 bg-red-50 text-red-800">
          <h1 className="font-bold mb-2">No pudimos abrir tu comercio</h1>
          <p className="text-sm">
            {error || 'No encontramos un comercio vinculado a tu cuenta.'}
          </p>
          <button
            type="button"
            onClick={() => void fetchComercioYHorarios()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold"
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/panel"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al panel comercial
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Store className="w-6 h-6 text-brand-600" />
        Modificar Datos del Comercio
      </h1>

      {success && (
        <div className="p-3 bg-green-100 text-green-800 rounded-xl text-sm font-semibold">
          ¡Información y horarios guardados correctamente!
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-100 text-red-800 rounded-xl text-sm font-semibold"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Nombre Comercial
            </label>
            <input
              type="text"
              disabled
              value={comercio.nombre ?? ''}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              WhatsApp de Atención
            </label>
            <input
              type="text"
              value={comercio.whatsapp ?? ''}
              onChange={(e) =>
                setComercio({ ...comercio, whatsapp: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">
              Dirección del Local (Nogoyá)
            </label>
            <input
              type="text"
              value={comercio.direccion ?? ''}
              onChange={(e) =>
                setComercio({ ...comercio, direccion: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">
              Descripción Breve
            </label>
            <input
              type="text"
              value={comercio.descripcion_corta ?? ''}
              onChange={(e) =>
                setComercio({
                  ...comercio,
                  descripcion_corta: e.target.value,
                })
              }
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="pt-4 border-t dark:border-gray-700 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" />
            Configuración de Horarios de Atención
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diasSemana.map((dia, idx) => (
              <div
                key={dia}
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-gray-700 dark:text-gray-300">
                    {dia}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddHorario(idx)}
                    className="p-1 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir turno
                  </button>
                </div>

                <div className="space-y-1.5">
                  {horarios.map((horario, i) => {
                    if (horario.dia_semana !== idx) return null;

                    return (
                      <div
                        key={horario.id ?? `nuevo-${idx}-${i}`}
                        className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 border dark:border-gray-700 rounded-xl"
                      >
                        <input
                          aria-label={`${dia}: hora de apertura`}
                          type="time"
                          value={horario.hora_apertura}
                          onChange={(e) =>
                            handleUpdateHorario(
                              i,
                              'hora_apertura',
                              e.target.value
                            )
                          }
                          className="min-w-0 w-full bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                        />
                        <span className="text-xs text-gray-400">a</span>
                        <input
                          aria-label={`${dia}: hora de cierre`}
                          type="time"
                          value={horario.hora_cierre}
                          onChange={(e) =>
                            handleUpdateHorario(
                              i,
                              'hora_cierre',
                              e.target.value
                            )
                          }
                          className="min-w-0 w-full bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar turno del ${dia}`}
                          onClick={() => void handleDeleteHorario(i, horario.id)}
                          className="text-red-500 hover:text-red-700 ml-auto p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>
    </div>
  );
};
