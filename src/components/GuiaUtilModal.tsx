import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Phone, Flame, Stethoscope, Building2, Bus, MapPin, X, Navigation, Search, Info } from 'lucide-react';

export interface InstitucionPublica {
  id: string;
  nombre: string;
  categoria: 'Emergencias' | 'Salud' | 'Trámites y Municipio' | 'Transporte';
  telefono: string;
  direccion: string;
  urgencia: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GuiaUtilModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [instituciones, setInstituciones] = useState<InstitucionPublica[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [catSeleccionada, setCatSeleccionada] = useState<string>('Todas');

  useEffect(() => {
    if (!isOpen) return;

    const fetchGuia = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('guia_util')
        .select('*')
        .order('urgencia', { ascending: false })
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

      if (data) setInstituciones(data as InstitucionPublica[]);
      setLoading(false);
    };

    void fetchGuia();
  }, [isOpen]);

  if (!isOpen) return null;

  const categorias = ['Todas', 'Emergencias', 'Salud', 'Trámites y Municipio', 'Transporte'];

  const getIcono = (cat: string) => {
    switch (cat) {
      case 'Emergencias': return Flame;
      case 'Salud': return Stethoscope;
      case 'Transporte': return Bus;
      default: return Building2;
    }
  };

  const listaFiltrada = instituciones.filter((item) => {
    const coincideTexto =
      item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.direccion.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCat = catSeleccionada === 'Todas' || item.categoria === catSeleccionada;
    return coincideTexto && coincideCat;
  });

  const handleComoLlegar = (direccion: string, nombre: string) => {
    const query = encodeURIComponent(`${nombre}, ${direccion}, Nogoyá, Entre Ríos`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        
        {/* ENCABEZADO SOLIDO LIMPIO */}
        <div className="bg-sky-700 dark:bg-sky-900 p-5 sm:p-6 text-white space-y-2 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 bg-sky-800/80 px-3 py-1 rounded-full text-xs font-bold text-sky-100">
            <Info className="w-3.5 h-3.5 text-sky-200" /> Guía de Servicios Públicos
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Guía Útil e Institucional
          </h2>

          <p className="text-xs sm:text-sm text-sky-100 max-w-md font-medium leading-relaxed">
            Teléfonos directos de emergencias, centros de salud y dependencias municipales de Nogoyá.
          </p>
        </div>

        {/* FILTROS EN LISTA (BUSCADOR + DESPLEGABLE DE CATEGORÍAS) */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar hospital, policía, municipalidad..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
              />
            </div>

            {/* LISTA / SELECT DESPLEGABLE DE CATEGORÍAS */}
            <div>
              <select
                value={catSeleccionada}
                onChange={(e) => setCatSeleccionada(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
              >
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'Todas' ? 'Todas las Categorías' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* LISTADO DE INSTITUCIONES */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-white dark:bg-gray-900">
          {loading ? (
            <p className="text-center text-xs text-gray-500 py-8 animate-pulse font-medium">Cargando guía útil...</p>
          ) : listaFiltrada.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8 font-medium">
              No se encontraron instituciones con ese criterio.
            </p>
          ) : (
            listaFiltrada.map((item) => {
              const IconComponent = getIcono(item.categoria);
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    item.urgencia
                      ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                      : 'bg-gray-50/60 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      item.urgencia
                        ? 'bg-rose-500 text-white'
                        : 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                        {item.nombre}
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0 text-sky-500" /> {item.direccion}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleComoLlegar(item.direccion, item.nombre)}
                      className="px-3 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition shadow-sm"
                      title="Ubicación en Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-500" /> Mapa
                    </button>

                    <a
                      href={`tel:${item.telefono}`}
                      className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition shadow-sm ${
                        item.urgencia
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" /> Llamar
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};