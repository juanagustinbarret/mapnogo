import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setCachedData, getCachedData } from '@/lib/offlineStore';
import { Comercio, HorarioAtencion, Rubro } from '@/types/database.types';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import {
  Rocket,
  Search,
  MapPin,
  Clock,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

type EmprendimientoItem = Comercio & {
  es_emprendimiento?: boolean | null;
};

export const EmprendimientosPage: React.FC = () => {
  const [emprendimientos, setEmprendimientos] = useState<EmprendimientoItem[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioAtencion[]>>({});
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState('');
  const [rubroSeleccionado, setRubroSeleccionado] = useState('');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);

      if (navigator.onLine) {
        try {
          const pedirEmprendimientos = (columnas: string) =>
            supabase
              .from('comercios')
              .select(`${columnas}, rubro:rubros(*)` as '*')
              .eq('aprobado', true)
              .eq('habilitado_admin', true)
              .eq('es_emprendimiento', true);

          let { data: empData, error: empError } = await pedirEmprendimientos(COLUMNAS_LISTADO_COMERCIO);
          if (empError) {
            ({ data: empData } = await pedirEmprendimientos('*'));
          }

          const [{ data: rubrosData }, { data: horariosData }] = await Promise.all([
            supabase.from('rubros').select('*').eq('estado', true).order('orden'),
            supabase.from('horarios_atencion').select('*'),
          ]);

          const mapaHorarios: Record<string, HorarioAtencion[]> = {};
          if (horariosData) {
            horariosData.forEach((h) => {
              (mapaHorarios[h.comercio_id] ??= []).push(h);
            });
            setHorarios(mapaHorarios);
            void setCachedData('mapa_horarios_global', mapaHorarios);
          }

          if (rubrosData) {
            setRubros(rubrosData as Rubro[]);
            void setCachedData('rubros_global', rubrosData);
          }

          if (empData) {
            const lista = empData as EmprendimientoItem[];
            setEmprendimientos(lista);
            void setCachedData('emprendimientos_listado_global', lista);
          }

          setLoading(false);
          return;
        } catch (err) {
          console.warn('Fallo de red en EmprendimientosPage. Leyendo caché local...', err);
        }
      }

      const [eLocal, rLocal, hLocal] = await Promise.all([
        getCachedData<EmprendimientoItem[]>('emprendimientos_listado_global'),
        getCachedData<Rubro[]>('rubros_global'),
        getCachedData<Record<string, HorarioAtencion[]>>('mapa_horarios_global'),
      ]);

      if (eLocal) setEmprendimientos(eLocal);
      if (rLocal) setRubros(rLocal);
      if (hLocal) setHorarios(hLocal);
      setLoading(false);
    };

    void cargar();
  }, []);

  const rubrosDisponibles = rubros.filter(
    (r) => r.id === rubroSeleccionado || emprendimientos.some((e) => e.rubro_id === r.id)
  );

  const q = busqueda.trim().toLowerCase();

  const emprendimientosFiltrados = emprendimientos
    .map((emp) => ({
      ...emp,
      estadoAtencion: evaluarEstadoHorario(horarios[emp.id] || [], ahora),
    }))
    .filter((emp) => {
      if (rubroSeleccionado && emp.rubro_id !== rubroSeleccionado) return false;
      if (soloAbiertos && emp.estadoAtencion.estado === 'cerrado') return false;
      if (q) {
        const coincideNombre = emp.nombre?.toLowerCase().includes(q);
        const coincideDesc = emp.descripcion_corta?.toLowerCase().includes(q);
        const coincideDir = emp.direccion?.toLowerCase().includes(q);
        const coincideRubro = emp.rubro?.nombre?.toLowerCase().includes(q);
        if (!coincideNombre && !coincideDesc && !coincideDir && !coincideRubro) return false;
      }
      return true;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-300">
      {/* BANNER SUPERIOR */}
      <div className="bg-gradient-to-r from-purple-700 via-violet-700 to-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Proyectos locales y productores independientes en Nogoyá
          </div>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Rocket className="w-7 h-7 text-purple-200 shrink-0" /> Emprendimientos en Nogoyá
          </h1>
          <p className="text-xs sm:text-sm text-purple-100 max-w-2xl">
            Descubrí emprendimientos locales, proyectos independientes y propuestas de la ciudad con contacto directo y ficha completa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
          <a
            href="https://wa.me/5493435451818?text=Hola!%20Quiero%20sumar%20mi%20emprendimiento%20a%20NOGOYORK"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md transition"
          >
            <MessageCircle className="w-4 h-4" /> Sumar mi Emprendimiento
          </a>

          <Link
            to="/?emprendimientos=1"
            className="px-4 py-2.5 bg-white text-purple-800 hover:bg-purple-50 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md transition"
          >
            <MapPin className="w-4 h-4" /> Ver en el Mapa
          </Link>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar emprendimiento, producto, rubro o dirección..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setSoloAbiertos(!soloAbiertos)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shrink-0 ${
              soloAbiertos
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Abierto Ahora
          </button>
        </div>

        {rubrosDisponibles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/70">
            <button
              type="button"
              onClick={() => setRubroSeleccionado('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                rubroSeleccionado === ''
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Todos ({emprendimientos.length})
            </button>

            {rubrosDisponibles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRubroSeleccionado(rubroSeleccionado === r.id ? '' : r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                  rubroSeleccionado === r.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <InsigniaRubro rubro={r} />
                {r.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LISTADO DE EMPRENDIMIENTOS */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          ))}
        </div>
      ) : emprendimientosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-200 dark:border-gray-700 space-y-2">
          <Rocket className="w-10 h-10 mx-auto text-purple-500 opacity-60" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
            No se encontraron emprendimientos con esos filtros.
          </p>
          {(busqueda || rubroSeleccionado || soloAbiertos) && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setRubroSeleccionado('');
                setSoloAbiertos(false);
              }}
              className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {emprendimientosFiltrados.map((emp) => {
            const wp = normalizeWhatsAppNumber(emp.whatsapp ?? '');
            const wpUrl = wp.isValid
              ? buildWhatsAppUrl(
                  wp.normalized,
                  `Hola ${emp.nombre}! Vi tu emprendimiento en *NOGOYORK* y quería consultarte.`
                )
              : null;

            return (
              <div
                key={emp.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-purple-500 transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>{emp.nombre}</span>
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    </h2>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        emp.estadoAtencion.estado === 'abierto'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : emp.estadoAtencion.estado === 'cierra_pronto'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {emp.estadoAtencion.mensaje}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 text-[11px] font-extrabold inline-flex items-center gap-1">
                      <Rocket className="w-3 h-3" /> Emprendimiento
                    </span>
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 inline-flex items-center gap-1">
                      <InsigniaRubro rubro={emp.rubro} />
                      {emp.rubro?.nombre || 'General'}
                    </span>
                  </div>

                  {emp.descripcion_corta && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {emp.descripcion_corta}
                    </p>
                  )}

                  {emp.direccion && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate">{emp.direccion}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  {wpUrl && (
                    <a
                      href={wpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                  <Link
                    to={`/comercio/${emp.slug}`}
                    className={`${
                      wpUrl ? '' : 'flex-1'
                    } py-2 px-3.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-200 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1 transition`}
                  >
                    Ver Ficha <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmprendimientosPage;
