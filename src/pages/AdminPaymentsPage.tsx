import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { leerImporte } from '@/lib/importes';
import { fechaCalendario } from '@/lib/fechasArgentina';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Search, 
  DollarSign, 
  LayoutDashboard, 
  Clock, 
  PlusCircle, 
  LogOut, 
  History, 
  X, 
  UserCheck, 
  ShieldCheck,
  Edit2,
  Trash2
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Mapeo directo de UUIDs a Nombres de Administradores
const MAPA_ADMINISTRADORES: Record<string, string> = {
  'b722d6b4-0f07-4142-bd7d-26b2cf1c1836': 'Agustín Allende Vera',
  'd6b17662-fbab-4409-b2a2-f42cee3dba3d': 'Juan Agustín Barreto',
  '76ecbb9c-83de-444b-85d9-4248e42fa43e': 'Tomás Barreto',
};

function obtenerNombreAdmin(registradoPorId: string): string {
  return MAPA_ADMINISTRADORES[registradoPorId] || 'Administrador Central';
}

function calcularAntiguedadMeses(fechaCreacion: string) {
  if (!fechaCreacion) return 'Desconocida';
  const inicio = new Date(fechaCreacion);
  const hoy = new Date();
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  return meses <= 0 ? 'Menos de 1 mes' : `${meses} meses`;
}

interface PagoAuditoria {
  id: string;
  comercioNombre: string;
  importe: number;
  metodo_pago: string;
  referencia: string | null;
  created_at: string;
  periodo_facturado: string;
  registrado_por_nombre: string;
}

