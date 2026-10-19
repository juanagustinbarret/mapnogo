import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CreditCard, CheckCircle, XCircle, Search, DollarSign, LayoutDashboard, Clock, PlusCircle, LogOut } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

function calcularAntiguedadMeses(fechaCreacion: string) {
  if (!fechaCreacion) return 'Desconocida';
  const inicio = new Date(fechaCreacion);
  const hoy = new Date();
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  return meses <= 0 ? 'Menos de 1 mes' : `${meses} meses`;
}

export const AdminPaymentsPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal para registrar pago
  const [comercioModalPago, setComercioModalPago] = useState<Comercio | null>(null);
  const [montoPago, setMontoPago] = useState('10000');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comercios')
      .select('*, rubro:rubros(*)')
      .order('created_at', { ascending: false });
    
    if (data) setComercios(data);
    setLoading(false);
  };

  const handleToggleEstadoPago = async (id: string, estadoActual: boolean) => {
    await supabase.from('comercios').update({ habilitado_admin: !estadoActual }).eq('id', id);
    fetchComercios();
  };

  const handleConfirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercioModalPago) return;
    setSavingPayment(true);

    try {
      // 1. Obtener el UUID del administrador logueado
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Error: No se encontró una sesión activa de administrador.');
        return;
      }

      // 2. Mapear el método de pago al enum en minúsculas de Postgres
      let metodoEnum = 'transferencia';
      const metodoLower = metodoPago.toLowerCase();
      if (metodoLower.includes('efectivo')) {
        metodoEnum = 'efectivo';
      } else if (metodoLower.includes('mercadopago')) {
        metodoEnum = 'mercadopago';
      }

      // 3. Ejecutar función RPC con los nombres de parámetros exactos
      const { error } = await supabase.rpc('registrar_pago_comercio', {
        p_comercio_id: comercioModalPago.id,
        p_importe: parseFloat(montoPago),
        p_metodo_pago: metodoEnum,
        p_registrado_por: user.id
      });

      if (error) {
        alert('Error al registrar el pago: ' + error.message);
      } else {
        alert(`✅ Pago registrado exitosamente para "${comercioModalPago.nombre}" por ${formatCurrency(parseFloat(montoPago))}`);
        setComercioModalPago(null);
        fetchComercios();
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const filtrados = comercios.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || c.direccion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER PRINCIPAL Y NAVEGACIÓN */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-blue-600" /> Registro de Pagos & Miembros
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Auditoría de ingresos mensual, antigüedad de los comercios y extensión automática de vencimientos.
            </p>
          </div>

          <button
            onClick={() => { signOut(); navigate('/admin/login'); }}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

        {/* PESTAÑAS EN GRID ADAPTABLE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/admin"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="truncate">Dashboard</span>
          </Link>

          <Link
            to="/admin/pagos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/pagos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="truncate">Pagos</span>
          </Link>

          <Link
            to="/admin/vencimientos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/vencimientos'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">Vencimientos</span>
          </Link>

          <Link
            to="/admin/comercios/nuevo"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/comercios/nuevo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Alta Comercio</span>
          </Link>
        </div>
      </div>

      {/* SECCIÓN RESPONSIVA DE REGISTRO DE PAGOS */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 font-semibold">Cargando registros...</div>
        ) : (
          <div className="space-y-4">
            {/* VISTA EN TARJETAS PARA CELULARES */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filtrados.map((c) => (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{c.nombre}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alta: {formatDate(c.created_at)}</p>
                    </div>
                    <span className="text-xs font-semibold text-brand-600">{calcularAntiguedadMeses(c.created_at)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800">
                    <button
                      onClick={() => handleToggleEstadoPago(c.id, c.habilitado_admin)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                        c.habilitado_admin ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                      }`}
                    >
                      {c.habilitado_admin ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {c.habilitado_admin ? 'Visible' : 'Oculto'}
                    </button>

                    <button
                      onClick={() => setComercioModalPago(c)}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* VISTA EN TABLA PARA COMPUTADORAS */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="p-3.5 w-[25%]">Comercio</th>
                    <th className="p-3.5 w-[20%]">Miembro Desde</th>
                    <th className="p-3.5 w-[18%]">Antigüedad</th>
                    <th className="p-3.5 w-[20%]">Estado Publicación</th>
                    <th className="p-3.5 w-[17%] text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                  {filtrados.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white truncate">{c.nombre}</td>
                      <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300 truncate">{formatDate(c.created_at)}</td>
                      <td className="p-3.5 text-xs font-semibold text-brand-600 truncate">{calcularAntiguedadMeses(c.created_at)}</td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleEstadoPago(c.id, c.habilitado_admin)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                            c.habilitado_admin ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                          }`}
                        >
                          {c.habilitado_admin ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {c.habilitado_admin ? 'Visible' : 'Oculto'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setComercioModalPago(c)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1 shadow-sm transition"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO REAL */}
      {comercioModalPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Registrar Cuota para {comercioModalPago.nombre}
            </h3>

            <form onSubmit={handleConfirmarPago} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Monto Cobrado ($)</label>
                <input
                  type="number"
                  required
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900 font-semibold"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Mano</option>
                  <option value="MercadoPago">MercadoPago</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComercioModalPago(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  {savingPayment ? 'Guardando...' : 'Confirmar & Extender Vencimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};