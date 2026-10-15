import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart2, CheckCircle, Clock, MessageCircle, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PlantillasWhatsApp, RecordatorioWhatsApp } from '@/types/database.types';
import { formatCurrency, formatDate, formatPeriodo, mensajeError } from '@/lib/formatters';
import { diasHasta, haceDias, periodoActual } from '@/lib/fechas';
import { buildWhatsAppUrl, compileTemplate } from '@/lib/whatsapp';
import { NOMBRE_APP } from '@/config/marca';
import { PLANTILLAS_POR_DEFECTO, listarRecordatorios, marcarRecordatorio, obtenerPlantillas } from '@/services/configuracion';
import { obtenerMetricas } from '@/services/metricas';
import { SuscripcionConComercio, listarSuscripcionesAdmin, suscripcionesPagadasEnPeriodo } from '@/services/suscripciones';

// Días antes del vencimiento en que se considera "próximo a vencer"
const DIAS_AVISO = 5;

type Filtro = 'todos' | 'proximos' | 'vencidos' | 'pagados' | 'rec_pendiente' | 'rec_gestionado';

interface Fila {
  suscripcion: SuscripcionConComercio;
  nombre: string;
  whatsapp: string;
  dias: number;
  pagado: boolean;
  vencido: boolean;
  proximo: boolean;
  recordatorio: RecordatorioWhatsApp | undefined;
}

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'proximos', etiqueta: 'Próximos a vencer' },
  { valor: 'vencidos', etiqueta: 'Vencidos' },
  { valor: 'pagados', etiqueta: 'Pagados' },
  { valor: 'rec_pendiente', etiqueta: 'Sin avisar' },
  { valor: 'rec_gestionado', etiqueta: 'Avisados' },
];