export const AdminPaymentsPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Control de sub-pestaña activa
  const [pestanaActiva, setPestanaActiva] = useState<'gestion' | 'historial_global'>('gestion');

  // Filtros de fecha para Auditoría
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Modal para registrar pago
  const [comercioModalPago, setComercioModalPago] = useState<Comercio | null>(null);
  const [montoPago, setMontoPago] = useState('10000');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [savingPayment, setSavingPayment] = useState(false);

  // Modal para editar un pago existente
  const [pagoAEditar, setPagoAEditar] = useState<PagoAuditoria | null>(null);
  const [montoEditado, setMontoEditado] = useState('');
  const [metodoEditado, setMetodoEditado] = useState('Transferencia');
  const [savingEdition, setSavingEdition] = useState(false);

  // Modal para ver historial individual
  const [comercioModalHistorial, setComercioModalHistorial] = useState<Comercio | null>(null);
  const [historialIndividual, setHistorialIndividual] = useState<PagoAuditoria[]>([]);
  const [loadingHistorialIndividual, setLoadingHistorialIndividual] = useState(false);

  // Auditoría general
  const [auditoriaPagos, setAuditoriaPagos] = useState<PagoAuditoria[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  useEffect(() => {
    fetchComercios();
    fetchAuditoriaGlobal();
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

  const fetchAuditoriaGlobal = async () => {
    setLoadingAuditoria(true);
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        id,
        importe,
        metodo_pago,
        referencia,
        created_at,
        registrado_por,
        periodos_suscripcion!inner (
          periodo_facturado,
          suscripciones!inner (
            comercios!inner (
              nombre
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar auditoría global:', error.message);
    } else if (data) {
      const formateados: PagoAuditoria[] = data.map((item: any) => ({
        id: item.id,
        comercioNombre: item.periodos_suscripcion?.suscripciones?.comercios?.nombre || 'Comercio Desconocido',
        importe: item.importe,
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        created_at: item.created_at,
        periodo_facturado: item.periodos_suscripcion?.periodo_facturado || 'N/A',
        registrado_por_nombre: obtenerNombreAdmin(item.registrado_por)
      }));
      setAuditoriaPagos(formateados);
    }
    setLoadingAuditoria(false);
  };

  const handleToggleEstadoPago = async (id: string, estadoActual: boolean) => {
    await supabase.from('comercios').update({ habilitado_admin: !estadoActual }).eq('id', id);
    fetchComercios();
  };

  const handleConfirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercioModalPago) return;
    const importe = leerImporte(montoPago);
    if (importe === null) {
      alert('Ingresá un importe válido mayor a $ 0 (por ejemplo 10.000).');
      return;
    }
    setSavingPayment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Error: No se encontró una sesión activa de administrador.');
        return;
      }

      let metodoEnum = 'transferencia';
      const metodoLower = metodoPago.toLowerCase();
      if (metodoLower.includes('efectivo')) {
        metodoEnum = 'efectivo';
      } else if (metodoLower.includes('mercadopago')) {
        metodoEnum = 'mercadopago';
      }

      const { error } = await supabase.rpc('registrar_pago_comercio', {
        p_comercio_id: comercioModalPago.id,
        p_importe: importe,
        p_metodo_pago: metodoEnum,
        p_registrado_por: user.id
      });

      if (error) {
        alert('Error al registrar el pago: ' + error.message);
      } else {
        alert(`✅ Pago registrado exitosamente por ${obtenerNombreAdmin(user.id)} para "${comercioModalPago.nombre}" por ${formatCurrency(importe)}`);
        setComercioModalPago(null);
        fetchComercios();
        fetchAuditoriaGlobal();
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleGuardarEdicionPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoAEditar) return;
    const nuevoImporte = leerImporte(montoEditado);
    if (nuevoImporte === null) {
      alert('Ingresá un importe válido mayor a $ 0 (por ejemplo 10.000).');
      return;
    }
    setSavingEdition(true);

    try {
      let metodoEnum = 'transferencia';
      const metodoLower = metodoEditado.toLowerCase();
      if (metodoLower.includes('efectivo')) {
        metodoEnum = 'efectivo';
      } else if (metodoLower.includes('mercadopago')) {
        metodoEnum = 'mercadopago';
      }

      const { error } = await supabase.rpc('editar_pago_comercio', {
        p_pago_id: pagoAEditar.id,
        p_nuevo_importe: nuevoImporte,
        p_nuevo_metodo: metodoEnum
      });

      if (error) {
        alert('Error al editar el pago: ' + error.message);
      } else {
        alert(`✅ Registro de pago corregido exitosamente.`);
        setPagoAEditar(null);
        fetchAuditoriaGlobal();
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setSavingEdition(false);
    }
  };

  const handleEliminarPago = async (pago: PagoAuditoria) => {
    if (!confirm(`¿Estás seguro de eliminar el pago de ${formatCurrency(pago.importe)} de "${pago.comercioNombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('eliminar_pago_comercio', {
        p_pago_id: pago.id
      });

      if (error) {
        alert('Error al eliminar el pago: ' + error.message);
      } else {
        alert('✅ Registro de pago eliminado correctamente.');
        fetchAuditoriaGlobal();
        fetchComercios();
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    }
  };

  const handleAbrirHistorialIndividual = async (comercio: Comercio) => {
    setComercioModalHistorial(comercio);
    setLoadingHistorialIndividual(true);

    const { data, error } = await supabase
      .from('pagos')
      .select(`
        id,
        importe,
        metodo_pago,
        referencia,
        created_at,
        registrado_por,
        periodos_suscripcion!inner (
          periodo_facturado,
          suscripciones!inner (
            comercio_id
          )
        )
      `)
      .eq('periodos_suscripcion.suscripciones.comercio_id', comercio.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar historial individual:', error.message);
      setHistorialIndividual([]);
    } else if (data) {
      const formateados: PagoAuditoria[] = data.map((item: any) => ({
        id: item.id,
        comercioNombre: comercio.nombre,
        importe: item.importe,
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        created_at: item.created_at,
        periodo_facturado: item.periodos_suscripcion?.periodo_facturado || 'N/A',
        registrado_por_nombre: obtenerNombreAdmin(item.registrado_por)
      }));
      setHistorialIndividual(formateados);
    }

    setLoadingHistorialIndividual(false);
  };

  const abrirModalEditar = (pago: PagoAuditoria) => {
    setPagoAEditar(pago);
    setMontoEditado(String(pago.importe));
    setMetodoEditado(pago.metodo_pago);
  };

  const filtradosComercios = comercios.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || c.direccion?.toLowerCase().includes(search.toLowerCase())
  );

  const filtradosAuditoria = auditoriaPagos.filter((p) => {
    const coincideTexto = 
      p.comercioNombre.toLowerCase().includes(search.toLowerCase()) ||
      p.registrado_por_nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.metodo_pago.toLowerCase().includes(search.toLowerCase());

    // Día del pago en Argentina (con split('T') un pago de las 22 h caía al día siguiente)
    const fechaPagoStr = fechaCalendario(p.created_at);
    const coincideDesde = !fechaDesde || fechaPagoStr >= fechaDesde;
    const coincideHasta = !fechaHasta || fechaPagoStr <= fechaHasta;

    return coincideTexto && coincideDesde && coincideHasta;
  });

  const totalFiltrado = filtradosAuditoria.reduce((acc, curr) => acc + curr.importe, 0);

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

        {/* PESTAÑAS PRINCIPALES */}
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

      {/* SECCIÓN PAGOS */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700 pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setPestanaActiva('gestion')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                pestanaActiva === 'gestion'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Cobrar Cuotas
            </button>

            <button
              onClick={() => setPestanaActiva('historial_global')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                pestanaActiva === 'historial_global'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Auditoría General de Cobros
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={pestanaActiva === 'gestion' ? "Buscar por comercio..." : "Buscar comercio, admin..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* CONTENIDO VISTA 1: GESTIÓN */}
        {pestanaActiva === 'gestion' && (
          loading ? (
            <div className="p-12 text-center text-gray-500 font-semibold">Cargando registros...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtradosComercios.map((c) => (
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

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAbrirHistorialIndividual(c)}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs inline-flex items-center gap-1 transition"
                        >
                          <History className="w-3.5 h-3.5" /> Historial
                        </button>

                        <button
                          onClick={() => setComercioModalPago(c)}
                          className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3.5 w-[22%]">Comercio</th>
                      <th className="p-3.5 w-[18%]">Miembro Desde</th>
                      <th className="p-3.5 w-[15%]">Antigüedad</th>
                      <th className="p-3.5 w-[18%]">Estado Publicación</th>
                      <th className="p-3.5 w-[27%] text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                    {filtradosComercios.map((c) => (
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
                        <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => handleAbrirHistorialIndividual(c)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs inline-flex items-center gap-1 shadow-sm transition"
                          >
                            <History className="w-3.5 h-3.5" /> Historial
                          </button>

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
          )
        )}

        {/* CONTENIDO VISTA 2: AUDITORÍA CON FILTRO DE FECHAS */}
        {pestanaActiva === 'historial_global' && (
          <div className="space-y-4">
            
            {/* BARRA DE FILTROS FECHA DESDE / HASTA */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-end justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Desde Fecha</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Hasta Fecha</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {(fechaDesde || fechaHasta) && (
                  <button
                    onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                    className="px-3 py-2 text-xs font-bold text-red-600 hover:underline"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-bold">
                Total en rango: <span className="text-green-600 text-sm">{formatCurrency(totalFiltrado)}</span>
              </div>
            </div>

            {loadingAuditoria ? (
              <div className="p-12 text-center text-gray-500 font-semibold">Cargando auditoría de pagos...</div>
            ) : filtradosAuditoria.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-semibold">No hay cobros en las fechas seleccionadas.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3.5 w-[22%]">Comercio</th>
                      <th className="p-3.5 w-[18%]">Fecha de Pago</th>
                      <th className="p-3.5 w-[15%]">Medio</th>
                      <th className="p-3.5 w-[15%]">Monto</th>
                      <th className="p-3.5 w-[18%]">Registrado Por</th>
                      <th className="p-3.5 w-[12%] text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                    {filtradosAuditoria.map((pago) => (
                      <tr key={pago.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white truncate">{pago.comercioNombre}</td>
                        <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300 truncate">{formatDate(pago.created_at)}</td>
                        <td className="p-3.5 text-xs font-semibold capitalize truncate">{pago.metodo_pago}</td>
                        <td className="p-3.5 text-xs font-bold text-green-600 truncate">{formatCurrency(pago.importe)}</td>
                        <td className="p-3.5 text-xs font-bold text-brand-600 flex items-center gap-1.5 truncate">
                          <UserCheck className="w-4 h-4 text-brand-600 shrink-0" />
                          {pago.registrado_por_nombre}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => abrirModalEditar(pago)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Editar este registro"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminarPago(pago)}
                            className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Eliminar este pago"
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
        )}

      </div>

      {/* MODAL REGISTRAR PAGO */}
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
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="10.000"
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

      {/* MODAL EDITAR PAGO */}
      {pagoAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Editar Cobro de {pagoAEditar.comercioNombre}
            </h3>

            <form onSubmit={handleGuardarEdicionPago} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Monto Correcto ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="10.000"
                  value={montoEditado}
                  onChange={(e) => setMontoEditado(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Medio de Pago</label>
                <select
                  value={metodoEditado}
                  onChange={(e) => setMetodoEditado(e.target.value)}
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
                  onClick={() => setPagoAEditar(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdition}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  {savingEdition ? 'Guardando...' : 'Guardar Corrección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL INDIVIDUAL */}
      {comercioModalHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Historial de Pagos — {comercioModalHistorial.nombre}
              </h3>
              <button
                onClick={() => setComercioModalHistorial(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistorialIndividual ? (
              <p className="p-8 text-center text-xs text-gray-500 font-semibold">Cargando pagos registrados...</p>
            ) : historialIndividual.length === 0 ? (
              <p className="p-8 text-center text-xs text-gray-500">No hay cobros registrados para este comercio.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historialIndividual.map((pago) => (
                  <div
                    key={pago.id}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        Período: {pago.periodo_facturado}
                      </p>
                      <p className="text-gray-500 text-[11px] capitalize mt-0.5">
                        {pago.metodo_pago} — {formatDate(pago.created_at)}
                      </p>
                      <p className="text-brand-600 font-semibold text-[11px] mt-0.5">
                        Registrado por: {pago.registrado_por_nombre}
                      </p>
                    </div>
                    <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                      {formatCurrency(pago.importe)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t dark:border-gray-700">
              <button
                onClick={() => setComercioModalHistorial(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};