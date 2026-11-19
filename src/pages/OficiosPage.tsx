// src/pages/OficiosPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setCachedData, getCachedData } from '@/lib/offlineStore';
import { Oficio } from '@/types/database.types';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { CONTACTO } from '@/lib/contacto';
import { TARIFAS_PLANES } from '@/lib/planes';
import { formatCurrency } from '@/lib/formatters';
import {
  Wrench,
  Search,
  Sparkles,
  Filter,
  CheckCircle2,
  MessageCircle,
  Phone,
  Siren,
  Home,
  Award,
  ArrowRight,
  Clock,
} from 'lucide-react';

export const OficiosPage: React.FC = () => {
  const [oficios, setOficios] = useState<Oficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rubroSeleccionado, setRubroSeleccionado] = useState('');
  const [soloUrgencias24hs, setSoloUrgencias24hs] = useState(false);

  useEffect(() => {
    const cargarOficios = async () => {
      setLoading(true);
      const CACHE_KEY = 'oficios_listado_global';

      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('oficios')
            .select('*')
            .eq('aprobado', true)
            .eq('habilitado_admin', true)
            .order('urgencias_24hs', { ascending: false })
            .order('nombre', { ascending: true });

          if (!error && data) {
            setOficios(data as Oficio[]);
            void setCachedData(CACHE_KEY, data);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[OficiosPage] Fallo de red, cargando caché local...', err);
        }
      }

      const local = await getCachedData<Oficio[]>(CACHE_KEY);
      if (local) setOficios(local);
      setLoading(false);
    };

    void cargarOficios();
  }, []);

  const categoriasOficios = useMemo(() => {
    const mapa = new Map<string, number>();
    oficios.forEach((o) => {
      if (o.oficio_rubro) {
        mapa.set(o.oficio_rubro, (mapa.get(o.oficio_rubro) || 0) + 1);
      }
    });
    return Array.from(mapa.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [oficios]);

  const oficiosFiltrados = oficios.filter((o) => {
    if (soloUrgencias24hs && !o.urgencias_24hs) return false;
    if (rubroSeleccionado && o.oficio_rubro !== rubroSeleccionado) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;

    return (
      o.nombre.toLowerCase().includes(q) ||
      o.oficio_rubro.toLowerCase().includes(q) ||
      o.descripcion_corta.toLowerCase().includes(q) ||
      (o.servicios || []).some((s) => s.toLowerCase().includes(q))
    );
  });

  const mensajeAltaOficio = encodeURIComponent(
    `Hola! Quiero publicar mi oficio o servicio en NOGOYORK (Plan Oficios ${formatCurrency(
      TARIFAS_PLANES.oficio.mensual
    )}/mes o ${formatCurrency(TARIFAS_PLANES.oficio.anual)}/año).`
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      {/* BANNER PRINCIPAL */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-brand-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" /> Servicios Independientes & Profesionales
          </div>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Wrench className="w-7 h-7 text-amber-200" /> Oficios y Prestadores en Nogoyá
          </h1>
          <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
            Encontrá gasistas, plomeros, electricistas, albañiles, fletes, técnicos y profesionales independientes de confianza con contacto directo.
          </p>
        </div>

        <a
          href={`https://wa.me/${CONTACTO.whatsappSoporte}?text=${mensajeAltaOficio}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 bg-white text-orange-700 hover:bg-amber-50 rounded-2xl text-xs font-extrabold inline-flex flex-col items-center gap-0.5 shadow-md transition shrink-0"
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Publicar mi Oficio
          </span>
          <span className="text-[10px] font-bold text-orange-600/80">
            Desde {formatCurrency(TARIFAS_PLANES.oficio.mensual)}/mes
          </span>
        </a>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white dark:bg-gray-800/90 rounded-3xl p-4 shadow-sm border border-gray-200 dark:border-gray-700/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por oficio, especialidad o nombre (ej. Gasista, Aire acondicionado, Flete)..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <div className="absolute left-3.5 top-3.5 pointer-events-none text-gray-400">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={rubroSeleccionado}
              onChange={(e) => setRubroSeleccionado(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Oficio: Todos ({oficios.length})</option>
              {categoriasOficios.map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre} ({c.cantidad})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-gray-400 text-[10px]">
              ▼
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSoloUrgencias24hs(!soloUrgencias24hs)}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
              soloUrgencias24hs
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100'
            }`}
          >
            <Siren className="w-4 h-4" /> Urgencias 24hs
          </button>
        </div>
      </div>

      {/* GRID DE FICHAS DE OFICIOS */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Cargando prestadores y oficios en Nogoyá...
        </div>
      ) : oficiosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl text-center text-gray-500 border border-gray-200 dark:border-gray-700 space-y-3">
          <Wrench className="w-12 h-12 mx-auto opacity-30 text-amber-500" />
          <p className="text-sm font-semibold">
            {search || rubroSeleccionado || soloUrgencias24hs
              ? 'No se encontraron prestadores con esos filtros.'
              : 'Todavía no hay oficios cargados. ¡Pronto sumaremos prestadores locales!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {oficiosFiltrados.map((oficio) => {
            const wp = normalizeWhatsAppNumber(oficio.whatsapp);
            const whatsappUrl = wp.isValid
              ? buildWhatsAppUrl(
                  wp.normalized,
                  `Hola ${oficio.nombre}! Te contacto desde *NOGOYORK Oficios* por un trabajo de ${oficio.oficio_rubro}.`
                )
              : null;

            return (
              <article
                key={oficio.id}
                className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-amber-500 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {oficio.foto_url ? (
                      <img
                        src={oficio.foto_url}
                        alt={oficio.nombre}
                        className="w-14 h-14 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black text-lg flex items-center justify-center shrink-0">
                        {oficio.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold uppercase">
                          {oficio.oficio_rubro}
                        </span>
                        {oficio.urgencias_24hs && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                            <Siren className="w-3 h-3" /> 24hs
                          </span>
                        )}
                      </div>

                      <h2 className="font-extrabold text-base text-gray-900 dark:text-white mt-1 flex items-center gap-1.5 truncate">
                        <span className="truncate">{oficio.nombre}</span>
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                      </h2>

                      {oficio.matricula && (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Award className="w-3 h-3 shrink-0" /> Mat. {oficio.matricula}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                    {oficio.descripcion_corta}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {oficio.a_domicilio && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded-lg font-semibold">
                        <Home className="w-3 h-3 text-amber-600" /> A domicilio
                      </span>
                    )}
                    {oficio.horario_texto && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded-lg font-semibold">
                        <Clock className="w-3 h-3 text-brand-600" /> {oficio.horario_texto}
                      </span>
                    )}
                  </div>
                </div>

                {/* ACCIONES RÁPIDAS */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                  {oficio.telefono && (
                    <a
                      href={`tel:${oficio.telefono}`}
                      className="py-2.5 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 transition"
                      title="Llamar"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <Link
                    to={`/oficio/${oficio.slug}`}
                    className="py-2.5 px-3 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1 transition"
                  >
                    Ficha <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};