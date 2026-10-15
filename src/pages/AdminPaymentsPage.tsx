import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, CheckCircle, Search, DollarSign, AlertCircle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { Comercio, MetodoPago } from '@/types/database.types';
import { formatCurrency, formatDate, formatPeriodo, mensajeError } from '@/lib/formatters';
import { diasHasta, periodoActual } from '@/lib/fechas';
import { listarComerciosAdmin } from '@/services/comercios';
import {
  METODOS_PAGO,
  PagoConDetalle,
  SuscripcionConComercio,
  inicioDelPeriodo,
  listarPagosDesde,
  listarSuscripcionesAdmin,
  registrarPago,
  suscripcionesPagadasEnPeriodo,
} from '@/services/suscripciones';

interface FilaCobro {
  comercioId: string;
  nombre: string;
  suscripcion: SuscripcionConComercio | null;
}

interface FormularioPago {
  fila: FilaCobro;
  periodo: string;
  importe: string;
  metodo: MetodoPago;
  referencia: string;
}

const ESTADO_CLASE: Record<string, string> = {
  activa: 'bg-green-100 text-green-800',
  pendiente: 'bg-amber-100 text-amber-800',
  vencida: 'bg-red-100 text-red-800',
  suspendida: 'bg-red-100 text-red-800',
};

const campoClase = 'w-full px-3 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700';

// Primer día de hace 3 meses, para el historial de pagos
const inicioHistorial = () => {
  const [a, m] = periodoActual().split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 - 2, 1));
  return inicioDelPeriodo(fecha.toISOString().slice(0, 7));
};

