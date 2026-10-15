import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  DollarSign,
  ExternalLink,
  Trash2,
  Search,
  MapPin,
  Building,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  BarChart2,
  Eye,
  MessageCircle,
  Navigation,
  LocateFixed,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Comercio, Metricas, Rubro } from '@/types/database.types';
import { formatCurrency, mensajeError } from '@/lib/formatters';
import { haceDias, periodoActual } from '@/lib/fechas';
import { esperar, geocodificarDireccion, tieneCoordenadasPorDefecto } from '@/lib/geocoding';
import { actualizarComercio, darDeBajaComercio, esVisibleEnMapa, listarComerciosAdmin } from '@/services/comercios';
import { listarRubrosActivos } from '@/services/configuracion';
import { obtenerMetricas } from '@/services/metricas';
import { inicioDelPeriodo, listarPagosDesde } from '@/services/suscripciones';

const ESTADO_SUSCRIPCION: Record<string, string> = {
  activa: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  vencida: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  suspendida: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
};

const tarjeta = 'bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm';
const campoClase = 'w-full px-3.5 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700';

export const AdminDashboardPage: React.FC = () => {
  const { avisar, confirmar } = useToast();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [recaudacionMes, setRecaudacionMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Comercio elegido para ver métricas. Se guarda también en un ref para que
  // las recargas en tiempo real no lo reinicien.
  const [seleccionadoId, setSeleccionadoId] = useState<string>('');
  const seleccionadoRef = useRef<string>('');
  const [metricas, setMetricas] = useState<Metricas>({ visitas: 0, whatsapp: 0, comoLlegar: 0 });

  const [modalEditar, setModalEditar] = useState<Comercio | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [ubicando, setUbicando] = useState<{ hechos: number; total: number } | null>(null);

  const cargarMetricas = async (comercioId: string) => {
    seleccionadoRef.current = comercioId;
    setSeleccionadoId(comercioId);
    try {
      setMetricas(await obtenerMetricas(comercioId, haceDias(30)));
    } catch (e) {
      avisar(`No se pudieron cargar las métricas: ${mensajeError(e)}`, 'error');
    }
  };

  const cargar = useCallback(async () => {
    try {
      const [lista, pagos] = await Promise.all([
        listarComerciosAdmin(),
        listarPagosDesde(inicioDelPeriodo(periodoActual())),
      ]);
      setComercios(lista);
      setRecaudacionMes(pagos.reduce((total, p) => total + Number(p.importe), 0));

      if (!seleccionadoRef.current && lista.length > 0) {
        void cargarMetricas(lista[0].id);
      }
    } catch (e) {
      avisar(`No se pudieron cargar los comercios: ${mensajeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    listarRubrosActivos().then(setRubros).catch(() => undefined);

    // Tiempo real: se agrupan los cambios para no recargar en cada evento
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('realtime_comercios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comercios' }, () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => void cargar(), 800);
      })
      .subscribe();

    return () => {
      clearTimeout(temporizador);
      void supabase.removeChannel(channel);
    };
  }, [cargar]);

  const handleToggleVisible = async (comercio: Comercio) => {
    try {
      await actualizarComercio(comercio.id, { habilitado_admin: !comercio.habilitado_admin });
      await cargar();
    } catch (e) {
      avisar(`No se pudo cambiar la visibilidad: ${mensajeError(e)}`, 'error');
    }
  };

  const handleDarDeBaja = async (comercio: Comercio) => {
    const ok = await confirmar({
      titulo: 'Dar de baja comercio',
      mensaje: `"${comercio.nombre}" deja de verse en la app y en este listado. Sus pagos e historial se conservan.`,
      textoConfirmar: 'Dar de baja',
      peligroso: true,
    });
    if (!ok) return;
    try {
      await darDeBajaComercio(comercio.id);
      if (seleccionadoRef.current === comercio.id) seleccionadoRef.current = '';
      avisar(`${comercio.nombre} fue dado de baja.`, 'exito');
      await cargar();
    } catch (e) {
      avisar(`No se pudo dar de baja: ${mensajeError(e)}`, 'error');
    }
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar) return;
    const original = comercios.find((c) => c.id === modalEditar.id);
    setGuardandoEdicion(true);
    try {
      let coordenadas: { latitud: number; longitud: number } | undefined;
      if (original && modalEditar.direccion.trim() !== original.direccion) {
        const coords = await geocodificarDireccion(modalEditar.direccion);
        if (coords) coordenadas = { latitud: coords.lat, longitud: coords.lng };
        else avisar('No se encontró la dirección en el mapa; el pin no se movió.', 'info');
      }
      await actualizarComercio(modalEditar.id, {
        nombre: modalEditar.nombre.trim(),
        rubro_id: modalEditar.rubro_id,
        direccion: modalEditar.direccion.trim(),
        whatsapp: modalEditar.whatsapp.trim(),
        descripcion_corta: modalEditar.descripcion_corta.trim(),
        ...coordenadas,
      });
      setModalEditar(null);
      avisar('Cambios guardados.', 'exito');
      await cargar();
    } catch (err) {
      avisar(`No se pudo guardar: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Ubica en el mapa los comercios que tienen las coordenadas por defecto.
  // Una consulta por segundo, como pide la política de uso de Nominatim.
  const sinUbicar = comercios.filter((c) => tieneCoordenadasPorDefecto(c.latitud, c.longitud));

  const ubicarComercios = async () => {
    const pendientes = [...sinUbicar];
    let ubicadosOk = 0;
    setUbicando({ hechos: 0, total: pendientes.length });
    for (let i = 0; i < pendientes.length; i++) {
      const c = pendientes[i];
      const coords = await geocodificarDireccion(c.direccion);
      if (coords) {
        try {
          await actualizarComercio(c.id, { latitud: coords.lat, longitud: coords.lng });
          ubicadosOk++;
        } catch {
          // se informa al final
        }
      }
      setUbicando({ hechos: i + 1, total: pendientes.length });
      if (i < pendientes.length - 1) await esperar(1100);
    }
    setUbicando(null);
    avisar(
      `Se ubicaron ${ubicadosOk} de ${pendientes.length} comercios.` +
        (ubicadosOk < pendientes.length ? ' Revisá la dirección de los que faltan.' : ''),
      ubicadosOk === pendientes.length ? 'exito' : 'info',
    );
    await cargar();
  };

  const texto = search.toLowerCase();
  const comerciosFiltrados = comercios.filter(
    (c) =>
      c.nombre.toLowerCase().includes(texto) ||
      c.direccion?.toLowerCase().includes(texto) ||
      c.whatsapp?.includes(search),
  );
  const visibles = comercios.filter(esVisibleEnMapa).length;
  const facturacionEsperada = comercios
    .filter((c) => c.suscripcion?.estado === 'activa')
    .reduce((total, c) => total + Number(c.suscripcion?.precio_acordado ?? 0), 0);

  // Piezas de cada fila, compartidas por la tabla (computadora) y las tarjetas (celular)
  const etiquetaSuscripcion = (comercio: Comercio) =>
    comercio.suscripcion ? (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${ESTADO_SUSCRIPCION[comercio.suscripcion.estado]}`}>
        {comercio.suscripcion.estado}
      </span>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-gray-100 text-gray-600">sin suscripción</span>
    );

  const botonVisibilidad = (comercio: Comercio) => (
    <button
      onClick={() => void handleToggleVisible(comercio)}
      aria-pressed={comercio.habilitado_admin}
      title="Mostrar u ocultar en el mapa"
      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
        comercio.habilitado_admin
          ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
          : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
      }`}
    >
      {comercio.habilitado_admin ? (
        <>
          <CheckCircle className="w-3.5 h-3.5 text-green-600" aria-hidden="true" /> Visible
        </>
      ) : (
        <>
          <XCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" /> Oculto
        </>
      )}
    </button>
  );

  const celdaDireccion = (comercio: Comercio) => (
    <>
      {comercio.direccion || '-'}
      {tieneCoordenadasPorDefecto(comercio.latitud, comercio.longitud) && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">sin ubicar</span>
      )}
    </>
  );

  const acciones = (comercio: Comercio) => (
    <>
      <button
        onClick={() => setModalEditar(comercio)}
        className="p-2 text-gray-600 hover:text-brand-600 rounded-lg inline-block"
        aria-label={`Editar ${comercio.nombre}`}
        title="Editar"
      >
        <Edit className="w-4 h-4" />
      </button>
      <Link
        to={`/comercio/${comercio.slug}`}
        target="_blank"
        className="p-2 text-gray-500 hover:text-brand-600 rounded-lg inline-block"
        aria-label={`Ver ficha pública de ${comercio.nombre}`}
        title="Ver ficha pública"
      >
        <ExternalLink className="w-4 h-4" />
      </Link>
      <button
        onClick={() => void handleDarDeBaja(comercio)}
        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition"
        aria-label={`Dar de baja ${comercio.nombre}`}
        title="Dar de baja"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`${tarjeta} flex items-center justify-between`}>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comercios</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{comercios.length}</p>
          </div>
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Store className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className={`${tarjeta} flex items-center justify-between`}>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visibles en el mapa</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{visibles}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <MapPin className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className={`${tarjeta} flex items-center justify-between`}>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cobrado este mes</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(recaudacionMes)}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Esperado por mes: {formatCurrency(facturacionEsperada)} (suscripciones activas)
            </p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <DollarSign className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* COMERCIOS SIN UBICAR */}
      {sinUbicar.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{sinUbicar.length}</strong> comercio(s) no tienen ubicación y no aparecen en el mapa.
          </p>
          <button
            onClick={() => void ubicarComercios()}
            disabled={!!ubicando}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            {ubicando ? `Ubicando ${ubicando.hechos}/${ubicando.total}...` : 'Ubicar en el mapa'}
          </button>
        </div>
      )}

      {/* MÉTRICAS POR COMERCIO */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-brand-600" aria-hidden="true" /> Métricas por comercio
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Últimos 30 días.</p>
          </div>

          <div className="w-full sm:w-80">
            <label htmlFor="comercio-metricas" className="sr-only">Comercio</label>
            <select
              id="comercio-metricas"
              value={seleccionadoId}
              onChange={(e) => void cargarMetricas(e.target.value)}
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

        {seleccionadoId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { titulo: 'Visitas a la ficha', valor: metricas.visitas, Icono: Eye, color: 'text-blue-700 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300' },
              { titulo: 'Consultas WhatsApp', valor: metricas.whatsapp, Icono: MessageCircle, color: 'text-green-700 bg-green-100 dark:bg-green-950/50 dark:text-green-300' },
              { titulo: 'Rutas "Cómo llegar"', valor: metricas.comoLlegar, Icono: Navigation, color: 'text-purple-700 bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300' },
            ].map(({ titulo, valor, Icono, color }) => (
              <div key={titulo} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">{titulo}</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{valor}</p>
                </div>
                <div className={`p-3 rounded-xl ${color}`}>
                  <Icono className="w-6 h-6" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TABLA DE COMERCIOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-600" aria-hidden="true" /> Comercios registrados
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Un comercio aparece en el mapa si está visible y su suscripción está activa.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="buscar-comercio-admin" className="sr-only">Buscar comercio</label>
            <input
              id="buscar-comercio-admin"
              type="search"
              placeholder="Buscar por nombre, calle o WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando comercios...</div>
        ) : comerciosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No hay comercios para mostrar.</div>
        ) : (
          <>
            {/* Celular: tarjetas */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {comerciosFiltrados.map((comercio) => (
                <div key={comercio.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">{comercio.nombre}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{comercio.rubro?.nombre || 'General'}</p>
                    </div>
                    {etiquetaSuscripcion(comercio)}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{celdaDireccion(comercio)}</p>
                  <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800">
                    {botonVisibilidad(comercio)}
                    <div className="flex items-center">{acciones(comercio)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Computadora: tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                    <th className="p-4">Comercio</th>
                    <th className="p-4">Rubro</th>
                    <th className="p-4">Suscripción</th>
                    <th className="p-4">Visibilidad</th>
                    <th className="p-4">Dirección</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                  {comerciosFiltrados.map((comercio) => (
                    <tr key={comercio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                      <td className="p-4 font-bold text-gray-900 dark:text-white">{comercio.nombre}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-bold">
                          {comercio.rubro?.nombre || 'General'}
                        </span>
                      </td>
                      <td className="p-4">{etiquetaSuscripcion(comercio)}</td>
                      <td className="p-4">{botonVisibilidad(comercio)}</td>
                      <td className="p-4 text-xs text-gray-600 dark:text-gray-300">{celdaDireccion(comercio)}</td>
                      <td className="p-4 text-right whitespace-nowrap">{acciones(comercio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL EDITAR */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-editar">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 id="titulo-editar" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-brand-600" aria-hidden="true" /> Editar {modalEditar.nombre}
            </h3>

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              <div>
                <label htmlFor="editar-nombre" className="block text-xs font-semibold mb-1">Nombre</label>
                <input id="editar-nombre" type="text" required value={modalEditar.nombre} onChange={(e) => setModalEditar({ ...modalEditar, nombre: e.target.value })} className={campoClase} />
              </div>
              <div>
                <label htmlFor="editar-rubro" className="block text-xs font-semibold mb-1">Rubro</label>
                <select id="editar-rubro" value={modalEditar.rubro_id} onChange={(e) => setModalEditar({ ...modalEditar, rubro_id: e.target.value })} className={campoClase}>
                  {rubros.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="editar-direccion" className="block text-xs font-semibold mb-1">Dirección</label>
                <input id="editar-direccion" type="text" required value={modalEditar.direccion} onChange={(e) => setModalEditar({ ...modalEditar, direccion: e.target.value })} className={campoClase} />
              </div>
              <div>
                <label htmlFor="editar-whatsapp" className="block text-xs font-semibold mb-1">WhatsApp</label>
                <input id="editar-whatsapp" type="tel" required value={modalEditar.whatsapp} onChange={(e) => setModalEditar({ ...modalEditar, whatsapp: e.target.value })} className={campoClase} />
              </div>
              <div>
                <label htmlFor="editar-descripcion" className="block text-xs font-semibold mb-1">Descripción breve</label>
                <input id="editar-descripcion" type="text" required maxLength={160} value={modalEditar.descripcion_corta} onChange={(e) => setModalEditar({ ...modalEditar, descripcion_corta: e.target.value })} className={campoClase} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalEditar(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoEdicion} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
                  <Save className="w-4 h-4" aria-hidden="true" /> {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
