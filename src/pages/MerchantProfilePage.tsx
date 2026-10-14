import React, { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (user) {
      fetchComercioYHorarios();
    }
  }, [user]);

  const fetchComercioYHorarios = async () => {
    const { data: c } = await supabase.from('comercios').select('*').eq('propietario_id', user?.id).single();
    if (c) {
      setComercio(c);
      const { data: h } = await supabase
        .from('horarios_atencion')
        .select('*')
        .eq('comercio_id', c.id)
        .order('dia_semana', { ascending: true });
      if (h) setHorarios(h);
    }
  };

  const handleAddHorario = (diaIndex: number) => {
    const nuevoTurno: TurnoHorario = {
      dia_semana: diaIndex,
      hora_apertura: '08:00',
      hora_cierre: '12:00',
      activo: true,
    };
    setHorarios([...horarios, nuevoTurno]);
  };

  const handleUpdateHorario = (index: number, campo: 'hora_apertura' | 'hora_cierre', valor: string) => {
    const copia = [...horarios];
    copia[index][campo] = valor;
    setHorarios(copia);
  };

  const handleDeleteHorario = async (index: number, id?: string) => {
    if (id) {
      await supabase.from('horarios_atencion').delete().eq('id', id);
    }
    const copia = horarios.filter((_, i) => i !== index);
    setHorarios(copia);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;
    setLoading(true);
    setSuccess(false);

    // 1. Guardar datos generales del comercio
    const { error: errComercio } = await supabase
      .from('comercios')
      .update({
        descripcion_corta: comercio.descripcion_corta,
        direccion: comercio.direccion,
        whatsapp: comercio.whatsapp,
      })
      .eq('id', comercio.id);

    // 2. Guardar/Actualizar horarios de atención
    if (!errComercio) {
      // Reemplazamos/Insertamos los turnos asociados
      for (const h of horarios) {
        if (h.id) {
          await supabase
            .from('horarios_atencion')
            .update({
              hora_apertura: h.hora_apertura,
              hora_cierre: h.hora_cierre,
            })
            .eq('id', h.id);
        } else {
          await supabase.from('horarios_atencion').insert({
            comercio_id: comercio.id,
            dia_semana: h.dia_semana,
            hora_apertura: h.hora_apertura,
            hora_cierre: h.hora_cierre,
            activo: true,
          });
        }
      }
      setSuccess(true);
      fetchComercioYHorarios();
    }

    setLoading(false);
  };

  if (!comercio) return <div className="p-8 text-center text-gray-500">Cargando perfil...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/panel" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Volver al panel comercial
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Store className="w-6 h-6 text-brand-600" /> Modificar Datos del Comercio
      </h1>

      {success && (
        <div className="p-3 bg-green-100 text-green-800 rounded-xl text-sm font-semibold">
          ¡Información y horarios guardados correctamente!
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nombre Comercial</label>
            <input type="text" disabled value={comercio.nombre} className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">WhatsApp de Atención</label>
            <input
              type="text"
              value={comercio.whatsapp}
              onChange={(e) => setComercio({ ...comercio, whatsapp: e.target.value })}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">Dirección del Local (Nogoyá)</label>
            <input
              type="text"
              value={comercio.direccion}
              onChange={(e) => setComercio({ ...comercio, direccion: e.target.value })}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">Descripción Breve</label>
            <input
              type="text"
              value={comercio.descripcion_corta}
              onChange={(e) => setComercio({ ...comercio, descripcion_corta: e.target.value })}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>

        {/* MÓDULO DE EDICIÓN DE HORARIOS CON INPUT TIME */}
        <div className="pt-4 border-t dark:border-gray-700 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" /> Configuración de Horarios de Atención
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diasSemana.map((dia, idx) => {
              return (
                <div key={dia} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-700 dark:text-gray-300">{dia}</span>
                    <button
                      type="button"
                      onClick={() => handleAddHorario(idx)}
                      className="p-1 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir turno
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {horarios.map((h, i) => {
                      if (h.dia_semana !== idx) return null;
                      return (
                        <div key={i} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 border dark:border-gray-700 rounded-xl">
                          <input
                            type="time"
                            value={h.hora_apertura}
                            onChange={(e) => handleUpdateHorario(i, 'hora_apertura', e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                          />
                          <span className="text-xs text-gray-400">a</span>
                          <input
                            type="time"
                            value={h.hora_cierre}
                            onChange={(e) => handleUpdateHorario(i, 'hora_cierre', e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteHorario(i, h.id)}
                            className="text-red-500 hover:text-red-700 ml-auto p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>
    </div>
  );
};