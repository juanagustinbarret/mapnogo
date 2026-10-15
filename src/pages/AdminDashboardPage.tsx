import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
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
  LayoutDashboard
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export const AdminDashboardPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalComercios: 0, ingresosMes: 0 });

  // Selección de Comercio para Análisis de Métricas
  const [selectedComercioMetrica, setSelectedComercioMetrica] = useState<Comercio | null>(null);
  const [metricasLocal, setMetricasLocal] = useState({ visitas: 0, whatsapp: 0, comoLlegar: 0 });

  // Modal Editar
  const [modalEditar, setModalEditar] = useState<Comercio | null>(null);

  useEffect(() => {
    fetchComerciosYStats();

    const channel = supabase
      .channel('realtime_comercios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comercios' }, () => {
        fetchComerciosYStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchComerciosYStats = async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('comercios')
      .select('*, rubro:rubros(*)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setComercios(data);
      const pagados = data.filter((c) => c.habilitado_admin).length;
      setStats({
        totalComercios: count || 0,
        ingresosMes: pagados * 10000,
      });

      if (!selectedComercioMetrica) {
        cargarMetricasDeComercio(data[0]);
      }
    }
    setLoading(false);
  };

  const cargarMetricasDeComercio = async (comercio: Comercio) => {
    setSelectedComercioMetrica(comercio);
    const met = await obtenerMetricasComercio(comercio.id);
    setMetricasLocal(met);
  };

  const handleToggleEstadoPago = async (id: string, estadoActual: boolean) => {
    await supabase.from('comercios').update({ habilitado_admin: !estadoActual }).eq('id', id);
  };

  const handleEliminarComercio = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"?`)) return;
    await supabase.from('comercios').delete().eq('id', id);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar) return;

    const { error } = await supabase
      .from('comercios')
      .update({
        nombre: modalEditar.nombre,
        direccion: modalEditar.direccion,
        whatsapp: modalEditar.whatsapp,
        descripcion_corta: modalEditar.descripcion_corta
      })
      .eq('id', modalEditar.id);

    if (!error) {
      setModalEditar(null);
      fetchComerciosYStats();
    }
  };

  const comerciosFiltrados = comercios.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.direccion?.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp?.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER Y NAVEGACIÓN ENTRE PANTALLAS ADMIN */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-brand-600" /> Panel Administrador Central
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gestión de comercios, métricas por negocio, cobranzas y avisos por WhatsApp.
            </p>
          </div>

          <button
            onClick={() => { signOut(); navigate('/admin/login'); }}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

        {/* BARRA DE PESTAÑAS DE NAVEGACIÓN */}
        <div className="flex items-center gap-2 border-t dark:border-gray-700 pt-4 overflow-x-auto">
          <Link
            to="/admin"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition ${
              location.pathname === '/admin'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard Central
          </Link>

          <Link
            to="/admin/pagos"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition ${
              location.pathname === '/admin/pagos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Registro de Pagos
          </Link>

          <Link
            to="/admin/vencimientos"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition ${
              location.pathname === '/admin/vencimientos'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Vencimientos & WhatsApp
          </Link>

          <Link
            to="/admin/comercios/nuevo"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition ${
              location.pathname === '/admin/comercios/nuevo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Alta Comercio
          </Link>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS PLATAFORMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Comercios</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalComercios}</p>
          </div>
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recaudación Estimada</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(stats.ingresosMes)}</p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sincronización</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">Tiempo Real</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">Nogoyá</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* MÉTRICAS POR NEGOCIO */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-brand-600" /> Rendimiento & Métricas Reales por Comercio
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Seleccioná un negocio para auditar sus visitas a la ficha y contactos recibidos.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <select
              value={selectedComercioMetrica?.id || ''}
              onChange={(e) => {
                const com = comercios.find(c => c.id === e.target.value);
                if (com) cargarMetricasDeComercio(com);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {comercios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.direccion})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedComercioMetrica && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-200">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Visitas a la Ficha</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{metricasLocal.visitas}</p>
              </div>
              <div className="p-3 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-xl">
                <Eye className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Consultas WhatsApp</p>
                <p className="text-3xl font-black text-green-600 mt-1">{metricasLocal.whatsapp}</p>
              </div>
              <div className="p-3 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 rounded-xl">
                <MessageCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Rutas "Cómo Llegar"</p>
                <p className="text-3xl font-black text-purple-600 mt-1">{metricasLocal.comoLlegar}</p>
              </div>
              <div className="p-3 bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 rounded-xl">
                <Navigation className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLA DE COMERCIOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-600" /> Todos los Comercios Registrados
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Alterná el interruptor para habilitar u ocultar el local en el mapa público.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o calle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando lista de comercios...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                  <th className="p-4">Comercio</th>
                  <th className="p-4">Rubro</th>
                  <th className="p-4">Estado Publicación</th>
                  <th className="p-4">Dirección</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                {comerciosFiltrados.map((comercio) => (
                  <tr key={comercio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                    <td className="p-4 font-bold text-gray-900 dark:text-white">
                      {comercio.nombre}
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded-full text-xs font-bold">
                        {comercio.rubro?.nombre || 'General'}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => handleToggleEstadoPago(comercio.id, comercio.habilitado_admin)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          comercio.habilitado_admin
                            ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                        }`}
                      >
                        {comercio.habilitado_admin ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Visible en Mapa
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-600" /> Oculto
                          </>
                        )}
                      </button>
                    </td>

                    <td className="p-4 text-xs text-gray-600 dark:text-gray-300">
                      {comercio.direccion}
                    </td>

                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setModalEditar(comercio)}
                        title="Editar Comercio"
                        className="p-2 text-gray-600 hover:text-brand-600 rounded-lg inline-block"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <Link
                        to={`/comercio/${comercio.slug}`}
                        target="_blank"
                        className="p-2 text-gray-500 hover:text-brand-600 rounded-lg inline-block"
                        title="Ver Ficha Pública"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>

                      <button
                        onClick={() => handleEliminarComercio(comercio.id, comercio.nombre)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition"
                        title="Eliminar comercio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EDITAR COMERCIO */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-brand-600" /> Editar {modalEditar.nombre}
            </h3>

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  value={modalEditar.nombre}
                  onChange={(e) => setModalEditar({ ...modalEditar, nombre: e.target.value })}
                  className="w-full px-3.5 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Dirección (Nogoyá)</label>
                <input
                  type="text"
                  required
                  value={modalEditar.direccion}
                  onChange={(e) => setModalEditar({ ...modalEditar, direccion: e.target.value })}
                  className="w-full px-3.5 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={modalEditar.whatsapp}
                  onChange={(e) => setModalEditar({ ...modalEditar, whatsapp: e.target.value })}
                  className="w-full px-3.5 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEditar(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};