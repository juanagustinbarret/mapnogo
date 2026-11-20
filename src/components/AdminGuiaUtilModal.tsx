import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MapPinPicker } from '@/components/MapPinPicker';
import { X, Plus, Trash2, Edit2, Phone, MapPin, ShieldAlert, Loader2, Save, CheckCircle } from 'lucide-react';

interface GuiaItem {
  id: string;
  nombre: string;
  categoria: string;
  telefono: string;
  direccion: string;
  urgencia: boolean;
  orden: number;
  latitud?: number | null;
  longitud?: number | null;
}

interface AdminGuiaUtilModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminGuiaUtilModal: React.FC<AdminGuiaUtilModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<GuiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado del formulario para nuevo o edición
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Emergencias');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [urgencia, setUrgencia] = useState(false);
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guia_util')
      .select('*')
      .order('urgencia', { ascending: false })
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditId(null);
    setNombre('');
    setCategoria('Emergencias');
    setTelefono('');
    setDireccion('');
    setUrgencia(false);
    setLatitud(null);
    setLongitud(null);
  };

  const handleEdit = (item: GuiaItem) => {
    setEditId(item.id);
    setNombre(item.nombre);
    setCategoria(item.categoria);
    setTelefono(item.telefono);
    setDireccion(item.direccion);
    setUrgencia(item.urgencia);
    setLatitud(item.latitud ?? null);
    setLongitud(item.longitud ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        categoria,
        telefono: telefono.trim(),
        direccion: direccion.trim() || 'Nogoyá, Entre Ríos',
        urgencia,
        latitud,
        longitud,
      };

      if (editId) {
        const { error } = await supabase.from('guia_util').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guia_util').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      await fetchItems();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Verifica la tabla guia_util';
      alert('Error al guardar: ' + mensaje);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, itemNombre: string) => {
    if (!window.confirm(`¿Eliminar "${itemNombre}" de la Guía Útil?`)) return;

    try {
      const { error } = await supabase.from('guia_util').delete().eq('id', id);
      if (error) throw error;
      await fetchItems();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      alert('Error al eliminar: ' + mensaje);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Administrar Guía Útil de Nogoyá</h3>
              <p className="text-xs text-sky-100">Gestioná los teléfonos de emergencia, centros de salud, iglesias y dependencias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* FORMULARIO ALTA / EDICIÓN */}
          <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                {editId ? <><Edit2 className="w-4 h-4 text-sky-600" /> Editando Registro</> : <><Plus className="w-4 h-4 text-sky-600" /> Agregar Nuevo Contacto Útil</>}
              </h4>
              {editId && (
                <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:underline">
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Hospital San Blas / Parroquia..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Categoría *</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="Emergencias">Emergencias</option>
                  <option value="Salud">Salud</option>
                  <option value="Trámites y Municipio">Trámites y Municipio</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Iglesias y Culto">Iglesias y Culto</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 100 / 03435-421234"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Dirección / Referencia</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Calle San Martín 800, Nogoyá"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
                  <input
                    type="checkbox"
                    checked={urgencia}
                    onChange={(e) => setUrgencia(e.target.checked)}
                    className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  🚨 Es Urgencia
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>

            {/* Selector de Pin en el Mapa */}
            <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Ubicación exacta en el mapa (para "Cómo llegar" y mapa principal)</span>
                {latitud !== null && longitud !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setLatitud(null);
                      setLongitud(null);
                    }}
                    className="text-[11px] text-red-500 hover:underline font-semibold"
                  >
                    Quitar pin
                  </button>
                )}
              </div>
              <MapPinPicker
                lat={latitud}
                lng={longitud}
                direccion={direccion}
                onChange={(newLat, newLng) => {
                  setLatitud(newLat);
                  setLongitud(newLng);
                }}
              />
            </div>
          </form>

          {/* LISTADO DE ITEMS */}
          <div>
            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">
              Registros Cargados ({items.length})
            </h4>

            {loading ? (
              <div className="py-8 flex justify-center text-sky-600">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No hay elementos cargados en la Guía Útil.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.urgencia
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : item.categoria === 'Iglesias y Culto'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                        }`}>
                          {item.categoria}
                        </span>
                        {item.latitud && item.longitud && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold inline-flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Con Pin
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.nombre}</h5>
                      <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                        {item.telefono && (
                          <span className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300">
                            <Phone className="w-3 h-3 text-sky-600" /> {item.telefono}
                          </span>
                        )}
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" /> {item.direccion}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nombre)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
