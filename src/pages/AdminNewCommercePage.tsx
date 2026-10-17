
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Rubro } from '@/types/database.types';
import { ArrowLeft, Save, Building, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PLAN_ID = '5b1d9010-2332-47c2-bea8-9413dfcbc6b8';

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
      center={[-32.3939, -59.7881]}
      zoom={15}
      scrollWheelZoom
      style={{
        height: '350px',
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
        radius={9}
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

export const AdminNewCommercePage: React.FC = () => {
  const navigate = useNavigate();

  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRubros, setLoadingRubros] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombreComerciante: '',
    nombreComercio: '',
    rubro_id: '',
    descripcion_corta: '',
    direccion: '',
    whatsapp: '',
    latitud: -32.3939,
    longitud: -59.7881,
  });

  useEffect(() => {
    let mounted = true;

    const cargarRubros = async () => {
      try {
        const { data, error: rubrosError } = await supabase
          .from('rubros')
          .select('*')
          .eq('estado', true)
          .order('orden', { ascending: true });

        if (rubrosError) {
          throw rubrosError;
        }

        if (!mounted) return;

        setRubros(data ?? []);

        if (data && data.length > 0) {
          setFormData((prev) => ({
            ...prev,
            rubro_id: prev.rubro_id || data[0].id,
          }));
        }
      } catch (err) {
        if (mounted) {
          setError(
            `No se pudieron cargar los rubros: ${
              err instanceof Error ? err.message : 'Error desconocido'
            }`
          );
        }
      } finally {
        if (mounted) {
          setLoadingRubros(false);
        }
      }
    };

    void cargarRubros();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const session = sessionData.session;

      if (!session?.access_token) {
        throw new Error('Tu sesión no es válida. Volvé a iniciar sesión.');
      }

      if (!formData.rubro_id) {
        throw new Error('Seleccioná un rubro para el comercio.');
      }

      const email = formData.email.trim().toLowerCase();
      const nombreComerciante = formData.nombreComerciante.trim();
      const nombreComercio = formData.nombreComercio.trim();

      if (!email || !nombreComerciante || !nombreComercio) {
        throw new Error('Completá todos los campos obligatorios.');
      }

      if (formData.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      // El vencimiento se calcula para el día 10 del mes siguiente.
      const proximoVencimiento = new Date();
      proximoVencimiento.setDate(1);
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
      proximoVencimiento.setDate(10);

      const fechaVencimiento = [
        proximoVencimiento.getFullYear(),
        String(proximoVencimiento.getMonth() + 1).padStart(2, '0'),
        String(proximoVencimiento.getDate()).padStart(2, '0'),
      ].join('-');

      const { data, error: functionError } =
        await supabase.functions.invoke('admin-crear-comerciante', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            email,
            password: formData.password,
            profile_name: nombreComerciante,
            plan_id: PLAN_ID,
            proximo_vencimiento: fechaVencimiento,
            comercio: {
              nombre: nombreComercio,
              rubro_id: formData.rubro_id,
              descripcion_corta: formData.descripcion_corta.trim(),
              direccion: formData.direccion.trim(),
              whatsapp: formData.whatsapp.trim(),
              email_comercial: email,
              latitud: formData.latitud,
              longitud: formData.longitud,
            },
          },
        });

      if (functionError) {
        const responseError =
          data && typeof data.error === 'string' ? data.error : null;

        throw new Error(
          responseError ||
            functionError.message ||
            'No se pudo crear el comercio.'
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      navigate('/admin');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.';

      setError(`Error al crear el comercio: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al panel de administración
      </Link>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-brand-600" />
          Dar de Alta Nuevo Comercio
        </h2>

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs rounded-xl font-semibold"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b dark:border-gray-700 pb-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-4 h-4" />
              Datos de Acceso
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre Propietario
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={formData.nombreComerciante}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombreComerciante: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Contraseña Inicial
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Building className="w-4 h-4" />
              Ficha del Comercio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre del Comercio
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombreComercio}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombreComercio: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Rubro
                </label>
                <select
                  required
                  disabled={loadingRubros || rubros.length === 0}
                  value={formData.rubro_id}
                  onChange={(e) =>
                    setFormData({ ...formData, rubro_id: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {rubros.length === 0 && (
                    <option value="">
                      {loadingRubros
                        ? 'Cargando rubros...'
                        : 'No hay rubros disponibles'}
                    </option>
                  )}

                  {rubros.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Descripción Corta
                </label>
                <input
                  type="text"
                  required
                  value={formData.descripcion_corta}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descripcion_corta: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Dirección (Nogoyá)
                </label>
                <input
                  type="text"
                  required
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  placeholder="3435123456"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>

            {/* UBICACIÓN DEL COMERCIO */}
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Ubicación del comercio en el mapa
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Hacé clic en el mapa para marcar la ubicación exacta del local.
                  También podés modificar las coordenadas manualmente.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <SelectorMapa
                  latitud={formData.latitud}
                  longitud={formData.longitud}
                  onSeleccionar={(latitud, longitud) =>
                    setFormData((prev) => ({
                      ...prev,
                      latitud,
                      longitud,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitud}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        latitud: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitud}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        longitud: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Coordenadas seleccionadas: {formData.latitud.toFixed(6)},{' '}
                {formData.longitud.toFixed(6)}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || loadingRubros || rubros.length === 0}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Crear y Habilitar Comercio'}
          </button>
        </form>
      </div>
    </div>
  );
};
