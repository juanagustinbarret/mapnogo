import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Store,
  DollarSign,
  PlusCircle,
  MessageCircle,
  CreditCard,
  Settings,
  ArrowRight,
  ExternalLink,
  Trash2,
  LogIn,
  Search,
  MapPin,
  Building,
  Shield,
  Tag,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalComercios: 0, ingresosMes: 0 });
  const [modalAcceso, setModalAcceso] = useState<Comercio | null>(null);

  useEffect(() => {
    fetchComerciosYStats();
  }, []);

  const fetchComerciosYStats = async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('comercios')
      .select('*, rubro:rubros(*)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (data) {
      setComercios(data);
      const pagados = data.filter((c) => c.habilitado_admin).length;
      setStats({
        totalComercios: count || 0,
        ingresosMes: pagados * 10000,
      });
    }
    setLoading(false);
  };

  // Alternar Estado de Pago (Habilitado / Suspendido)
  const handleToggleEstadoPago = async (id: string, estadoActual: boolean) => {
    const { error } = await supabase
      .from('comercios')
      .update({ habilitado_admin: !estadoActual })
      .eq('id', id);

    if (!error) {
      fetchComerciosYStats();
    } else {
      alert('Error al actualizar el estado: ' + error.message);
    }
  };

  // Eliminar Comercio definitivamente
  const handleEliminarComercio = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"? Se borrará de la lista y del mapa público.`)) return;

    const { error } = await supabase.from('comercios').delete().eq('id', id);
    if (!error) {
      fetchComerciosYStats();
    } else {
      alert('Error al eliminar: ' + error.message);
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
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-brand-600" /> Panel de Control Administrativo
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión centralizada de comercios, control de pagos y mapa interactivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Link
            to="/admin/comercios/nuevo"
            className="flex-1 md:flex-none px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" /> ➕ Dar de Alta Comercio
          </Link>
          <Link
            to="/"
            target="_blank"
            className="flex-1 md:flex-none px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-gray-200 transition"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" /> Ver Mapa Público
          </Link>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comercios Cargados</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalComercios}</p>
          </div>
          <div className="p-3 bg-brand-50 dark:bg-brand-950/40 text-brand-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recaudación del Mes</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(stats.ingresosMes)}</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Módulos Activos</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">Mapa + Promos</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ubicación</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">Nogoyá</p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TABLA Y LISTA DE COMERCIOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-600" /> Lista General de Comercios
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Controlá el estado del pago. Solo los comercios al día aparecen en el mapa público.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando la lista de comercios...</div>
        ) : comerciosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No se encontraron comercios cargados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                  <th className="p-4">Comercio</th>
                  <th className="p-4">Rubro</th>
                  <th className="p-4">Estado del Pago</th>
                  <th className="p-4">Dirección</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                {comerciosFiltrados.map((comercio) => (
                  <tr key={comercio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Store className="w-4 h-4 text-brand-600 shrink-0" />
                        {comercio.nombre}
                      </div>
                      <span className="text-xs text-gray-400 font-mono">slug: {comercio.slug}</span>
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded-full text-xs font-bold">
                        {comercio.rubro?.nombre || 'General'}
                      </span>
                    </td>

                    {/* BOTÓN PARA CAMBIAR ESTADO DE PAGO */}
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleEstadoPago(comercio.id, comercio.habilitado_admin)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                          comercio.habilitado_admin
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/50 dark:text-green-300'
                            : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300'
                        }`}
                      >
                        {comercio.habilitado_admin ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Al Día (Visible en Mapa)
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-600" /> Pago Pendiente (Oculto)
                          </>
                        )}
                      </button>
                    </td>

                    <td className="p-4 text-xs text-gray-600 dark:text-gray-300">
                      {comercio.direccion}
                    </td>

                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setModalAcceso(comercio)}
                        title="Ingresar al panel de este comercio"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-sm transition"
                      >
                        <LogIn className="w-3.5 h-3.5" /> Panel
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

      {/* MODAL ACCESO A PANEL */}
      {modalAcceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-600" /> Administrar {modalAcceso.nombre}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Podés ingresar al panel comercial para modificar promociones u horarios en nombre del dueño.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalAcceso(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setModalAcceso(null);
                  navigate('/panel', { state: { comercioId: modalAcceso.id } });
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold"
              >
                Ingresar al Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};