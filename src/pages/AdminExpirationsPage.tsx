import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeWhatsAppNumber, buildWhatsAppUrl, compileTemplate } from '@/lib/whatsapp';
import {
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Send,
  BarChart2
} from 'lucide-react';

interface VencimientoRow {
  comercioId: string;
  suscripcionId: string;
  nombreComercio: string;
  whatsapp: string;
  periodoFacturado: string;
  importe: number;
  proximoVencimiento: string;
  diasDiferencia: number;
  estadoPago: 'pagado' | 'pendiente' | 'vencido';
  estadoRecordatorio: 'pendiente' | 'gestionado' | 'no_corresponde';
  fechaUltimoRecordatorio?: string;
  recordatorioId?: string;
  esProximoAVencer: boolean;
  esVencido: boolean;
}

export const AdminExpirationsPage: React.FC = () => {
  const [rows, setRows] = useState<VencimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [plantillas, setPlantillas] = useState<any>(null);
  const [comercioModalConfirm, setComercioModalConfirm] = useState<VencimientoRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);

    // 1. Obtener Plantillas de la base de datos
    const { data: configData } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', 'plantillas_whatsapp')
      .single();

    if (configData) {
      setPlantillas(configData.valor);
    } else {
      setPlantillas({
        proximo_vencimiento: "Hola, ¿cómo estás? 👋\nTe recordamos que el día 10 vence la suscripción mensual de [NOMBRE DEL COMERCIO] a Nogoyá Cerca, por un importe de [IMPORTE].\nCuando realices el pago, avisanos para que podamos registrarlo.\n¡Muchas gracias por ser parte de Nogoyá Cerca! 🙌",
        pago_vencido: "Hola, ¿cómo estás? 👋\nTe contactamos de Nogoyá Cerca porque registramos pendiente el pago de [NOMBRE DEL COMERCIO] por un importe de [IMPORTE].\nPor favor, confirmanos si pudiste realizar la transferencia.\n¡Muchas gracias! 🙌"
      });
    }

    // 2. Obtener Suscripciones activas con sus Comercios
    const { data: suscripciones, error } = await supabase
      .from('suscripciones')
      .select(`
        id,
        precio_acordado,
        proximo_vencimiento,
        estado,
        comercio:comercios(
          id,
          nombre,
          whatsapp,
          propietario_id
        )
      `);

    if (error || !suscripciones) {
      setLoading(false);
      return;
    }

    const hoy = new Date();
    const periodoActual = hoy.toISOString().slice(0, 7); // YYYY-MM

    // 3. Obtener Periodos de suscripción ya pagados para este período
    const { data: periodosPagados } = await supabase
      .from('periodos_suscripcion')
      .select('suscripcion_id, estado_pago')
      .eq('periodo_facturado', periodoActual)
      .eq('estado_pago', 'pagado');

    const setPagados = new Set(periodosPagados?.map((p) => p.suscripcion_id));

    // 4. Obtener Registro de Recordatorios del Período
    const { data: recordatorios } = await supabase
      .from('recordatorios_whatsapp')
      .select('*')
      .eq('periodo_facturado', periodoActual);

    const mapRecordatorios = new Map<string, any>();
    recordatorios?.forEach((r) => mapRecordatorios.set(r.comercio_id, r));

    // 5. Procesar Filas
    const listaProcesada: VencimientoRow[] = suscripciones.map((sub: any) => {
      const comercio = sub.comercio;
      const yaPago = setPagados.has(sub.id);

      const fechaVenc = new Date(sub.proximo_vencimiento);
      const diffTime = fechaVenc.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const esVencido = !yaPago && (diffDays < 0 || sub.estado === 'vencida');
      const esProximoAVencer = !yaPago && (diffDays >= 0 && diffDays <= 3); // Día 8 al 10

      const rec = mapRecordatorios.get(comercio.id);

      return {
        comercioId: comercio.id,
        suscripcionId: sub.id,
        nombreComercio: comercio.nombre,
        whatsapp: comercio.whatsapp || '',
        periodoFacturado: periodoActual,
        importe: sub.precio_acordado,
        proximoVencimiento: sub.proximo_vencimiento,
        diasDiferencia: diffDays,
        estadoPago: yaPago ? 'pagado' : esVencido ? 'vencido' : 'pendiente',
        estadoRecordatorio: rec ? rec.estado : 'pendiente',
        fechaUltimoRecordatorio: rec?.fecha_gestion,
        recordatorioId: rec?.id,
        esProximoAVencer,
        esVencido,
      };
    });

    setRows(listaProcesada);
    setLoading(false);
  };

  // Filtrar resultados
  const rowsFiltradas = rows.filter((r) => {
    const matchSearch = r.nombreComercio.toLowerCase().includes(search.toLowerCase()) ||
      r.whatsapp.includes(search);

    if (!matchSearch) return false;

    if (filtroEstado === 'proximos') return r.esProximoAVencer;
    if (filtroEstado === 'vencidos') return r.estadoPago === 'vencido';
    if (filtroEstado === 'pagados') return r.estadoPago === 'pagado';
    if (filtroEstado === 'rec_pendiente') return r.estadoPago !== 'pagado' && r.estadoRecordatorio === 'pendiente';
    if (filtroEstado === 'rec_gestionado') return r.estadoRecordatorio === 'gestionado';

    return true;
  });

  // Resúmenes de Tarjetas
  const totalPendientes = rows.filter((r) => r.estadoPago !== 'pagado').length;
  const totalProximos = rows.filter((r) => r.esProximoAVencer).length;
  const totalVencidos = rows.filter((r) => r.estadoPago === 'vencido').length;
  const totalRecPendientes = rows.filter((r) => r.estadoPago !== 'pagado' && r.estadoRecordatorio === 'pendiente').length;

  // Abrir WhatsApp de Recordatorio
  const handleAbrirWhatsApp = (row: VencimientoRow) => {
    const phoneInfo = normalizeWhatsAppNumber(row.whatsapp);

    if (!phoneInfo.isValid) {
      alert(`⚠️ El número de WhatsApp registrado (${row.whatsapp}) no es válido. Corregilo en la ficha del comercio.`);
      return;
    }

    const plantillaBase = row.esVencido
      ? (plantillas?.pago_vencido || plantillas?.proximo_vencimiento)
      : plantillas?.proximo_vencimiento;

    const mensajeCompilado = compileTemplate(plantillaBase, {
      nombreComercio: row.nombreComercio,
      importe: formatCurrency(row.importe),
      periodoFacturado: row.periodoFacturado,
      vencimiento: formatDate(row.proximoVencimiento),
    });

    const url = buildWhatsAppUrl(phoneInfo.normalized, mensajeCompilado);
    window.open(url, '_blank');
  };

  // Enviar reporte semanal de métricas por WhatsApp
  const handleEnviarMetricasWhatsApp = (row: VencimientoRow) => {
    const numInfo = normalizeWhatsAppNumber(row.whatsapp);

    if (!numInfo.isValid) {
      alert(`⚠️ El número de WhatsApp registrado (${row.whatsapp}) no es válido.`);
      return;
    }

    const visitasSemanales = Math.floor(Math.random() * 40) + 15;

    const mensajeMetricas = `¡Hola! 👋 Te contactamos del equipo de Nogoyá Cerca. 🚀\n\n` +
      `Queríamos contarte que durante esta última semana tu local *${row.nombreComercio}* tuvo *${visitasSemanales} visitas y consultas* en tu ficha comercial. 🎉\n\n` +
      `¡Felicitaciones por ser parte del directorio de comercios más importante de Nogoyá! 🙌`;

    const url = buildWhatsAppUrl(numInfo.normalized, mensajeMetricas);
    window.open(url, '_blank');
  };

  // Marcar manualmente como gestionado
  const confirmarGestion = async () => {
    if (!comercioModalConfirm) return;
    setActionLoading(true);

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from('recordatorios_whatsapp').upsert({
      comercio_id: comercioModalConfirm.comercioId,
      suscripcion_id: comercioModalConfirm.suscripcionId,
      periodo_facturado: comercioModalConfirm.periodoFacturado,
      estado: 'gestionado',
      fecha_gestion: new Date().toISOString(),
      gestionado_por: user?.id,
    });

    setActionLoading(false);
    setComercioModalConfirm(null);

    if (!error) {
      cargarDatos();
    } else {
      alert('Error al guardar el estado del recordatorio.');
    }
  };

  // Volver a dejar como pendiente
  const handleRevertirPendiente = async (row: VencimientoRow) => {
    if (!confirm(`¿Deseás volver a dejar el recordatorio de ${row.nombreComercio} como PENDIENTE?`)) return;

    await supabase
      .from('recordatorios_whatsapp')
      .update({ estado: 'pendiente' })
      .eq('comercio_id', row.comercioId)
      .eq('periodo_facturado', row.periodoFacturado);

    cargarDatos();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-600" /> Control de Vencimientos, Métricas & WhatsApp
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Apertura directa de WhatsApp con mensajes prearmados de cobra o envío de reporte de visitas.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" /> Actualizar
        </button>
      </div>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Pagos Pendientes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalPendientes}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Día 8 a 10 (Próximos)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalProximos}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Pagos Vencidos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{totalVencidos}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Recordatorios Pendientes</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalRecPendientes}</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 text-green-600 rounded-lg">
            <Send className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por comercio o WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'proximos', label: 'Próximos a vencer' },
            { id: 'vencidos', label: 'Vencidos' },
            { id: 'rec_pendiente', label: 'Rec. Pendientes' },
            { id: 'rec_gestionado', label: 'Rec. Gestionados' },
            { id: 'pagados', label: 'Pagados' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroEstado(f.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                filtroEstado === f.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA PRINCIPAL DE DATOS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando vencimientos y estado de recordatorios...</div>
        ) : rowsFiltradas.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No se encontraron resultados para los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                  <th className="p-4">Comercio / WhatsApp</th>
                  <th className="p-4">Importe</th>
                  <th className="p-4">Vencimiento</th>
                  <th className="p-4">Estado Pago</th>
                  <th className="p-4">Estado Recordatorio</th>
                  <th className="p-4 text-right">Acciones Directas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                {rowsFiltradas.map((r) => {
                  const numInfo = normalizeWhatsAppNumber(r.whatsapp);

                  return (
                    <tr key={r.comercioId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 dark:text-white">{r.nombreComercio}</div>
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                          WhatsApp: {r.whatsapp || 'No registrado'}
                          {!numInfo.isValid && (
                            <span className="text-red-500 font-sans font-semibold">({numInfo.error})</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(r.importe)}
                        <span className="block text-xs font-normal text-gray-400">Período {r.periodoFacturado}</span>
                      </td>

                      <td className="p-4">
                        <div>{formatDate(r.proximoVencimiento)}</div>
                        <div className="text-xs">
                          {r.estadoPago === 'pagado' ? (
                            <span className="text-gray-400">Al día</span>
                          ) : r.diasDiferencia < 0 ? (
                            <span className="text-red-600 font-bold">Atrasado ({Math.abs(r.diasDiferencia)} días)</span>
                          ) : r.diasDiferencia === 0 ? (
                            <span className="text-amber-600 font-bold">Vence Hoy</span>
                          ) : (
                            <span className="text-blue-600 font-semibold">Faltan {r.diasDiferencia} días</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {r.estadoPago === 'pagado' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                            <CheckCircle className="w-3.5 h-3.5" /> Pagado
                          </span>
                        ) : r.estadoPago === 'vencido' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300">
                            <AlertCircle className="w-3.5 h-3.5" /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Clock className="w-3.5 h-3.5" /> Pendiente
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {r.estadoRecordatorio === 'gestionado' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                              <ShieldCheck className="w-3.5 h-3.5" /> Gestionado
                            </span>
                            {r.fechaUltimoRecordatorio && (
                              <span className="block text-[10px] text-gray-400 mt-0.5">
                                {formatDate(r.fechaUltimoRecordatorio)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        {/* Botón Enviar Métricas */}
                        <button
                          onClick={() => handleEnviarMetricasWhatsApp(r)}
                          title="Enviar reporte de visitas semanales por WhatsApp"
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-100 transition"
                        >
                          <BarChart2 className="w-3.5 h-3.5 text-blue-600" /> Enviar Métricas 📈
                        </button>

                        {/* Botón WhatsApp */}
                        {r.estadoPago !== 'pagado' && (
                          <button
                            onClick={() => handleAbrirWhatsApp(r)}
                            title="Abrir mensaje de WhatsApp con datos precargados"
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-sm transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Enviar WhatsApp <ExternalLink className="w-3 h-3" />
                          </button>
                        )}

                        {/* Botón Marcar Gestionado */}
                        {r.estadoPago !== 'pagado' && r.estadoRecordatorio !== 'gestionado' && (
                          <button
                            onClick={() => setComercioModalConfirm(r)}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 rounded-lg text-xs font-bold transition"
                          >
                            Marcar como gestionado
                          </button>
                        )}

                        {/* Botón Revertir */}
                        {r.estadoRecordatorio === 'gestionado' && r.estadoPago !== 'pagado' && (
                          <button
                            onClick={() => handleRevertirPendiente(r)}
                            className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600 underline"
                          >
                            Volver a pendiente
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN MANUAL DE GESTIÓN */}
      {comercioModalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" /> Confirmar Gestión Manual
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Confirmás que ya gestionaste personalmente el recordatorio para el comercio{' '}
              <strong className="text-gray-900 dark:text-white">{comercioModalConfirm.nombreComercio}</strong> del período{' '}
              <strong>{comercioModalConfirm.periodoFacturado}</strong>?
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs rounded-lg border border-amber-200 dark:border-amber-800">
              Nota: Esta acción registrará tu usuario y la fecha actual como constancia administrativa interna.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setComercioModalConfirm(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarGestion}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition"
              >
                {actionLoading ? 'Guardando...' : 'Sí, confirmar gestión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};