import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCachedData, setCachedData } from '@/lib/offlineStore';
import { GuiaUtilItem } from '@/types/database.types';
import {
  X,
  Phone,
  MapPin,
  ShieldAlert,
  HeartPulse,
  Building2,
  Flame,
  Navigation,
  Loader2,
  Landmark,
  Filter,
  Stethoscope,
  Clock,
  MessageCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Images,
  Eye,
} from 'lucide-react';

export interface GuiaItem extends GuiaUtilItem {
  whatsapp?: string | null;
  descripcion?: string | null;
  fotos?: string[] | null;
  es_24hs?: boolean;
  horarios?: string | null;
}

interface GuiaUtilModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: GuiaItem | null;
}

const formatWhatsAppUrl = (rawPhone: string, nombreLugar: string) => {
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('54')) digits = `549${digits}`;
  const text = encodeURIComponent(`Hola ${nombreLugar}, me comunico desde NOGOYORK.`);
  return `https://wa.me/${digits}?text=${text}`;
};

export const GuiaUtilModal: React.FC<GuiaUtilModalProps> = ({
  isOpen,
  onClose,
  initialItem = null,
}) => {
  const [items, setItems] = useState<GuiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [solo24hs, setSolo24hs] = useState(false);

  // Vista de Ficha seleccionada
  const [fichaSeleccionada, setFichaSeleccionada] = useState<GuiaItem | null>(null);
  const [fotoActivaIdx, setFotoActivaIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setFichaSeleccionada(initialItem ?? null);
      setFotoActivaIdx(0);
      void fetchItems();
    }
  }, [isOpen, initialItem]);

  const fetchItems = async () => {
    setLoading(true);
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('guia_util')
          .select('*')
          .order('urgencia', { ascending: false })
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true });

        if (!error && data) {
          setItems(data as GuiaItem[]);
          void setCachedData('guia_util_global', data);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Fallo de red en GuiaUtilModal. Cargando desde IndexedDB...', err);
      }
    }

    const gLocal = await getCachedData<GuiaItem[]>('guia_util_global');
    if (gLocal) {
      setItems(gLocal);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const categorias = [
    'Todas',
    'Emergencias',
    'Hospitales y Sanatorios',
    'Clínicas y Consultorios',
    'Salud',
    'Trámites y Municipio',
    'Transporte',
    'Iglesias y Culto',
  ];

  const itemsFiltrados = items.filter((i) => {
    const matchCat = categoriaActiva === 'Todas' || i.categoria === categoriaActiva;
    const match24 = !solo24hs || Boolean(i.es_24hs);
    return matchCat && match24;
  });

  const contarPorCategoria = (cat: string) =>
    cat === 'Todas' ? items.length : items.filter((i) => i.categoria === cat).length;

  const total24hs = items.filter((i) => Boolean(i.es_24hs)).length;

  const getCategoriaIcon = (cat: string) => {
    switch (cat) {
      case 'Emergencias':
        return <Flame className="w-4 h-4 text-rose-500" />;
      case 'Hospitales y Sanatorios':
        return <HeartPulse className="w-4 h-4 text-emerald-600" />;
      case 'Clínicas y Consultorios':
        return <Stethoscope className="w-4 h-4 text-teal-500" />;
      case 'Salud':
        return <HeartPulse className="w-4 h-4 text-emerald-500" />;
      case 'Iglesias y Culto':
        return <Landmark className="w-4 h-4 text-purple-500" />;
      case 'Trámites y Municipio':
      default:
        return <Building2 className="w-4 h-4 text-sky-500" />;
    }
  };

  const abrirFicha = (item: GuiaItem) => {
    setFichaSeleccionada(item);
    setFotoActivaIdx(0);
  };

  // RENDER DE FICHA DETALLADA DEL LUGAR
  if (fichaSeleccionada) {
    const fotos = Array.isArray(fichaSeleccionada.fotos) ? fichaSeleccionada.fotos : [];
    const waUrl = fichaSeleccionada.whatsapp
      ? formatWhatsAppUrl(fichaSeleccionada.whatsapp, fichaSeleccionada.nombre)
      : '';
    const mapsUrl =
      fichaSeleccionada.latitud && fichaSeleccionada.longitud
        ? `https://www.google.com/maps/search/?api=1&query=${fichaSeleccionada.latitud},${fichaSeleccionada.longitud}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${fichaSeleccionada.nombre},${fichaSeleccionada.direccion}, Nogoyá, Entre Ríos`
          )}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* HEADER FICHA */}
          <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-4 sm:p-5 text-white flex justify-between items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setFichaSeleccionada(null)}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a Guía Útil
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENIDO FICHA */}
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            {/* GALERÍA DE FOTOS (HASTA 5) */}
            {fotos.length > 0 && (
              <div className="space-y-2.5">
                <div className="relative w-full h-60 sm:h-72 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <img
                    src={fotos[fotoActivaIdx] || fotos[0]}
                    alt={`${fichaSeleccionada.nombre} - Foto ${fotoActivaIdx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {fotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setFotoActivaIdx((prev) => (prev === 0 ? fotos.length - 1 : prev - 1))
                        }
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/55 hover:bg-black/75 text-white transition"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFotoActivaIdx((prev) => (prev === fotos.length - 1 ? 0 : prev + 1))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/55 hover:bg-black/75 text-white transition"
                        aria-label="Foto siguiente"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] font-bold">
                        {fotoActivaIdx + 1} / {fotos.length}
                      </span>
                    </>
                  )}
                </div>

                {fotos.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {fotos.map((fotoUrl, i) => (
                      <button
                        key={`${fotoUrl}-${i}`}
                        type="button"
                        onClick={() => setFotoActivaIdx(i)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition ${
                          fotoActivaIdx === i
                            ? 'border-sky-600 ring-2 ring-sky-400/50'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={fotoUrl}
                          alt={`Miniatura ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DATOS PRINCIPALES */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {getCategoriaIcon(fichaSeleccionada.categoria)}
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {fichaSeleccionada.categoria}
                </span>
                {fichaSeleccionada.es_24hs && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">
                    24 HS
                  </span>
                )}
                {fichaSeleccionada.urgencia && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                    URGENCIA
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {fichaSeleccionada.nombre}
              </h2>

              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>{fichaSeleccionada.direccion}</span>
                </p>

                {fichaSeleccionada.horarios && (
                  <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{fichaSeleccionada.horarios}</span>
                  </p>
                )}
              </div>

              {fichaSeleccionada.descripcion && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                  {fichaSeleccionada.descripcion}
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN DIRECTA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-gray-200 dark:border-gray-700">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}

              {fichaSeleccionada.telefono && (
                <a
                  href={`tel:${fichaSeleccionada.telefono}`}
                  className={`px-4 py-3 rounded-2xl text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition ${
                    fichaSeleccionada.urgencia
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  <Phone className="w-4 h-4" /> Llamar ({fichaSeleccionada.telefono})
                </a>
              )}

              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition"
              >
                <Navigation className="w-4 h-4 text-sky-600" /> Cómo llegar
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Guía Útil de Nogoyá</h3>
              <p className="text-xs text-sky-100">Emergencias, hospitales, clínicas, iglesias y dependencias públicas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SELECTOR DE RUBRO + FILTRO 24 HS */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <label
              htmlFor="guia-rubro-select"
              className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1 shrink-0"
            >
              <Filter className="w-3.5 h-3.5 text-sky-600" />
              Rubro:
            </label>
            <select
              id="guia-rubro-select"
              value={categoriaActiva}
              onChange={(e) => setCategoriaActiva(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Todas'
                    ? `Todos los rubros (${contarPorCategoria(cat)})`
                    : `${cat} (${contarPorCategoria(cat)})`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSolo24hs((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition shrink-0 ${
              solo24hs
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-emerald-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            24 hs ({total24hs})
          </button>
        </div>

        {/* LISTADO */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 flex justify-center text-sky-600">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-1">
              <p className="font-bold text-sm">No hay teléfonos cargados con este filtro</p>
              <p className="text-xs">Probá cambiar de rubro o desactivar el filtro de 24 hs.</p>
            </div>
          ) : (
            itemsFiltrados.map((item) => {
              const waUrl = item.whatsapp ? formatWhatsAppUrl(item.whatsapp, item.nombre) : '';
              const fotos = Array.isArray(item.fotos) ? item.fotos : [];

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    item.urgencia
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sky-400'
                  }`}
                >
                  <div
                    onClick={() => abrirFicha(item)}
                    className="flex items-start gap-3 cursor-pointer group min-w-0 flex-1"
                  >
                    {fotos.length > 0 && (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100">
                        <img
                          src={fotos[0]}
                          alt={item.nombre}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        {fotos.length > 1 && (
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/70 text-white text-[9px] font-bold inline-flex items-center gap-0.5">
                            <Images className="w-2.5 h-2.5" /> {fotos.length}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoriaIcon(item.categoria)}
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {item.categoria}
                        </span>
                        {item.es_24hs && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">
                            24 HS
                          </span>
                        )}
                        {item.urgencia && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-pulse">
                            URGENCIA
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-sky-600 transition">
                        {item.nombre}
                      </h4>

                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" /> {item.direccion}
                      </p>

                      {item.horarios && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" /> {item.horarios}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/60 dark:border-gray-700/60">
                    <button
                      type="button"
                      onClick={() => abrirFicha(item)}
                      className="px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-extrabold inline-flex items-center justify-center gap-1 transition"
                      title="Ver ficha y fotos"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ficha
                    </button>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}

                    {item.telefono && (
                      <a
                        href={`tel:${item.telefono}`}
                        className={`px-3 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1 shadow-sm transition ${
                          item.urgencia
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-sky-600 hover:bg-sky-700 text-white'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" /> {item.telefono}
                      </a>
                    )}

                    <a
                      href={
                        item.latitud && item.longitud
                          ? `https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${item.nombre},${item.direccion}, Nogoyá, Entre Ríos`
                            )}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold inline-flex items-center justify-center transition"
                      title="Cómo llegar en Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-600" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
