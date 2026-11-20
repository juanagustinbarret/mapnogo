import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { X, Plus, Trash2, Edit2, Phone, MapPin, ShieldAlert, Loader2, Save, CheckCircle2, Search, RotateCcw } from 'lucide-react';

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

// Centro de Nogoyá, Entre Ríos
const NOGOYA_CENTER: [number, number] = [-32.3935, -59.7892];

export const AdminGuiaUtilModal: React.FC<AdminGuiaUtilModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<GuiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Estado del formulario
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Emergencias');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [urgencia, setUrgencia] = useState(false);
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);

  // Refs de Leaflet para el mini-mapa arrastrable
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  // Inicializar mapa Leaflet cuando abre el modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const initialLat = latitud ?? NOGOYA_CENTER[0];
      const initialLng = longitud ?? NOGOYA_CENTER[1];

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'custom-guia-picker-pin',
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#0284c7;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLatitud(Number(pos.lat.toFixed(6)));
        setLongitud(Number(pos.lng.toFixed(6)));
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setLatitud(Number(e.latlng.lat.toFixed(6)));
        setLongitud(Number(e.latlng.lng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      map.invalidateSize();
    }, 120);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // Sincronizar posición del marcador cuando se edita un item o se limpia
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const target: [number, number] =
      latitud !== null && longitud !== null ? [latitud, longitud] : NOGOYA_CENTER;
    markerRef.current.setLatLng(target);
    mapInstanceRef.current.setView(target, latitud !== null ? 16 : 15);
  }, [latitud, longitud]);

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

  const handleUbicarDireccion = async () => {
    const queryTexto = (direccion.trim() || nombre.trim());
    if (!queryTexto) return;

    setGeocoding(true);
    try {
      const q = encodeURIComponent(`${queryTexto}, Nogoyá, Entre Ríos, Argentina`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const lat = Number(parseFloat(results[0].lat).toFixed(6));
        const lon = Number(parseFloat(results[0].lon).toFixed(6));
        setLatitud(lat);
        setLongitud(lon);
      } else {
        alert('No se encontró esa calle exacta. Hacé clic o arrastrá el pin en el mapa.');
      }
    } catch {
      alert('No se pudo buscar la dirección. Mové el pin manualmente en el mapa.');
    } finally {
      setGeocoding(false);
    }
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
                  placeholder="Ej: Basílica Nuestra Señora del Carmen"
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: 25 de Mayo 1070"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUbicarDireccion}
                    disabled={geocoding}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 shrink-0 transition"
                    title="Centrar pin en esta dirección"
                  >
                    {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-sky-600" />}
                    Ubicar
                  </button>
                </div>
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

            {/* MAPA INTERACTIVO ARRASTRABLE */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase">
                  Ubicación exacta (hacé clic en el mapa o arrastrá el pin 📍)
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  {latitud !== null && longitud !== null ? (
                    <>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {latitud}, {longitud}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLatitud(null);
                          setLongitud(null);
                        }}
                        className="text-red-500 hover:underline font-bold inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Quitar pin
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Sin pin fijado aún</span>
                  )}
                </div>
              </div>

              <div
                ref={mapContainerRef}
                className="w-full h-56 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 z-0"
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
                            <CheckCircle2 className="w-2.5 h-2.5" /> Con Pin
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
