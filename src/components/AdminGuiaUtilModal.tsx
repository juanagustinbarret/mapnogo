import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Plus, Edit, Trash2, Save, Info, Phone, MapPin, AlertCircle } from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface ItemGuiaUtil {
  id: string;
  nombre: string;
  categoria: 'Emergencias' | 'Salud' | 'Trámites y Municipio' | 'Transporte';
  telefono: string;
  direccion: string;
  urgencia: boolean;
  orden: number;
  latitud?: number | null;
  longitud?: number | null;
}

interface SelectorMapaProps {
  latitud: number;
  longitud: number;
  onSeleccionar: (latitud: number, longitud: number) => void;
}

const SelectorMapa: React.FC<SelectorMapaProps> = ({
  latitud,
  longitud,
  onSeleccionar,
}) => {
  const EventosMapa = () => {
    useMapEvents({
      click(e) {
        onSeleccionar(e.latlng.lat, e.latlng.lng);
      },
    });

    return null;
  };

  const ActualizarCentro = () => {
    const mapa = useMap();

    useEffect(() => {
      mapa.setView([latitud, longitud], mapa.getZoom());
    }, [mapa, latitud, longitud]);

    return null;
  };

  return (
    <MapContainer
      center={[latitud, longitud]}
      zoom={15}
      scrollWheelZoom
      style={{
        height: '240px',
        width: '100%',
        borderRadius: '12px',
        zIndex: 0,
      }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <EventosMapa />
      <ActualizarCentro />

      <CircleMarker
        center={[latitud, longitud]}
        radius={8}
        pathOptions={{
          color: '#ffffff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }}
      />
    </MapContainer>
  );
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminGuiaUtilModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<ItemGuiaUtil[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Formulario estado
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<'Emergencias' | 'Salud' | 'Trámites y Municipio' | 'Transporte'>('Trámites y Municipio');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [urgencia, setUrgencia] = useState(false);
  const [latitud, setLatitud] = useState<number>(-32.3939);
  const [longitud, setLongitud] = useState<number>(-59.7881);

  useEffect(() => {
    if (isOpen) {
      void fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('guia_util')
      .select('*')
      .order('urgencia', { ascending: false })
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (err) {
      setError('Error al cargar elementos de la guía útil.');
    } else if (data) {
      setItems(data as ItemGuiaUtil[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setIdEditando(null);
    setNombre('');
    setCategoria('Trámites y Municipio');
    setTelefono('');
    setDireccion('');
    setUrgencia(false);
    setLatitud(-32.3939);
    setLongitud(-59.7881);
    setError('');
  };

  const handleEditar = (item: ItemGuiaUtil) => {
    setIdEditando(item.id);
    setNombre(item.nombre);
    setCategoria(item.categoria);
    setTelefono(item.telefono);
    setDireccion(item.direccion);
    setUrgencia(item.urgencia);
    setLatitud(item.latitud ?? -32.3939);
    setLongitud(item.longitud ?? -59.7881);
    setError('');
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim() || !direccion.trim()) {
      setError('Por favor completá los campos obligatorios.');
      return;
    }

    setGuardando(true);
    setError('');

    const payload = {
      nombre: nombre.trim(),
      categoria,
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      urgencia,
      latitud,
      longitud,
    };

    let responseError = null;

    if (idEditando) {
      const { error: err } = await supabase.from('guia_util').update(payload).eq('id', idEditando);
      responseError = err;
    } else {
      const { error: err } = await supabase.from('guia_util').insert([payload]);
      responseError = err;
    }

    setGuardando(false);

    if (responseError) {
      setError('No se pudo guardar: ' + responseError.message);
    } else {
      resetForm();
      void fetchItems();
    }
  };

  const handleBorrar = async (id: string, itemNombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${itemNombre}" de la Guía Útil?`)) return;

    const { error: err } = await supabase.from('guia_util').delete().eq('id', id);
    if (err) {
      alert('Error al eliminar: ' + err.message);
    } else {
      void fetchItems();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        
        {/* ENCABEZADO */}
        <div className="bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-5 sm:p-6 text-white space-y-1 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md">
            <Info className="w-3.5 h-3.5" /> Panel Administrador
          </span>
          <h2 className="text-xl sm:text-2xl font-black">Gestión de Guía Útil de Nogoyá</h2>
          <p className="text-xs text-sky-100 max-w-md">
            Agregá, modificá o eliminá las dependencias e instituciones públicas.
          </p>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* FORMULARIO */}
          <form onSubmit={handleGuardar} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              {idEditando ? <Edit className="w-4 h-4 text-brand-600" /> : <Plus className="w-4 h-4 text-brand-600" />}
              {idEditando ? 'Editar Institución' : 'Nueva Institución Pública'}
            </h3>

            {error && (
              <p role="alert" className="p-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nombre de la Institución *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Municipalidad de Nogoyá"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Categoría *</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as any)}
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-medium"
                >
                  <option value="Emergencias">Emergencias</option>
                  <option value="Salud">Salud</option>
                  <option value="Trámites y Municipio">Trámites y Municipio</option>
                  <option value="Transporte">Transporte</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Teléfono Directo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 101 o 03435421211"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Dirección *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Caseros 965"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl"
                />
              </div>
            </div>

            {/* SECTOR MAPA Y COORDENADAS */}
            <div className="space-y-2 pt-1 border-t dark:border-gray-800">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Ubicación en el mapa (Hacé clic para ubicar el pin exacto):
              </label>

              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <SelectorMapa
                  latitud={latitud}
                  longitud={longitud}
                  onSeleccionar={(lat, lng) => {
                    setLatitud(lat);
                    setLongitud(lng);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={latitud}
                    onChange={(e) => setLatitud(Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={longitud}
                    onChange={(e) => setLongitud(Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={urgencia}
                  onChange={(e) => setUrgencia(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Marcar como urgencia destacada (resaltado rojo)
                </span>
              </label>

              <div className="flex items-center gap-2">
                {idEditando && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {guardando ? 'Guardando...' : idEditando ? 'Actualizar' : 'Agregar Institución'}
                </button>
              </div>
            </div>
          </form>

          {/* TABLA DE ELEMENTOS CARGADOS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Instituciones Cargadas ({items.length})
            </h3>

            {loading ? (
              <p className="text-xs text-center py-6 text-gray-500 animate-pulse">Cargando la guía...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-center py-6 text-gray-500">Aún no cargaste instituciones. Agregá la primera arriba.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                      item.urgencia
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 dark:text-white">{item.nombre}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {item.categoria}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-sky-600" /> {item.telefono}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-sky-600" /> {item.direccion}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditar(item)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleBorrar(item.id, item.nombre)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-red-600"
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