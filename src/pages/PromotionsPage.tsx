import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Promocion, Rubro } from '@/types/database.types';
import { hoyArgentina, textoVencimiento } from '@/lib/fechasArgentina';
import { Tag, Search, Sparkles, Filter, Clock } from 'lucide-react';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { OfertaCard } from '@/components/OfertaCard';

export const PromotionsPage: React.FC = () => {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'promocion' | 'novedad'>('todas');
  const [soloPorVencer, setSoloPorVencer] = useState(false);

  useEffect(() => {
    const hoy = hoyArgentina();

    const pedirPromos = (columnas: string) =>
      supabase
        .from('promociones')
        .select(`*, comercio:comercios!inner(${columnas}, rubro:rubros(*))` as '*')
        .eq('aprobada', true)
        .gte('fecha_fin', hoy)
        .lte('fecha_inicio', hoy)
        .eq('comercio.aprobado', true)
        .eq('comercio.habilitado_admin', true)
        .order('fecha_fin', { ascending: true });

    const cargarTodo = async () => {
      setLoading(true);

      const { data: rubrosData } = await supabase
        .from('rubros')
        .select('*')
        .eq('estado', true)
        .order('orden');

      if (rubrosData) setRubros(rubrosData);

      let { data, error } = await pedirPromos(COLUMNAS_LISTADO_COMERCIO);
      if (error) ({ data, error } = await pedirPromos('*'));

      if (error) console.error('[promociones] No se pudieron cargar', error);
      if (data) setPromociones(data as any[]);

      setLoading(false);
    };

    void cargarTodo();
  }, []);

  const rubrosConOfertas = useMemo(() => {
    const idsRubrosConPromo = new Set(
      promociones.map((p: any) => p.comercio?.rubro_id || p.comercio?.rubro?.id).filter(Boolean)
    );

    return rubros
      .map((r) => ({
        ...r,
        cantidadPromos: promociones.filter(
          (p: any) => (p.comercio?.rubro_id || p.comercio?.rubro?.id) === r.id
        ).length,
      }))
      .filter((r) => idsRubrosConPromo.has(r.id));
  }, [rubros, promociones]);

  const promocionesFiltradas = promociones.filter((p: any) => {
    const texto = search.toLowerCase().trim();
    const coincideTexto =
      !texto ||
      p.titulo?.toLowerCase().includes(texto) ||
      p.descripcion?.toLowerCase().includes(texto) ||
      p.comercio?.nombre?.toLowerCase().includes(texto);

    const rubroIdComercio = p.comercio?.rubro_id || p.comercio?.rubro?.id;
    const coincideRubro = !selectedRubro || rubroIdComercio === selectedRubro;
    const coincideTipo = tipoFiltro === 'todas' || p.tipo === tipoFiltro;

    const vencInfo = p.fecha_fin ? textoVencimiento(p.fecha_fin) : null;
    const coincideVencimiento = !soloPorVencer || Boolean(vencInfo?.estaPorVencer);

    return coincideTexto && coincideRubro && coincideTipo && coincideVencimiento;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* BANNER PRINCIPAL */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-yellow-200" /> Descuentos & Oportunidades Directas
        </div>
        <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
          <Tag className="w-7 h-7 text-yellow-200" /> Promociones y Ofertas en Nogoyá
        </h1>
        <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
          Aprovechá los descuentos exclusivos, combos y novedades de los comercios locales adheridos a NOGOYORK.
        </p>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-white dark:bg-gray-800/90 rounded-3xl p-4 shadow-sm border border-gray-200 dark:border-gray-700/80 space-y-3">
        
        {/* BUSCADOR */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por oferta, producto o comercio (ej. Pizza, 2x1)..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none text-gray-900 dark:text-white"
          />
        </div>

        {/* SELECTOR DE TIPO (TODAS / SOLO OFERTAS / NOVEDADES) */}
        <div className="flex items-center w-full bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'promocion', label: 'Solo Ofertas' },
            { id: 'novedad', label: 'Novedades' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTipoFiltro(t.id as any)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition text-center whitespace-nowrap ${
                tipoFiltro === t.id
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CONTROLES INFERIORES: RUBRO Y FILTRO POR VENCER */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <div className="absolute left-3.5 top-3.5 pointer-events-none text-gray-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedRubro}
              onChange={(e) => setSelectedRubro(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Rubro: Todos ({promociones.length})</option>
              {rubrosConOfertas.map((r) => (
                <option key={r.id} value={r.id}>
                  Rubro: {r.nombre} ({r.cantidadPromos})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-gray-400 text-[10px]">
              ▼
            </div>
          </div>

          <button
            onClick={() => setSoloPorVencer(!soloPorVencer)}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 border shrink-0 ${
              soloPorVencer
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Por Vencer Pronto
          </button>
        </div>

      </div>

      {/* GRILLA DE OFERTAS */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Buscando publicaciones activas hoy en Nogoyá...
        </div>
      ) : promocionesFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl text-center text-gray-500 border border-gray-200 dark:border-gray-700 space-y-3">
          <Tag className="w-12 h-12 mx-auto opacity-30 text-amber-500" />
          <p className="text-sm font-semibold">
            {search || selectedRubro || tipoFiltro !== 'todas' || soloPorVencer
              ? 'No se encontraron publicaciones con esos filtros.'
              : 'No hay promociones activas en este momento. ¡Volvé a consultar pronto!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promocionesFiltradas.map((p: any) => (
            <OfertaCard key={p.id} promo={p} />
          ))}
        </div>
      )}
    </div>
  );
};