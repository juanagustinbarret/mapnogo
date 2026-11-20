import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Oficio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { leerImporte } from '@/lib/importes';
import { fechaCalendario } from '@/lib/fechasArgentina';
import { obtenerPrecioPlan } from '@/lib/planes';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Search,
  DollarSign,
  LogOut,
  History,
  X,
  UserCheck,
  ShieldCheck,
  Edit2,
  Trash2,
  Rocket,
  Wrench,
  Store,
  CalendarClock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AdminNav } from '@/components/AdminNav';

type ComercioPago = Comercio & {
  es_emprendimiento?: boolean | null;
};

type OficioPago = Oficio & {
  proximo_vencimiento?: string | null;
};

type TipoMiembro = 'negocio' | 'emprendimiento' | 'oficio';

interface MiembroCobro {
  id: string;
  tipo: TipoMiembro;
  nombre: string;
  subtitulo: string;
  created_at: string;
  habilitado_admin: boolean;
  proximo_vencimiento?: string | null;
}

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

function calcularNuevoVencimiento(vencimientoActual: string | null | undefined, modalidad: 'mensual' | 'anual'): string {
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const baseStr = vencimientoActual && vencimientoActual > hoyIso ? vencimientoActual : hoyIso;
  const [anio, mes, dia] = baseStr.split('-').map(Number);
  const fechaBase = new Date(anio, (mes || 1) - 1, dia || 1);

  if (modalidad === 'anual') {
    fechaBase.setFullYear(fechaBase.getFullYear() + 1);
  } else {
    fechaBase.setMonth(fechaBase.getMonth() + 1);
  }

  const y = fechaBase.getFullYear();
  const m = String(fechaBase.getMonth() + 1).padStart(2, '0');
  const d = String(fechaBase.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface PagoAuditoria {
  id: string;
  entidadId: string | null;
  tipoEntidad: TipoMiembro;
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

  const [miembros, setMiembros] = useState<MiembroCobro[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoMiembro>('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [pestanaActiva, setPestanaActiva] = useState<'gestion' | 'historial_global'>('gestion');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [miembroModalPago, setMiembroModalPago] = useState<MiembroCobro | null>(null);
  const [modalidadPago, setModalidadPago] = useState<'mensual' | 'anual'>('mensual');
  const [montoPago, setMontoPago] = useState('10000');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [savingPayment, setSavingPayment] = useState(false);
  const clavePago = useRef<string | null>(null);

  useEffect(() => {
    clavePago.current = miembroModalPago ? crypto.randomUUID() : null;
  }, [miembroModalPago]);

  const abrirModalCobro = (miembro: MiembroCobro) => {
    setMiembroModalPago(miembro);
    setModalidadPago('mensual');
    setMontoPago(String(obtenerPrecioPlan(miembro.tipo, 'mensual')));
  };

  const [pagoAEditar, setPagoAEditar] = useState<PagoAuditoria | null>(null);
  const [montoEditado, setMontoEditado] = useState('');
  const [metodoEditado, setMetodoEditado] = useState('Transferencia');
  const [savingEdition, setSavingEdition] = useState(false);

  const [miembroModalHistorial, setMiembroModalHistorial] = useState<MiembroCobro | null>(null);
  const [historialIndividual, setHistorialIndividual] = useState<PagoAuditoria[]>([]);
  const [loadingHistorialIndividual, setLoadingHistorialIndividual] = useState(false);

  const [auditoriaPagos, setAuditoriaPagos] = useState<PagoAuditoria[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  useEffect(() => {
    void fetchMiembros();
    void fetchAuditoriaGlobal();
  }, []);

  const fetchMiembros = async () => {
    setLoading(true);

    const [{ data: comsData }, { data: oficiosData }] = await Promise.all([
      supabase
        .from('comercios')
        .select('*, rubro:rubros(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('oficios')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    const listaComercios: MiembroCobro[] = ((comsData ?? []) as ComercioPago[]).map((c) => ({
      id: c.id,
      tipo: c.es_emprendimiento ? 'emprendimiento' : 'negocio',
      nombre: c.nombre,
      subtitulo: c.direccion || c.rubro?.nombre || 'Comercio local',
      created_at: c.created_at,
      habilitado_admin: c.habilitado_admin,
    }));

    const listaOficios: MiembroCobro[] = ((oficiosData ?? []) as OficioPago[]).map((o) => ({
      id: o.id,
      tipo: 'oficio',
      nombre: o.nombre,
      subtitulo: `${o.oficio_rubro}${o.zona_cobertura ? ` · ${o.zona_cobertura}` : ''}`,
      created_at: o.created_at,
      habilitado_admin: o.habilitado_admin,
      proximo_vencimiento: o.proximo_vencimiento ?? null,
    }));

    const unificados = [...listaComercios, ...listaOficios].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setMiembros(unificados);
    setLoading(false);
  };

  const fetchAuditoriaGlobal = async () => {
    setLoadingAuditoria(true);

    try {
      const { data: pagosData, error: errPagos } = await supabase
        .from('pagos')
        .select('*')
        .order('created_at', { ascending: false });

      if (errPagos || !pagosData) throw errPagos;

      const [{ data: comsData }, { data: oficiosData }, { data: periodosData }, { data: subsData }] =
        await Promise.all([
          supabase.from('comercios').select('id, nombre, es_emprendimiento'),
          supabase.from('oficios').select('id, nombre, oficio_rubro'),
          supabase.from('periodos_suscripcion').select('id, periodo_facturado, suscripcion_id'),
          supabase.from('suscripciones').select('id, comercio_id'),
        ]);

      const mapaComercios = Object.fromEntries(
        (comsData ?? []).map((c: any) => [
          c.id,
          {
            nombre: c.nombre,
            tipo: (c.es_emprendimiento ? 'emprendimiento' : 'negocio') as TipoMiembro,
          },
        ])
      );

      const mapaOficios = Object.fromEntries(
        (oficiosData ?? []).map((o: any) => [
          o.id,
          {
            nombre: o.nombre,
            rubro: o.oficio_rubro,
          },
        ])
      );

      const mapaSubs = Object.fromEntries(
        (subsData ?? []).map((s) => [
          s.id,
          {
            comercioId: s.comercio_id,
            nombre: mapaComercios[s.comercio_id]?.nombre || 'Comercio Registrado',
            tipo: mapaComercios[s.comercio_id]?.tipo || ('negocio' as TipoMiembro),
          },
        ])
      );

      const mapaPeriodos = Object.fromEntries(
        (periodosData ?? []).map((p) => {
          const subInfo = mapaSubs[p.suscripcion_id];
          return [
            p.id,
            {
              periodo: p.periodo_facturado,
              comercioId: subInfo?.comercioId || null,
              comercioNombre: subInfo?.nombre || 'Comercio Registrado',
              tipo: subInfo?.tipo || ('negocio' as TipoMiembro),
            },
          ];
        })
      );

      const formateados: PagoAuditoria[] = pagosData.map((item: any) => {
        if (item.oficio_id) {
          const infoOficio = mapaOficios[item.oficio_id];
          return {
            id: item.id,
            entidadId: item.oficio_id,
            tipoEntidad: 'oficio',
            comercioNombre: infoOficio?.nombre || 'Oficio Registrado',
            importe: Math.round(Number(item.importe)),
            metodo_pago: item.metodo_pago,
            referencia: item.referencia,
            created_at: item.created_at,
            periodo_facturado: item.referencia || 'Suscripción Oficio',
            registrado_por_nombre: obtenerNombreAdmin(item.registrado_por),
          };
        }

        const pId = item.periodo_id || item.periodo_suscripcion_id;
        const infoPeriodo = mapaPeriodos[pId];
        const infoComercioDirecto = item.comercio_id ? mapaComercios[item.comercio_id] : null;
        const idComercioFinal = item.comercio_id || infoPeriodo?.comercioId || null;

        return {
          id: item.id,
          entidadId: idComercioFinal,
          tipoEntidad: infoComercioDirecto?.tipo || infoPeriodo?.tipo || 'negocio',
          comercioNombre:
            infoComercioDirecto?.nombre || infoPeriodo?.comercioNombre || 'Comercio Registrado',
          importe: Math.round(Number(item.importe)),
          metodo_pago: item.metodo_pago,
          referencia: item.referencia,
          created_at: item.created_at,
          periodo_facturado: infoPeriodo?.periodo || 'Cuota Mensual',
          registrado_por_nombre: obtenerNombreAdmin(item.registrado_por),
        };
      });

      setAuditoriaPagos(formateados);
    } catch (error: any) {
      console.error('Error al cargar auditoría global:', error?.message);
      setAuditoriaPagos([]);
    } finally {
      setLoadingAuditoria(false);
    }
  };

  const handleToggleEstadoPago = async (miembro: MiembroCobro) => {
    const tabla = miembro.tipo === 'oficio' ? 'oficios' : 'comercios';
    const { error } = await supabase
      .from(tabla)
      .update({ habilitado_admin: !miembro.habilitado_admin })
      .eq('id', miembro.id);

    if (error) {
      console.error('No se pudo cambiar la visibilidad:', error.message);
      alert('No se pudo cambiar la visibilidad. Probá de nuevo.');
      return;
    }
    await fetchMiembros();
  };

  const handleConfirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!miembroModalPago) return;
    const importe = leerImporte(montoPago);
    if (importe === null) {
      alert('Ingresá un importe válido mayor a $ 0.');
      return;
    }
    setSavingPayment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Error: No se encontró una sesión activa de administrador.');
        return;
      }

      let metodoEnum: 'transferencia' | 'efectivo' | 'mercadopago' = 'transferencia';
      const metodoLower = metodoPago.toLowerCase();
      if (metodoLower.includes('efectivo')) {
        metodoEnum = 'efectivo';
      } else if (metodoLower.includes('mercadopago')) {
        metodoEnum = 'mercadopago';
      }

      if (miembroModalPago.tipo === 'oficio') {
        const nuevoVencimiento = calcularNuevoVencimiento(
          miembroModalPago.proximo_vencimiento,
          modalidadPago
        );
        const periodoTexto =
          modalidadPago === 'anual'
            ? `Anual Oficio (hasta ${formatDate(nuevoVencimiento)})`
            : `Mensual Oficio (hasta ${formatDate(nuevoVencimiento)})`;

        const { error: pagoErr } = await supabase.from('pagos').insert({
          oficio_id: miembroModalPago.id,
          comercio_id: null,
          periodo_suscripcion_id: null,
          importe,
          metodo_pago: metodoEnum,
          referencia: periodoTexto,
          registrado_por: user.id,
        });

        if (pagoErr) {
          alert('Error al registrar el pago del oficio: ' + pagoErr.message);
          return;
        }

        await supabase
          .from('oficios')
          .update({
            habilitado_admin: true,
            proximo_vencimiento: nuevoVencimiento,
          })
          .eq('id', miembroModalPago.id);

        alert(
          `✅ Pago registrado exitosamente por ${obtenerNombreAdmin(user.id)} para el oficio "${
            miembroModalPago.nombre
          }" por ${formatCurrency(importe)} (${modalidadPago.toUpperCase()} — vence ${formatDate(
            nuevoVencimiento
          )})`
        );
        setMiembroModalPago(null);
        await Promise.all([fetchMiembros(), fetchAuditoriaGlobal()]);
        return;
      }

      const { error } = await supabase.rpc('registrar_pago_comercio', {
        p_comercio_id: miembroModalPago.id,
        p_importe: importe,
        p_metodo_pago: metodoEnum,
        p_registrado_por: user.id,
        p_modalidad: modalidadPago,
      });

      if (error) {
        alert('Error al registrar el pago: ' + error.message);
      } else {
        alert(
          `✅ Pago registrado exitosamente por ${obtenerNombreAdmin(user.id)} para "${
            miembroModalPago.nombre
          }" por ${formatCurrency(importe)} (${modalidadPago.toUpperCase()})`
        );
        setMiembroModalPago(null);
        await Promise.all([fetchMiembros(), fetchAuditoriaGlobal()]);
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
      alert('Ingresá un importe válido mayor a $ 0.');
      return;
    }
    setSavingEdition(true);

    try {
      let metodoEnum: 'transferencia' | 'efectivo' | 'mercadopago' = 'transferencia';
      const metodoLower = metodoEditado.toLowerCase();
      if (metodoLower.includes('efectivo')) {
        metodoEnum = 'efectivo';
      } else if (metodoLower.includes('mercadopago')) {
        metodoEnum = 'mercadopago';
      }

      if (pagoAEditar.tipoEntidad === 'oficio') {
        const { error: updateErr } = await supabase
          .from('pagos')
          .update({ importe: nuevoImporte, metodo_pago: metodoEnum })
          .eq('id', pagoAEditar.id);

        if (updateErr) {
          alert('Error al editar el pago: ' + updateErr.message);
        } else {
          alert('✅ Registro de pago corregido exitosamente.');
          setPagoAEditar(null);
          await fetchAuditoriaGlobal();
          if (miembroModalHistorial) await handleAbrirHistorialIndividual(miembroModalHistorial);
        }
        return;
      }

      const { error: rpcError } = await supabase.rpc('editar_pago_comercio', {
        p_pago_id: pagoAEditar.id,
        p_nuevo_importe: nuevoImporte,
        p_nuevo_metodo: metodoEnum,
      });

      if (rpcError) {
        alert('Error al editar el pago: ' + rpcError.message);
      } else {
        alert('✅ Registro de pago corregido exitosamente.');
        setPagoAEditar(null);
        await fetchAuditoriaGlobal();
        if (miembroModalHistorial) await handleAbrirHistorialIndividual(miembroModalHistorial);
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setSavingEdition(false);
    }
  };

  const handleEliminarPago = async (pago: PagoAuditoria) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar el pago de ${formatCurrency(pago.importe)} de "${
          pago.comercioNombre
        }"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      if (pago.tipoEntidad === 'oficio') {
        const { error: delErr } = await supabase.from('pagos').delete().eq('id', pago.id);
        if (delErr) {
          alert('Error al eliminar el pago: ' + delErr.message);
        } else {
          alert('✅ Registro de pago eliminado correctamente.');
          await Promise.all([fetchAuditoriaGlobal(), fetchMiembros()]);
          if (miembroModalHistorial) await handleAbrirHistorialIndividual(miembroModalHistorial);
        }
        return;
      }

      const { error: rpcError } = await supabase.rpc('eliminar_pago_comercio', {
        p_pago_id: pago.id,
      });

      if (rpcError) {
        alert('Error al eliminar el pago: ' + rpcError.message);
      } else {
        alert('✅ Registro de pago eliminado correctamente.');
        await Promise.all([fetchAuditoriaGlobal(), fetchMiembros()]);
        if (miembroModalHistorial) await handleAbrirHistorialIndividual(miembroModalHistorial);
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    }
  };

  const handleAbrirHistorialIndividual = async (miembro: MiembroCobro) => {
    setMiembroModalHistorial(miembro);
    setLoadingHistorialIndividual(true);

    try {
      if (miembro.tipo === 'oficio') {
        const { data: pagosOficio, error } = await supabase
          .from('pagos')
          .select('*')
          .eq('oficio_id', miembro.id)
          .order('created_at', { ascending: false });

        if (error || !pagosOficio) {
          setHistorialIndividual([]);
        } else {
          setHistorialIndividual(
            pagosOficio.map((item: any) => ({
              id: item.id,
              entidadId: miembro.id,
              tipoEntidad: 'oficio',
              comercioNombre: miembro.nombre,
              importe: Math.round(Number(item.importe)),
              metodo_pago: item.metodo_pago,
              referencia: item.referencia,
              created_at: item.created_at,
              periodo_facturado: item.referencia || 'Suscripción Oficio',
              registrado_por_nombre: obtenerNombreAdmin(item.registrado_por),
            }))
          );
        }
        return;
      }

      const { data: sub } = await supabase
        .from('suscripciones')
        .select('id')
        .eq('comercio_id', miembro.id)
        .maybeSingle();

      let idsPeriodos: string[] = [];
      let mapaPeriodos: Record<string, string> = {};

      if (sub) {
        const { data: periodos } = await supabase
          .from('periodos_suscripcion')
          .select('id, periodo_facturado')
          .eq('suscripcion_id', sub.id);

        idsPeriodos = (periodos ?? []).map((p) => p.id);
        mapaPeriodos = Object.fromEntries(
          (periodos ?? []).map((p) => [p.id, p.periodo_facturado])
        );
      }

      const { data: pagosData, error } = await supabase
        .from('pagos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !pagosData) {
        setHistorialIndividual([]);
      } else {
        const pagosDelComercio = pagosData.filter((item: any) => {
          const pId = item.periodo_id || item.periodo_suscripcion_id;
          return item.comercio_id === miembro.id || (pId && idsPeriodos.includes(pId));
        });

        const formateados: PagoAuditoria[] = pagosDelComercio.map((item: any) => {
          const pId = item.periodo_id || item.periodo_suscripcion_id;
          return {
            id: item.id,
            entidadId: miembro.id,
            tipoEntidad: miembro.tipo,
            comercioNombre: miembro.nombre,
            importe: Math.round(Number(item.importe)),
            metodo_pago: item.metodo_pago,
            referencia: item.referencia,
            created_at: item.created_at,
            periodo_facturado: mapaPeriodos[pId] || 'Cuota Mensual',
            registrado_por_nombre: obtenerNombreAdmin(item.registrado_por),
          };
        });
        setHistorialIndividual(formateados);
      }
    } catch (err) {
      console.error('Error al cargar historial individual:', err);
      setHistorialIndividual([]);
    } finally {
      setLoadingHistorialIndividual(false);
    }
  };

  const abrirModalEditar = (pago: PagoAuditoria) => {
    setPagoAEditar(pago);
    setMontoEditado(String(pago.importe));
    setMetodoEditado(pago.metodo_pago);
  };

  const renderBadgeTipo = (tipo: TipoMiembro, compacto = false) => {
    if (tipo === 'emprendimiento') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 inline-flex items-center gap-1 shrink-0">
          <Rocket className="w-2.5 h-2.5" /> {compacto ? 'Emprend.' : 'Emprendimiento'}
        </span>
      );
    }
    if (tipo === 'oficio') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 inline-flex items-center gap-1 shrink-0">
          <Wrench className="w-2.5 h-2.5" /> Oficio
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 inline-flex items-center gap-1 shrink-0">
        <Store className="w-2.5 h-2.5" /> Comercio
      </span>
    );
  };

  const filtradosMiembros = miembros.filter((m) => {
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
    const q = search.toLowerCase();
    return m.nombre.toLowerCase().includes(q) || m.subtitulo.toLowerCase().includes(q);
  });

  const filtradosAuditoria = auditoriaPagos.filter((p) => {
    if (filtroTipo !== 'todos' && p.tipoEntidad !== filtroTipo) return false;

    const coincideTexto =
      p.comercioNombre.toLowerCase().includes(search.toLowerCase()) ||
      p.registrado_por_nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.metodo_pago.toLowerCase().includes(search.toLowerCase());

    const fechaPagoStr = p.created_at ? fechaCalendario(p.created_at) : '';

    const coincideDesde = !fechaDesde || fechaPagoStr >= fechaDesde;
    const coincideHasta = !fechaHasta || fechaPagoStr <= fechaHasta;

    return coincideTexto && coincideDesde && coincideHasta;
  });

  const totalFiltrado = filtradosAuditoria.reduce((acc, curr) => acc + curr.importe, 0);

  const conteos = {
    todos: miembros.length,
    negocio: miembros.filter((m) => m.tipo === 'negocio').length,
    emprendimiento: miembros.filter((m) => m.tipo === 'emprendimiento').length,
    oficio: miembros.filter((m) => m.tipo === 'oficio').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-blue-600" /> Registro de Pagos & Miembros
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Auditoría de ingresos mensual, antigüedad de comercios, emprendimientos y oficios, y extensión automática de vencimientos.
            </p>
          </div>

          <button
            onClick={() => {
              void signOut();
              navigate('/admin/login');
            }}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

        <AdminNav />
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b dark:border-gray-700 pb-4">
          <div className="flex flex-wrap gap-2">
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

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={
                pestanaActiva === 'gestion'
                  ? 'Buscar comercio, emprendimiento u oficio...'
                  : 'Buscar miembro, admin o medio...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* FILTRO POR CATEGORÍA DE PLAN */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filtroTipo === 'todos'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Todos ({conteos.todos})
          </button>

          <button
            type="button"
            onClick={() => setFiltroTipo('negocio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
              filtroTipo === 'negocio'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> Comercios ({conteos.negocio})
          </button>

          <button
            type="button"
            onClick={() => setFiltroTipo('emprendimiento')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
              filtroTipo === 'emprendimiento'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" /> Emprendimientos ({conteos.emprendimiento})
          </button>

          <button
            type="button"
            onClick={() => setFiltroTipo('oficio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
              filtroTipo === 'oficio'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> Oficios ({conteos.oficio})
          </button>
        </div>

        {pestanaActiva === 'gestion' &&
          (loading ? (
            <div className="p-12 text-center text-gray-500 font-semibold">Cargando registros...</div>
          ) : (
            <div className="space-y-4">
              {/* VISTA MÓVIL / TABLET */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
                {filtradosMiembros.map((m) => (
                  <div
                    key={`${m.tipo}-${m.id}`}
                    className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">{m.nombre}</h4>
                          {renderBadgeTipo(m.tipo)}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{m.subtitulo}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Alta: {formatDate(m.created_at)}
                          {m.proximo_vencimiento && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                              · Vence: {formatDate(m.proximo_vencimiento)}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-brand-600 shrink-0">
                        {calcularAntiguedadMeses(m.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800">
                      <button
                        onClick={() => void handleToggleEstadoPago(m)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                          m.habilitado_admin
                            ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                        }`}
                      >
                        {m.habilitado_admin ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {m.habilitado_admin ? 'Visible' : 'Oculto'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleAbrirHistorialIndividual(m)}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs inline-flex items-center gap-1 transition"
                        >
                          <History className="w-3.5 h-3.5" /> Historial
                        </button>

                        <button
                          onClick={() => abrirModalCobro(m)}
                          className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* VISTA ESCRITORIO */}
              <div className="hidden lg:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3.5 w-[28%]">Miembro / Categoría</th>
                      <th className="p-3.5 w-[15%]">Miembro Desde</th>
                      <th className="p-3.5 w-[14%]">Antigüedad</th>
                      <th className="p-3.5 w-[16%]">Estado Publicación</th>
                      <th className="p-3.5 w-[27%] text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                    {filtradosMiembros.map((m) => (
                      <tr key={`${m.tipo}-${m.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate">{m.nombre}</span>
                              {renderBadgeTipo(m.tipo, true)}
                            </div>
                            <p className="text-[11px] font-normal text-gray-500 dark:text-gray-400 truncate">
                              {m.subtitulo}
                              {m.proximo_vencimiento && (
                                <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                  · Vence {formatDate(m.proximo_vencimiento)}
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300 truncate">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="p-3.5 text-xs font-semibold text-brand-600 truncate">
                          {calcularAntiguedadMeses(m.created_at)}
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => void handleToggleEstadoPago(m)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                              m.habilitado_admin
                                ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                            }`}
                          >
                            {m.habilitado_admin ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {m.habilitado_admin ? 'Visible' : 'Oculto'}
                          </button>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => void handleAbrirHistorialIndividual(m)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs inline-flex items-center gap-1 shadow-sm transition"
                          >
                            <History className="w-3.5 h-3.5" /> Historial
                          </button>

                          <button
                            onClick={() => abrirModalCobro(m)}
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
          ))}

        {pestanaActiva === 'historial_global' && (
          <div className="space-y-4">
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
                    onClick={() => {
                      setFechaDesde('');
                      setFechaHasta('');
                    }}
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
                      <th className="p-3.5 w-[26%]">Miembro</th>
                      <th className="p-3.5 w-[16%]">Fecha de Pago</th>
                      <th className="p-3.5 w-[14%]">Medio</th>
                      <th className="p-3.5 w-[14%]">Monto</th>
                      <th className="p-3.5 w-[18%]">Registrado Por</th>
                      <th className="p-3.5 w-[12%] text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                    {filtradosAuditoria.map((pago) => (
                      <tr key={pago.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{pago.comercioNombre}</span>
                            {renderBadgeTipo(pago.tipoEntidad, true)}
                          </div>
                        </td>
                        <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300 truncate">
                          {formatDate(pago.created_at)}
                        </td>
                        <td className="p-3.5 text-xs font-semibold capitalize truncate">{pago.metodo_pago}</td>
                        <td className="p-3.5 text-xs font-bold text-green-600 truncate">
                          {formatCurrency(pago.importe)}
                        </td>
                        <td className="p-3.5 text-xs font-bold text-brand-600 flex items-center gap-1.5 truncate">
                          <UserCheck className="w-4 h-4 text-brand-600 shrink-0" />
                          {pago.registrado_por_nombre}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => abrirModalEditar(pago)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Editar este registro"
                            aria-label="Editar este registro"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleEliminarPago(pago)}
                            className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Eliminar este pago"
                            aria-label="Eliminar este pago"
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

      {/* MODAL COBRAR CUOTA */}
      {miembroModalPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Registrar Cuota para {miembroModalPago.nombre}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {renderBadgeTipo(miembroModalPago.tipo)}
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  Tarifa sugerida: {formatCurrency(obtenerPrecioPlan(miembroModalPago.tipo, 'mensual'))}/mes ·{' '}
                  {formatCurrency(obtenerPrecioPlan(miembroModalPago.tipo, 'anual'))}/año
                </span>
              </div>
              {miembroModalPago.tipo === 'oficio' && miembroModalPago.proximo_vencimiento && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Vencimiento actual: {formatDate(miembroModalPago.proximo_vencimiento)}
                </p>
              )}
            </div>

            <form onSubmit={(e) => void handleConfirmarPago(e)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Duración de la Suscripción</label>
                <select
                  value={modalidadPago}
                  onChange={(e) => {
                    const mode = e.target.value as 'mensual' | 'anual';
                    setModalidadPago(mode);
                    setMontoPago(String(obtenerPrecioPlan(miembroModalPago.tipo, mode)));
                  }}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900 font-semibold"
                >
                  <option value="mensual">Mensual (Vence en 1 mes)</option>
                  <option value="anual">Anual (Vence en 1 año)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Monto Cobrado ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder={String(obtenerPrecioPlan(miembroModalPago.tipo, modalidadPago))}
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
                  onClick={() => setMiembroModalPago(null)}
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

      {/* MODAL EDITAR COBRO */}
      {pagoAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Editar Cobro de {pagoAEditar.comercioNombre}
            </h3>

            <form onSubmit={(e) => void handleGuardarEdicionPago(e)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Monto Correcto ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="10000"
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
      {miembroModalHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Historial de Pagos — {miembroModalHistorial.nombre}
              </h3>
              <button
                onClick={() => setMiembroModalHistorial(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistorialIndividual ? (
              <p className="p-8 text-center text-xs text-gray-500 font-semibold">Cargando pagos registrados...</p>
            ) : historialIndividual.length === 0 ? (
              <p className="p-8 text-center text-xs text-gray-500">
                No hay cobros registrados para este {miembroModalHistorial.tipo === 'oficio' ? 'oficio' : 'comercio'}.
              </p>
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
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                        {formatCurrency(pago.importe)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirModalEditar(pago)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          title="Editar este registro"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleEliminarPago(pago)}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          title="Eliminar este pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t dark:border-gray-700">
              <button
                onClick={() => setMiembroModalHistorial(null)}
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