export const AdminPaymentsPage: React.FC = () => {
  const { avisar } = useToast();
  const periodo = periodoActual();

  const [filas, setFilas] = useState<FilaCobro[]>([]);
  const [pagadas, setPagadas] = useState<Set<string>>(new Set());
  const [pagos, setPagos] = useState<PagoConDetalle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormularioPago | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [suscripciones, comercios, pagadasPeriodo, historial] = await Promise.all([
        listarSuscripcionesAdmin(),
        listarComerciosAdmin(),
        suscripcionesPagadasEnPeriodo(periodo),
        listarPagosDesde(inicioHistorial()),
      ]);
      const conSuscripcion = new Set(suscripciones.map((s) => s.comercio_id));
      const sinSuscripcion: FilaCobro[] = comercios
        .filter((c: Comercio) => !conSuscripcion.has(c.id))
        .map((c) => ({ comercioId: c.id, nombre: c.nombre, suscripcion: null }));

      setFilas([
        ...suscripciones.map((s) => ({ comercioId: s.comercio_id, nombre: s.comercio?.nombre ?? '?', suscripcion: s })),
        ...sinSuscripcion,
      ]);
      setPagadas(pagadasPeriodo);
      setPagos(historial);
    } catch (e) {
      avisar(`No se pudieron cargar los cobros: ${mensajeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [avisar, periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirFormulario = (fila: FilaCobro) =>
    setForm({
      fila,
      periodo,
      importe: String(fila.suscripcion?.precio_acordado ?? ''),
      metodo: 'transferencia',
      referencia: '',
    });

  const confirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const importe = Number(form.importe);
    if (!importe || importe <= 0) {
      avisar('Ingresá un importe mayor a cero.', 'error');
      return;
    }
    setGuardando(true);
    try {
      await registrarPago({
        comercioId: form.fila.comercioId,
        importe,
        metodo: form.metodo,
        periodo: form.periodo,
        referencia: form.referencia.trim() || undefined,
      });
      avisar(`Pago de ${formatCurrency(importe)} registrado para ${form.fila.nombre} (${formatPeriodo(form.periodo)}).`, 'exito');
      setForm(null);
      await cargar();
    } catch (err) {
      avisar(`No se pudo registrar el pago: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const texto = search.toLowerCase();
  const filtradas = filas.filter((f) => f.nombre.toLowerCase().includes(texto));
  const inicioMes = new Date(inicioDelPeriodo(periodo)).getTime();
  const cobradoMes = pagos
    .filter((p) => new Date(p.fecha_pago).getTime() >= inicioMes)
    .reduce((total, p) => total + Number(p.importe), 0);

  // Piezas de cada fila, compartidas por la tabla (computadora) y las tarjetas (celular)
  const celdaSuscripcion = (f: FilaCobro) =>
    f.suscripcion ? (
      <div className="space-y-1">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ESTADO_CLASE[f.suscripcion.estado]}`}>{f.suscripcion.estado}</span>
        <p className="text-xs text-gray-500">{formatCurrency(f.suscripcion.precio_acordado)} / mes</p>
      </div>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">sin suscripción</span>
    );

  const celdaVencimiento = (f: FilaCobro) => {
    if (!f.suscripcion) return <span className="text-gray-400">Sin vencimiento</span>;
    const dias = diasHasta(f.suscripcion.proximo_vencimiento);
    return (
      <>
        <span className="font-semibold">Vence {formatDate(f.suscripcion.proximo_vencimiento)}</span>
        <span className={`block ${dias < 0 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
          {dias < 0 ? `hace ${-dias} días` : dias === 0 ? 'hoy' : `en ${dias} días`}
        </span>
      </>
    );
  };

  const estadoPeriodo = (f: FilaCobro) =>
    f.suscripcion && pagadas.has(f.suscripcion.id) ? (
      <span className="text-xs font-bold text-green-700 inline-flex items-center gap-1 whitespace-nowrap">
        <CheckCircle className="w-4 h-4" aria-hidden="true" /> Pagado
      </span>
    ) : (
      <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1 whitespace-nowrap">
        <AlertCircle className="w-4 h-4" aria-hidden="true" /> Pendiente
      </span>
    );

  const botonPago = (f: FilaCobro, extra = '') => (
    <button
      onClick={() => abrirFormulario(f)}
      className={`px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 ${extra}`}
    >
      <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Registrar pago
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" aria-hidden="true" /> Cobros de {formatPeriodo(periodo)}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Cobrado este mes: <strong className="text-green-600">{formatCurrency(cobradoMes)}</strong>. Registrar un pago
              extiende el vencimiento al día 10 del mes siguiente al período pagado.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="buscar-cobro" className="sr-only">Buscar comercio</label>
            <input
              id="buscar-cobro"
              type="search"
              placeholder="Buscar comercio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando...</div>
        ) : (
          <>
            {/* Celular: tarjetas */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filtradas.map((f) => (
                <div key={f.comercioId} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">{f.nombre}</h3>
                    {estadoPeriodo(f)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>{celdaSuscripcion(f)}</div>
                    <div>{celdaVencimiento(f)}</div>
                  </div>
                  {botonPago(f, 'w-full justify-center')}
                </div>
              ))}
            </div>

            {/* Computadora: tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                    <th className="p-4">Comercio</th>
                    <th className="p-4">Suscripción</th>
                    <th className="p-4">Vence</th>
                    <th className="p-4">{formatPeriodo(periodo)}</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                  {filtradas.map((f) => (
                    <tr key={f.comercioId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="p-4 font-bold text-gray-900 dark:text-white">{f.nombre}</td>
                      <td className="p-4">{celdaSuscripcion(f)}</td>
                      <td className="p-4 text-xs">{celdaVencimiento(f)}</td>
                      <td className="p-4">{estadoPeriodo(f)}</td>
                      <td className="p-4 text-right">{botonPago(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* HISTORIAL */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pagos de los últimos 3 meses</h2>
        {pagos.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[520px]">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Comercio</th>
                  <th className="p-3">Período</th>
                  <th className="p-3">Método</th>
                  <th className="p-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">{formatDate(p.fecha_pago)}</td>
                    <td className="p-3 font-semibold">{p.periodo?.suscripcion?.comercio?.nombre ?? '—'}</td>
                    <td className="p-3">{p.periodo ? formatPeriodo(p.periodo.periodo_facturado) : '—'}</td>
                    <td className="p-3">
                      {METODOS_PAGO.find((m) => m.valor === p.metodo_pago)?.etiqueta ?? p.metodo_pago}
                      {p.referencia && <span className="block text-[11px] text-gray-400">{p.referencia}</span>}
                    </td>
                    <td className="p-3 text-right font-bold">{formatCurrency(p.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-pago">
          <form onSubmit={confirmarPago} className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 id="titulo-pago" className="text-lg font-bold text-gray-900 dark:text-white">
              Registrar pago de {form.fila.nombre}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pago-periodo" className="block text-xs font-semibold mb-1">Período pagado</label>
                <input id="pago-periodo" type="month" required value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} className={campoClase} />
              </div>
              <div>
                <label htmlFor="pago-importe" className="block text-xs font-semibold mb-1">Importe ($)</label>
                <input id="pago-importe" type="number" min="1" step="1" required value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} className={campoClase} />
              </div>
            </div>
            <div>
              <label htmlFor="pago-metodo" className="block text-xs font-semibold mb-1">Método</label>
              <select id="pago-metodo" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value as MetodoPago })} className={campoClase}>
                {METODOS_PAGO.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pago-referencia" className="block text-xs font-semibold mb-1">Referencia (opcional)</label>
              <input id="pago-referencia" type="text" placeholder="N.° de operación, nota..." value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className={campoClase} />
            </div>
            {!form.fila.suscripcion && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                Este comercio no tiene suscripción: se creará con el plan activo al registrar el pago.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold">
                {guardando ? 'Registrando...' : 'Confirmar pago'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