export const AdminExpirationsPage: React.FC = () => {
  const { user } = useAuth();
  const { avisar } = useToast();
  const periodo = periodoActual();

  const [suscripciones, setSuscripciones] = useState<SuscripcionConComercio[]>([]);
  const [pagadas, setPagadas] = useState<Set<string>>(new Set());
  const [recordatorios, setRecordatorios] = useState<RecordatorioWhatsApp[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillasWhatsApp>(PLANTILLAS_POR_DEFECTO);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [subs, pagadasPeriodo, recs, tpl] = await Promise.all([
        listarSuscripcionesAdmin(),
        suscripcionesPagadasEnPeriodo(periodo),
        listarRecordatorios(periodo),
        obtenerPlantillas(),
      ]);
      setSuscripciones(subs);
      setPagadas(pagadasPeriodo);
      setRecordatorios(recs);
      setPlantillas(tpl);
    } catch (e) {
      avisar(`No se pudieron cargar los vencimientos: ${mensajeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [avisar, periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filas: Fila[] = useMemo(
    () =>
      suscripciones.map((s) => {
        const dias = diasHasta(s.proximo_vencimiento);
        const pagado = pagadas.has(s.id);
        return {
          suscripcion: s,
          nombre: s.comercio?.nombre ?? '?',
          whatsapp: s.comercio?.whatsapp ?? '',
          dias,
          pagado,
          vencido: !pagado && (dias < 0 || s.estado === 'vencida'),
          proximo: !pagado && dias >= 0 && dias <= DIAS_AVISO,
          recordatorio: recordatorios.find((r) => r.comercio_id === s.comercio_id),
        };
      }),
    [suscripciones, pagadas, recordatorios],
  );

  const avisado = (f: Fila) => f.recordatorio?.estado === 'gestionado';

  const texto = search.toLowerCase();
  const filtradas = filas.filter((f) => {
    if (!f.nombre.toLowerCase().includes(texto) && !f.whatsapp.includes(search)) return false;
    switch (filtro) {
      case 'proximos':
        return f.proximo;
      case 'vencidos':
        return f.vencido;
      case 'pagados':
        return f.pagado;
      case 'rec_pendiente':
        return !f.pagado && !avisado(f);
      case 'rec_gestionado':
        return avisado(f);
      default:
        return true;
    }
  });

  const enviarRecordatorio = (f: Fila) => {
    const plantilla = f.vencido ? plantillas.pago_vencido : plantillas.proximo_vencimiento;
    const mensaje = compileTemplate(plantilla, {
      nombreComercio: f.nombre,
      importe: formatCurrency(f.suscripcion.precio_acordado),
      periodoFacturado: formatPeriodo(periodo),
      vencimiento: formatDate(f.suscripcion.proximo_vencimiento),
    });
    const url = buildWhatsAppUrl(f.whatsapp, mensaje);
    if (!url) {
      avisar(`El WhatsApp de ${f.nombre} (${f.whatsapp || 'vacío'}) no es válido. Corregilo en la ficha.`, 'error');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  // Reporte semanal con las métricas REALES de los últimos 7 días
  const enviarMetricas = async (f: Fila) => {
    // La ventana se abre antes de esperar a la base: si se abre después,
    // los bloqueadores de ventanas emergentes (sobre todo en celulares) la frenan.
    const ventana = window.open('', '_blank');
    if (ventana) ventana.opener = null;
    setOcupado(f.suscripcion.id);
    try {
      const m = await obtenerMetricas(f.suscripcion.comercio_id, haceDias(7));
      const mensaje =
        `Hola *${f.nombre}*! 👋\n\nEstas son las métricas de tu ficha en ${NOMBRE_APP} de los últimos 7 días:\n` +
        `• Visitas a la ficha: *${m.visitas}*\n• Consultas por WhatsApp: *${m.whatsapp}*\n• Rutas "Cómo llegar": *${m.comoLlegar}*\n\n` +
        `¡Gracias por ser parte de ${NOMBRE_APP}! 🙌`;
      const url = buildWhatsAppUrl(f.whatsapp, mensaje);
      if (!url) {
        ventana?.close();
        avisar(`El WhatsApp de ${f.nombre} no es válido.`, 'error');
        return;
      }
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (e) {
      ventana?.close();
      avisar(`No se pudieron obtener las métricas: ${mensajeError(e)}`, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const cambiarAviso = async (f: Fila, gestionado: boolean) => {
    setOcupado(f.suscripcion.id);
    try {
      await marcarRecordatorio({
        comercioId: f.suscripcion.comercio_id,
        suscripcionId: f.suscripcion.id,
        periodo,
        estado: gestionado ? 'gestionado' : 'pendiente',
        usuarioId: user?.id,
      });
      setRecordatorios(await listarRecordatorios(periodo));
    } catch (e) {
      avisar(`No se pudo actualizar el aviso: ${mensajeError(e)}`, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const resumen = [
    { titulo: 'Próximos a vencer', valor: filas.filter((f) => f.proximo).length, clase: 'text-amber-600' },
    { titulo: 'Vencidos', valor: filas.filter((f) => f.vencido).length, clase: 'text-red-600' },
    { titulo: `Pagados en ${formatPeriodo(periodo)}`, valor: filas.filter((f) => f.pagado).length, clase: 'text-green-600' },
    { titulo: 'Sin avisar', valor: filas.filter((f) => !f.pagado && !avisado(f)).length, clase: 'text-gray-900 dark:text-white' },
  ];

  // Piezas de cada fila, compartidas por la tabla (computadora) y las tarjetas (celular)
  const celdaVencimiento = (f: Fila) => (
    <>
      <span className="font-semibold">{formatDate(f.suscripcion.proximo_vencimiento)}</span>
      <span className={`block ${f.dias < 0 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
        {f.dias < 0 ? `hace ${-f.dias} días` : f.dias === 0 ? 'hoy' : `en ${f.dias} días`}
      </span>
    </>
  );

  const etiquetaEstado = (f: Fila) =>
    f.pagado ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-green-100 text-green-800">Pagado</span>
    ) : f.vencido ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-red-100 text-red-800 inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Vencido
      </span>
    ) : f.proximo ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-amber-100 text-amber-800">Por vencer</span>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-gray-100 text-gray-600">Al día</span>
    );

  const celdaAviso = (f: Fila) =>
    avisado(f) ? (
      <span className="text-green-700 font-bold inline-flex items-center gap-1">
        <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Avisado {formatDate(f.recordatorio?.fecha_gestion)}
      </span>
    ) : (
      <span className="text-gray-500">Sin avisar</span>
    );

  const acciones = (f: Fila) => (
    <>
      {!f.pagado && (
        <button
          onClick={() => enviarRecordatorio(f)}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Recordar
        </button>
      )}
      {!f.pagado &&
        (avisado(f) ? (
          <button
            onClick={() => void cambiarAviso(f, false)}
            disabled={ocupado === f.suscripcion.id}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Deshacer
          </button>
        ) : (
          <button
            onClick={() => void cambiarAviso(f, true)}
            disabled={ocupado === f.suscripcion.id}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Marcar avisado
          </button>
        ))}
      <button
        onClick={() => void enviarMetricas(f)}
        disabled={ocupado === f.suscripcion.id}
        className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center gap-1"
        title="Enviar por WhatsApp las métricas reales de los últimos 7 días"
      >
        <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" /> Métricas
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {resumen.map((r) => (
          <div key={r.titulo} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{r.titulo}</p>
            <p className={`text-3xl font-bold mt-1 ${r.clase}`}>{r.valor}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-600" aria-hidden="true" /> Vencimientos y recordatorios
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Los mensajes usan las plantillas de{' '}
              <Link to="/admin/configuracion" className="text-brand-600 font-semibold hover:underline">
                Configuración
              </Link>
              .
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="buscar-vencimiento" className="sr-only">Buscar comercio</label>
            <input
              id="buscar-vencimiento"
              type="search"
              placeholder="Buscar comercio o WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar vencimientos">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filtro === f.valor ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No hay comercios en este filtro.</div>
        ) : (
          <>
            {/* Celular: tarjetas */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filtradas.map((f) => (
                <div key={f.suscripcion.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">{f.nombre}</h3>
                      <p className="text-xs text-gray-500">{formatCurrency(f.suscripcion.precio_acordado)} / mes</p>
                    </div>
                    {etiquetaEstado(f)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>{celdaVencimiento(f)}</div>
                    <div>{celdaAviso(f)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-gray-800">{acciones(f)}</div>
                </div>
              ))}
            </div>

            {/* Computadora: tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                    <th className="p-4">Comercio</th>
                    <th className="p-4">Vencimiento</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Aviso</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                  {filtradas.map((f) => (
                    <tr key={f.suscripcion.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="p-4">
                        <p className="font-bold text-gray-900 dark:text-white">{f.nombre}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(f.suscripcion.precio_acordado)} / mes</p>
                      </td>
                      <td className="p-4 text-xs">{celdaVencimiento(f)}</td>
                      <td className="p-4">{etiquetaEstado(f)}</td>
                      <td className="p-4 text-xs">{celdaAviso(f)}</td>
                      <td className="p-4 text-right whitespace-nowrap space-x-1">{acciones(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
