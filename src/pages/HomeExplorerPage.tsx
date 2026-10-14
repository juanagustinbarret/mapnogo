import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Rubro } from '@/types/database.types';
import { InteractiveMap } from '@/components/InteractiveMap';
import { Search, MapPin, Store, LocateFixed, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';

// Función para calcular distancia en kilómetros (Fórmula de Haversine)
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const HomeExplorerPage: React.FC = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  
  const [userAddress, setUserAddress] = useState<string>('Nogoyá, Entre Ríos');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: rubrosData } = await supabase.from('rubros').select('*').eq('estado', true).order('orden');
    const { data: comerciosData } = await supabase
      .from('comercios')
      .select('*, rubro:rubros(*)')
      .eq('aprobado', true)
      .eq('habilitado_admin', true);

    if (rubrosData) setRubros(rubrosData);
    if (comerciosData) setComercios(comerciosData);
  };

  // Solicitar ubicación por GPS o Entrada Manual
  const solicitarUbicacion = () => {
    setLoadingLoc(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            const calle = data.address?.road || data.address?.pedestrian || 'Tu ubicación';
            setUserAddress(`${calle}, Nogoyá`);
          } catch {
            setUserAddress('Ubicación detectada por GPS');
          }
          setLoadingLoc(false);
        },
        async () => {
          setLoadingLoc(false);
          const calleManual = prompt('El navegador requiere HTTPS para GPS directo. Ingresá tu calle en Nogoyá (ej: San Lorenzo 600):');
          if (calleManual) {
            setLoadingLoc(true);
            try {
              let direccionLimpia = calleManual;
              if (!direccionLimpia.toLowerCase().includes('calle')) {
                direccionLimpia = `Calle ${direccionLimpia}`;
              }

              const query = encodeURIComponent(`${direccionLimpia}, Nogoyá, Entre Ríos, Argentina`);
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
              const data = await res.json();

              if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setUserLocation({ lat, lng });
                setUserAddress(`${calleManual}, Nogoyá`);
              } else {
                alert('No se pudo encontrar esa dirección en Nogoyá.');
              }
            } catch (e) {
              console.error('Error al geocodificar la calle manual:', e);
            }
            setLoadingLoc(false);
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLoadingLoc(false);
      alert('Geolocalización no soportada en este navegador.');
    }
  };

  // Filtrar y calcular distancia si existe ubicación
  const filteredComercios = comercios
    .map((c) => {
      const latC = c.latitud || -32.3939;
      const lngC = c.longitud || -59.7881;
      const distancia = userLocation ? calcularDistanciaKm(userLocation.lat, userLocation.lng, latC, lngC) : null;
      return { ...c, distancia };
    })
    .filter((c) => {
      const matchSearch =
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.descripcion_corta.toLowerCase().includes(search.toLowerCase()) ||
        c.direccion.toLowerCase().includes(search.toLowerCase());
      const matchRubro = selectedRubro ? c.rubro_id === selectedRubro : true;
      return matchSearch && matchRubro;
    })
    .sort((a, b) => {
      if (a.distancia !== null && b.distancia !== null) {
        return a.distancia - b.distancia;
      }
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* BARRA DE UBICACIÓN ACTUAL */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
            <LocateFixed className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Tu Ubicación Aproximada</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{userAddress}</p>
          </div>
        </div>

        <button
          onClick={solicitarUbicacion}
          disabled={loadingLoc}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm"
        >
          <Navigation className="w-4 h-4" /> {loadingLoc ? 'Obteniendo...' : 'Actualizar Ubicación'}
        </button>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por comercio o calle (ej: San Lorenzo)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => setSelectedRubro('')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
              selectedRubro === '' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Todos
          </button>
          {rubros.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRubro(r.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
                selectedRubro === r.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {r.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* MAPA + LISTADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-2 h-full">
          <InteractiveMap comercios={filteredComercios} userLocation={userLocation} />
        </div>

        <div className="overflow-y-auto space-y-3 pr-1">
          {filteredComercios.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Store className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-semibold">No se encontraron comercios en Nogoyá</p>
            </div>
          ) : (
            filteredComercios.map((comercio) => (
              <div key={comercio.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-500 transition">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">{comercio.nombre}</h3>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 px-2.5 py-0.5 rounded-full font-bold">
                      {comercio.rubro?.nombre}
                    </span>
                    {comercio.distancia !== null && (
                      <span className="text-[10px] font-bold text-green-600 font-mono">
                        a {comercio.distancia} km
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{comercio.descripcion_corta}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-brand-600" /> {comercio.direccion}</span>
                  <Link to={`/comercio/${comercio.slug}`} className="text-brand-600 font-bold hover:underline">
                    Ver ficha
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};