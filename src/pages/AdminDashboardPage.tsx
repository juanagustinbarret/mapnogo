
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Rubro } from '@/types/database.types';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { obtenerMetricasComercio } from '@/lib/metrics';
import {
  Store,
  DollarSign,
  PlusCircle,
  ExternalLink,
  Trash2,
  Search,
  MapPin,
  Building,
  Shield,
  Tag,
  CheckCircle,
  XCircle,
  Edit,
  LogOut,
  Save,
  BarChart2,
  Eye,
  MessageCircle,
  Navigation,
  CreditCard,
  Clock,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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
  const EventosMapa: React.FC = () => {
    useMapEvents({
      click(e) {
        onSeleccionar(e.latlng.lat, e.latlng.lng);
      },
    });

    return null;
  };

  const ActualizarCentro: React.FC = () => {
    const mapa = useMap();

    useEffect(() => {
      mapa.setView([latitud, longitud], mapa.getZoom());
    }, [mapa, latitud, longitud]);

    return null;
  };

  return (
    <MapContainer
      center={[latitud, longitud]}
      zoom={16}
      scrollWheelZoom
      style={{ height: '300px', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
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

const campoClase =
  'w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

const etiquetaClase =
  'block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1';

const Seccion: React.FC<{
  titulo: string;
  children: React.ReactNode;
}> = ({ titulo, children }) => (
  <section className="space-y-4">
    <h4 className="font-bold text-sm text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
      {titulo}
    </h4>
    {children}
  </section>
);

export const AdminDashboardPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    totalComercios: 0,
    ingresosMes: 0,
  });

  const [selectedComercioMetrica, setSelectedComercioMetrica] =
    useState<Comercio | null>(null);
  const [metricasLocal, setMetricasLocal] = useState({
    visitas: 0,
    whatsapp: 0,
    comoLlegar: 0,
  });

  const [modalEditar, setModalEditar] = useState<Comercio | null>(null);
  const [rubrosEdicion, setRubrosEdicion] = useState<Rubro[]>([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const fetchComerciosYStats = async () => {
    setLoading(true);

    try {
      const { data, count, error } = await supabase
        .from('comercios')
        .select('*, rubro:rubros(*)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const lista = (data ?? []) as unknown as Comercio[];
      setComercios(lista);

      const { data: suscripciones, error: errorSuscripciones } =
        await supabase
          .from('suscripciones')
          .select('precio_acordado')
          .eq('estado', 'activa');

      if (errorSuscripciones) throw errorSuscripciones;

      const totalRecaudado = (suscripciones ?? []).reduce(
        (acc, curr) => acc + (Number(curr.precio_acordado) || 0),
        0
      );

      setStats({
        totalComercios: count ?? lista.length,
        ingresosMes: totalRecaudado,
      });

      if (lista.length > 0) {
        setSelectedComercioMetrica((actual) => {
          const comercioActual = actual
            ? lista.find((c) => c.id === actual.id)
            : null;

          return comercioActual ?? lista[0];
        });
      } else {
        setSelectedComercioMetrica(null);
        setMetricasLocal({ visitas: 0, whatsapp: 0, comoLlegar: 0 });
      }
    } catch (err) {
      console.error('Error al cargar el panel de administración:', err);
      alert(
        `No se pudo cargar el panel: ${
          err instanceof Error ? err.message : 'Error desconocido'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchComerciosYStats();

    const channel = supabase
      .channel('realtime_comercios')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comercios' },
        () => {
          void fetchComerciosYStats();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const cargarRubros = async () => {
      const { data, error } = await supabase
        .from('rubros')
        .select('*')
        .order('orden', { ascending: true });

      if (cancelado) return;

      if (error) {
        setErrorEdicion(`No se pudieron cargar los rubros: ${error.message}`);
        return;
      }

      setRubrosEdicion((data ?? []) as Rubro[]);
    };

    if (modalEditar) {
      setErrorEdicion('');
      void cargarRubros();
    }

    return () => {
      cancelado = true;
    };
  }, [modalEditar?.id]);

  useEffect(() => {
    let cancelado = false;

    const cargarMetricas = async () => {
      if (!selectedComercioMetrica) return;

      try {
        const metricas = await obtenerMetricasComercio(
          selectedComercioMetrica.id
        );

        if (!cancelado) setMetricasLocal(metricas);
      } catch (error) {
        console.error('Error al cargar métricas:', error);
      }
    };

    void cargarMetricas();

    return () => {
      cancelado = true;
    };
  }, [selectedComercioMetrica?.id]);

  const cargarMetricasDeComercio = (comercio: Comercio) => {
    setSelectedComercioMetrica(comercio);
  };

  const handleToggleEstadoPago = async (
    id: string,
    estadoActual: boolean
  ) => {
    const { error } = await supabase
      .from('comercios')
      .update({ habilitado_admin: !estadoActual })
      .eq('id', id);

    if (error) {
      alert(`No se pudo cambiar el estado: ${error.message}`);
      return;
    }

    await fetchComerciosYStats();
  };

  const handleEliminarComercio = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"?`)) return;

    const { error } = await supabase
      .from('comercios')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Error al eliminar el comercio: ${error.message}`);
      return;
    }

    if (selectedComercioMetrica?.id === id) {
      setSelectedComercioMetrica(null);
    }

    alert(`Comercio "${nombre}" eliminado con éxito.`);
    await fetchComerciosYStats();
  };

  const abrirEdicion = (comercio: Comercio) => {
    setErrorEdicion('');

    setModalEditar({
      ...comercio,
      descripcion_corta: comercio.descripcion_corta ?? '',
      descripcion_completa: comercio.descripcion_completa ?? '',
      direccion: comercio.direccion ?? '',
      telefono: comercio.telefono ?? '',
      whatsapp: comercio.whatsapp ?? '',
      email_comercial: comercio.email_comercial ?? '',
      sitio_web: comercio.sitio_web ?? '',
      instagram: comercio.instagram ?? '',
      facebook: comercio.facebook ?? '',
      logo_url: comercio.logo_url ?? '',
      galeria_urls: [...(comercio.galeria_urls ?? [])],
      servicios: [...(comercio.servicios ?? [])],
      medios_pago: [...(comercio.medios_pago ?? [])],
    });
  };

  const handleGuardarEdicion = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!modalEditar || guardandoEdicion) return;

    const latitud = Number(modalEditar.latitud);
    const longitud = Number(modalEditar.longitud);

    if (
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      latitud < -90 ||
      latitud > 90 ||
      longitud < -180 ||
      longitud > 180
    ) {
      setErrorEdicion('Ingresá una latitud y longitud válidas.');
      return;
    }

    if (!modalEditar.nombre.trim()) {
      setErrorEdicion('El nombre del comercio es obligatorio.');
      return;
    }

    if (!modalEditar.rubro_id) {
      setErrorEdicion('Seleccioná un rubro.');
      return;
    }

    if (!modalEditar.slug.trim()) {
      setErrorEdicion('El slug del comercio es obligatorio.');
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion('');

    const listaLimpia = (valores?: string[]) =>
      (valores ?? []).map((v) => v.trim()).filter(Boolean);

    try {
      const { error } = await supabase
        .from('comercios')
        .update({
          nombre: modalEditar.nombre.trim(),
          slug: modalEditar.slug.trim(),
          descripcion_corta: modalEditar.descripcion_corta?.trim() ?? '',
          descripcion_completa:
            modalEditar.descripcion_completa?.trim() || null,
          rubro_id: modalEditar.rubro_id,
          direccion: modalEditar.direccion.trim(),
          latitud,
          longitud,
          telefono: modalEditar.telefono?.trim() || null,
          whatsapp: modalEditar.whatsapp?.trim() ?? '',
          email_comercial: modalEditar.email_comercial?.trim() || null,
          sitio_web: modalEditar.sitio_web?.trim() || null,
          instagram: modalEditar.instagram?.trim() || null,
          facebook: modalEditar.facebook?.trim() || null,
          logo_url: modalEditar.logo_url?.trim() || null,
          galeria_urls: listaLimpia(modalEditar.galeria_urls),
          servicios: listaLimpia(modalEditar.servicios),
          medios_pago: listaLimpia(modalEditar.medios_pago),
          aprobado: modalEditar.aprobado,
          habilitado_admin: modalEditar.habilitado_admin,
        })
        .eq('id', modalEditar.id);

      if (error) throw error;

      setModalEditar(null);
      await fetchComerciosYStats();
      alert('Los cambios se guardaron correctamente.');
    } catch (err) {
      setErrorEdicion(
        `No se pudieron guardar los cambios: ${
          err instanceof Error ? err.message : 'Error desconocido'
        }`
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const actualizarCampo = <K extends keyof Comercio>(
    campo: K,
    valor: Comercio[K]
  ) => {
    setModalEditar((actual) =>
      actual ? { ...actual, [campo]: valor } : actual
    );
  };

  const comerciosFiltrados = comercios.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.direccion?.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp?.includes(search)
  );

  const rutaActiva = (ruta: string) =>
    location.pathname === ruta
      ? 'bg-brand-600 text-white shadow-sm'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ENCABEZADO */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-brand-600" />
              Panel Administrador Central
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gestión de comercios, métricas, cobranzas y publicaciones.
            </p>
          </div>

          <button
            onClick={() => {
              void signOut();
              navigate('/admin/login');
            }}
            className="w-full lg:w-auto px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t dark:border-gray-700 pt-4">
          <Link to="/admin" className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva('/admin')}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link to="/admin/pagos" className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva('/admin/pagos')}`}>
            <CreditCard className="w-4 h-4" /> Pagos
          </Link>
          <Link to="/admin/vencimientos" className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva('/admin/vencimientos')}`}>
            <Clock className="w-4 h-4" /> Vencimientos
          </Link>
          <Link to="/admin/comercios/nuevo" className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva('/admin/comercios/nuevo')}`}>
            <PlusCircle className="w-4 h-4" /> Alta comercio
          </Link>
        </div>
      </div>

      {/* INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total comercios</p>
            <p className="text-3xl font-bold mt-1">{stats.totalComercios}</p>
          </div>
          <Store className="w-7 h-7 text-brand-600" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Recaudación activa</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.ingresosMes)}</p>
          </div>
          <DollarSign className="w-7 h-7 text-green-600" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Sincronización</p>
            <p className="text-xl font-bold text-blue-600 mt-1">Tiempo real</p>
          </div>
          <Tag className="w-7 h-7 text-blue-600" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Ciudad</p>
            <p className="text-2xl font-bold mt-1">Nogoyá</p>
          </div>
          <MapPin className="w-7 h-7 text-purple-600" />
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border dark:border-gray-700 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-brand-600" />
              Rendimiento por comercio
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Visitas, contactos y rutas solicitadas.
            </p>
          </div>

          <select
            value={selectedComercioMetrica?.id ?? ''}
            onChange={(e) => {
              const comercio = comercios.find((c) => c.id === e.target.value);
              if (comercio) cargarMetricasDeComercio(comercio);
            }}
            className={`${campoClase} sm:max-w-sm`}
          >
            {comercios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.direccion})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
            <Eye className="w-5 h-5 text-blue-600" />
            <p className="text-xs text-gray-500 mt-2">Visitas a la ficha</p>
            <p className="text-3xl font-black">{metricasLocal.visitas}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <p className="text-xs text-gray-500 mt-2">Consultas WhatsApp</p>
            <p className="text-3xl font-black text-green-600">{metricasLocal.whatsapp}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
            <Navigation className="w-5 h-5 text-purple-600" />
            <p className="text-xs text-gray-500 mt-2">Cómo llegar</p>
            <p className="text-3xl font-black text-purple-600">{metricasLocal.comoLlegar}</p>
          </div>
        </div>
      </div>

      {/* LISTA DE COMERCIOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-600" />
              Todos los comercios
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Editá los datos o cambiá la visibilidad del local.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o WhatsApp..."
              className={`${campoClase} pl-9`}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Cargando comercios...
          </div>
        ) : comerciosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No se encontraron comercios.
          </div>
        ) : (
          <div className="space-y-3">
            {comerciosFiltrados.map((comercio) => (
              <div
                key={comercio.id}
                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {comercio.nombre}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {comercio.direccion || 'Sin dirección'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Rubro: {comercio.rubro?.nombre || 'General'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${comercio.aprobado ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {comercio.aprobado ? 'Aprobado' : 'Pendiente de aprobación'}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${comercio.habilitado_admin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {comercio.habilitado_admin ? 'Visible' : 'Oculto'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleToggleEstadoPago(comercio.id, comercio.habilitado_admin)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 ${comercio.habilitado_admin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {comercio.habilitado_admin ? (
                      <><CheckCircle className="w-4 h-4" /> Visible</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Oculto</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirEdicion(comercio)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white inline-flex items-center gap-1"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>

                  <Link
                    to={`/comercio/${comercio.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl text-xs font-bold border dark:border-gray-700 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleEliminarComercio(comercio.id, comercio.nombre)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 border border-red-200 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN COMPLETA */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto p-5 sm:p-6 space-y-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Edit className="w-5 h-5 text-brand-600" />
                  Editar comercio
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {modalEditar.nombre}
                </p>
              </div>
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={() => setModalEditar(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorEdicion && (
              <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                {errorEdicion}
              </div>
            )}

            <form onSubmit={handleGuardarEdicion} className="space-y-7">
              <Seccion titulo="Datos generales">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={etiquetaClase}>Nombre comercial *</label>
                    <input required value={modalEditar.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Slug de la ficha pública *</label>
                    <input required value={modalEditar.slug} onChange={(e) => actualizarCampo('slug', e.target.value)} className={campoClase} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiquetaClase}>Rubro *</label>
                    <select required value={modalEditar.rubro_id} onChange={(e) => actualizarCampo('rubro_id', e.target.value)} className={campoClase}>
                      <option value="">Seleccioná un rubro</option>
                      {rubrosEdicion.map((rubro) => (
                        <option key={rubro.id} value={rubro.id}>{rubro.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiquetaClase}>Descripción corta</label>
                    <textarea rows={2} value={modalEditar.descripcion_corta ?? ''} onChange={(e) => actualizarCampo('descripcion_corta', e.target.value)} className={campoClase} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiquetaClase}>Descripción completa</label>
                    <textarea rows={4} value={modalEditar.descripcion_completa ?? ''} onChange={(e) => actualizarCampo('descripcion_completa', e.target.value)} className={campoClase} />
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Dirección y ubicación">
                <div>
                  <label className={etiquetaClase}>Dirección</label>
                  <input value={modalEditar.direccion ?? ''} onChange={(e) => actualizarCampo('direccion', e.target.value)} className={campoClase} />
                </div>

                {Number.isFinite(Number(modalEditar.latitud)) &&
                  Number.isFinite(Number(modalEditar.longitud)) &&
                  Math.abs(Number(modalEditar.latitud)) <= 90 &&
                  Math.abs(Number(modalEditar.longitud)) <= 180 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                      <SelectorMapa
                        latitud={Number(modalEditar.latitud)}
                        longitud={Number(modalEditar.longitud)}
                        onSeleccionar={(latitud, longitud) => {
                          setModalEditar((actual) =>
                            actual ? { ...actual, latitud, longitud } : actual
                          );
                        }}
                      />
                    </div>
                  )}

                <p className="text-xs text-gray-500">
                  Hacé clic en el mapa para elegir la ubicación. También podés escribir las coordenadas.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={etiquetaClase}>Latitud</label>
                    <input type="number" step="any" required value={modalEditar.latitud ?? ''} onChange={(e) => actualizarCampo('latitud', e.target.value === '' ? 0 : Number(e.target.value))} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Longitud</label>
                    <input type="number" step="any" required value={modalEditar.longitud ?? ''} onChange={(e) => actualizarCampo('longitud', e.target.value === '' ? 0 : Number(e.target.value))} className={campoClase} />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Coordenadas seleccionadas: {Number(modalEditar.latitud).toFixed(6)}, {Number(modalEditar.longitud).toFixed(6)}
                </p>
              </Seccion>

              <Seccion titulo="Contacto y redes sociales">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={etiquetaClase}>Teléfono</label>
                    <input value={modalEditar.telefono ?? ''} onChange={(e) => actualizarCampo('telefono', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>WhatsApp</label>
                    <input value={modalEditar.whatsapp ?? ''} onChange={(e) => actualizarCampo('whatsapp', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Email comercial</label>
                    <input type="email" value={modalEditar.email_comercial ?? ''} onChange={(e) => actualizarCampo('email_comercial', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Sitio web</label>
                    <input value={modalEditar.sitio_web ?? ''} onChange={(e) => actualizarCampo('sitio_web', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Instagram</label>
                    <input value={modalEditar.instagram ?? ''} onChange={(e) => actualizarCampo('instagram', e.target.value)} className={campoClase} />
                  </div>
                  <div>
                    <label className={etiquetaClase}>Facebook</label>
                    <input value={modalEditar.facebook ?? ''} onChange={(e) => actualizarCampo('facebook', e.target.value)} className={campoClase} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiquetaClase}>URL del logo</label>
                    <input value={modalEditar.logo_url ?? ''} onChange={(e) => actualizarCampo('logo_url', e.target.value)} className={campoClase} />
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Galería, servicios y medios de pago">
                <p className="text-xs text-gray-500">
                  Ingresá un elemento por línea. Para la galería, colocá una URL de imagen por línea.
                </p>

                <div>
                  <label className={etiquetaClase}>Galería de imágenes</label>
                  <textarea rows={4} value={(modalEditar.galeria_urls ?? []).join('\n')} onChange={(e) => actualizarCampo('galeria_urls', e.target.value.split('\n'))} className={campoClase} placeholder="https://..." />
                </div>

                <div>
                  <label className={etiquetaClase}>Servicios</label>
                  <textarea rows={3} value={(modalEditar.servicios ?? []).join('\n')} onChange={(e) => actualizarCampo('servicios', e.target.value.split('\n'))} className={campoClase} placeholder={'Envíos a domicilio\nAtención personalizada'} />
                </div>

                <div>
                  <label className={etiquetaClase}>Medios de pago</label>
                  <textarea rows={3} value={(modalEditar.medios_pago ?? []).join('\n')} onChange={(e) => actualizarCampo('medios_pago', e.target.value.split('\n'))} className={campoClase} placeholder={'Efectivo\nTransferencia\nTarjeta'} />
                </div>
              </Seccion>

              <Seccion titulo="Estado administrativo">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={Boolean(modalEditar.aprobado)} onChange={(e) => actualizarCampo('aprobado', e.target.checked)} className="w-4 h-4" />
                  Comercio aprobado
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={Boolean(modalEditar.habilitado_admin)} onChange={(e) => actualizarCampo('habilitado_admin', e.target.checked)} className="w-4 h-4" />
                  Habilitado por el administrador (visible en el mapa)
                </label>
              </Seccion>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t dark:border-gray-700 pt-4">
                <button
                  type="button"
                  disabled={guardandoEdicion}
                  onClick={() => setModalEditar(null)}
                  className="px-4 py-2.5 border rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {guardandoEdicion ? 'Guardando...' : 'Guardar todos los cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
