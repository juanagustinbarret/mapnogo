import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Comercio, Oficio } from '@/types/database.types';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { hoyArgentina } from '@/lib/fechasArgentina';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import {
  Siren,
  Phone,
  MessageCircle,
  HeartPulse,
  Wrench,
  Store,
  Flame,
  MapPin,
  ArrowRight,
  Clock,
  Navigation,
  ShieldAlert,
} from 'lucide-react';

interface GuiaUtilUrgenciaItem {
  id: string;
  nombre: string;
  categoria: string;
  telefono: string;
  whatsapp?: string | null;
  direccion: string;
  urgencia: boolean;
  es_24hs?: boolean;
  horarios?: string | null;
  orden: number;
  latitud?: number | null;
  longitud?: number | null;
}

export const UrgenciasPage: React.FC = () => {
  const [farmaciaTurno, setFarmaciaTurno] = useState<Comercio | null>(null);
  const [guiaItems24hs, setGuiaItems24hs] = useState<GuiaUtilUrgenciaItem[]>([]);
  const [oficios24hs, setOficios24hs] = useState<Oficio[]>([]);
  const [comerciosGuardia, setComerciosGuardia] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'salud' | 'hogar' | 'vehiculo'>('todos');

  useEffect(() => {
    const cargarGuardias = async () => {
      setLoading(true);
      const fechaHoy = hoyArgentina();

      const [turnoRes, guiaRes, oficiosRes, comerciosRes] = await Promise.all([
        supabase
          .from('farmacias_turno')
          .select(`comercio_id, comercio:comercios(${COLUMNAS_LISTADO_COMERCIO}, rubro:rubros(*))` as '*')
          .eq('fecha', fechaHoy)
          .maybeSingle(),
        supabase
          .from('guia_util')
          .select('*')
          .or('urgencia.eq.true,es_24hs.eq.true')
          .order('urgencia', { ascending: false })
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase
          .from('oficios')
          .select('*')
          .eq('aprobado', true)
          .eq('habilitado_admin', true)
          .eq('urgencias_24hs', true)
          .order('nombre', { ascending: true }),
        supabase
          .from('comercios')
          .select(`${COLUMNAS_LISTADO_COMERCIO}, rubro:rubros(*)` as '*')
          .eq('aprobado', true)
          .eq('habilitado_admin', true),
      ]);

      if (turnoRes.data?.comercio) {
        setFarmaciaTurno(turnoRes.data.comercio as unknown as Comercio);
      }
      if (guiaRes.data) {
        setGuiaItems24hs(guiaRes.data as GuiaUtilUrgenciaItem[]);
      }
      if (oficiosRes.data) {
        setOficios24hs(oficiosRes.data as Oficio[]);
      }
      if (comerciosRes.data) {
        const lista = (comerciosRes.data as unknown as Comercio[]).filter((c) => {
          const r = (c.rubro?.nombre || '').toLowerCase();
          const d = (c.descripcion_corta || '').toLowerCase();
          const srvs = (c.servicios || []).map((s) => s.toLowerCase());
          return (
            srvs.some((s) => s.includes('24') || s.includes('guardia') || s.includes('urgencia') || s.includes('grúa') || s.includes('auxilio') || s.includes('cerraj')) ||
            d.includes('24 hs') ||
            d.includes('24hs') ||
            d.includes('guardia') ||
            r.includes('remis') ||
            r.includes('veterinar') ||
            r.includes('gomería')
          );
        });
        setComerciosGuardia(lista);
      }

      setLoading(false);
    };

    void cargarGuardias();
  }, []);

  const wpFarmacia = normalizeWhatsAppNumber(farmaciaTurno?.whatsapp ?? '');

  // Separamos emergencias públicas directas vs lugares de atención 24 hs de la Guía Útil
  const emergenciasPublicas = guiaItems24hs.filter(
    (item) => item.urgencia || item.categoria === 'Emergencias'
  );

  const lugaresGuia24hs = guiaItems24hs.filter((item) => {
    if (!item.es_24hs) return false;
    if (filtro === 'todos') return true;
    if (filtro === 'salud') {
      return (
        item.categoria === 'Salud' ||
        item.categoria === 'Hospitales y Sanatorios' ||
        item.categoria === 'Clínicas y Consultorios' ||
        item.categoria === 'Emergencias'
      );
    }
    if (filtro === 'vehiculo') {
      return item.categoria === 'Transporte';
    }
    return false;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      {/* BANNER URGENCIAS */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider backdrop-blur-md">
          <Siren className="w-4 h-4 animate-pulse" /> Atención Inmediata
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">De Guardia y Urgencias 24hs en Nogoyá</h1>
        <p className="text-xs sm:text-sm text-rose-100 max-w-2xl leading-relaxed">
          Acceso directo en un toque a emergencias públicas, hospitales, sanatorios, farmacia de turno, veterinarias, auxilio mecánico, remises y técnicos 24 horas.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { id: 'todos', label: 'Todo (24hs)' },
            { id: 'salud', label: '🏥 Salud & Farmacia' },
            { id: 'hogar', label: '🔧 Hogar & Técnicos' },
            { id: 'vehiculo', label: '🚗 Auxilio & Remises' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltro(tab.id as typeof filtro)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                filtro === tab.id
                  ? 'bg-white text-rose-700 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Cargando guardias y teléfonos de urgencia...
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. FARMACIA DE TURNO HOY */}
          {(filtro === 'todos' || filtro === 'salud') && farmaciaTurno && (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <HeartPulse className="w-4 h-4" /> Farmacia de Turno Hoy
              </h2>
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">{farmaciaTurno.nombre}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" /> {farmaciaTurno.direccion || 'Nogoyá'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {farmaciaTurno.telefono && (
                    <a href={`tel:${farmaciaTurno.telefono}`} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5">
                      <Phone className="w-4 h-4" /> Llamar
                    </a>
                  )}
                  {wpFarmacia.isValid && (
                    <a href={buildWhatsAppUrl(wpFarmacia.normalized, 'Hola! Consulta por farmacia de turno.')} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  )}
                  <Link to={`/comercio/${farmaciaTurno.slug}`} className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                    Ficha <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* 2. TELÉFONOS DE EMERGENCIA PÚBLICA */}
          {(filtro === 'todos' || filtro === 'salud') && emergenciasPublicas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" /> Emergencias Públicas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {emergenciasPublicas.map((item) => {
                  const wp = normalizeWhatsAppNumber(item.whatsapp ?? '');
                  return (
                    <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">{item.nombre}</h3>
                          {item.es_24hs && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-extrabold shrink-0">
                              24HS
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{item.direccion}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {wp.isValid && (
                          <a
                            href={buildWhatsAppUrl(wp.normalized, `Hola ${item.nombre}, me comunico desde NOGOYORK.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {item.telefono && (
                          <a
                            href={`tel:${item.telefono}`}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" /> {item.telefono}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. LUGARES Y SERVICIOS DE ATENCIÓN 24 HS (DESDE GUÍA ÚTIL) */}
          {lugaresGuia24hs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Atención y Guardias 24 hs (Guía Útil)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lugaresGuia24hs.map((item) => {
                  const wp = normalizeWhatsAppNumber(item.whatsapp ?? '');
                  const mapsUrl =
                    item.latitud != null && item.longitud != null
                      ? `https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${item.nombre}, ${item.direccion}, Nogoyá, Entre Ríos`
                        )}`;

                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 text-[10px] font-extrabold uppercase">
                            {item.categoria}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> 24 HS
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{item.nombre}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-sky-600 shrink-0" /> {item.direccion}
                        </p>
                        {item.horarios && (
                          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {item.horarios}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {wp.isValid && (
                          <a
                            href={buildWhatsAppUrl(wp.normalized, `Hola ${item.nombre}, me comunico desde NOGOYORK 24hs.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        )}
                        {item.telefono && (
                          <a
                            href={`tel:${item.telefono}`}
                            className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" /> {item.telefono}
                          </a>
                        )}
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition"
                          title="Cómo llegar"
                        >
                          <Navigation className="w-3.5 h-3.5 text-sky-600" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4. OFICIOS & TÉCNICOS DE URGENCIA 24HS */}
          {(filtro === 'todos' || filtro === 'hogar') && oficios24hs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Técnicos y Oficios con Urgencias 24hs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {oficios24hs.map((oficio) => {
                  const wp = normalizeWhatsAppNumber(oficio.whatsapp);
                  return (
                    <div key={oficio.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold uppercase">
                          {oficio.oficio_rubro}
                        </span>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{oficio.nombre}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{oficio.descripcion_corta}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {oficio.telefono && (
                          <a href={`tel:${oficio.telefono}`} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> Llamar
                          </a>
                        )}
                        {wp.isValid && (
                          <a
                            href={buildWhatsAppUrl(wp.normalized, `Hola ${oficio.nombre}! Necesito una urgencia de ${oficio.oficio_rubro} (visto en NOGOYORK 24hs).`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 5. COMERCIOS DE GUARDIA / AUXILIO / REMISES */}
          {(filtro === 'todos' || filtro === 'vehiculo' || filtro === 'salud') && comerciosGuardia.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
                <Store className="w-4 h-4" /> Comercios de Guardia, Auxilio y Traslados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comerciosGuardia.map((c) => {
                  const wp = normalizeWhatsAppNumber(c.whatsapp ?? '');
                  return (
                    <div key={c.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase text-brand-600">{c.rubro?.nombre}</span>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{c.nombre}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{c.direccion}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.telefono && (
                          <a href={`tel:${c.telefono}`} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> Llamar
                          </a>
                        )}
                        {wp.isValid && (
                          <a
                            href={buildWhatsAppUrl(wp.normalized, `Hola ${c.nombre}! Te contacto desde NOGOYORK Urgencias.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        )}
                        <Link to={`/comercio/${c.slug}`} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold">
                          Ficha
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
