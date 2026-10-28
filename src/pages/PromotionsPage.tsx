import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Promocion, Rubro } from '@/types/database.types';
import { hoyArgentina } from '@/lib/fechasArgentina';
import { Tag, Search, Sparkles, Filter } from 'lucide-react';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { OfertaCard } from '@/components/OfertaCard';
import { InsigniaRubro } from '@/components/InsigniaRubro';

export const PromotionsPage: React.FC = () => {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'promocion' | 'novedad'>('todas');

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
      const { data: rubrosData } = await supabase.from('rubros').select('*').eq('estado', true).order('orden');
      if (rubrosData) setRubros(rubrosData);

      let { data, error } = await pedirPromos(COLUMNAS_LISTADO_COMERCIO);
      if (error) ({ data, error } = await pedirPromos('*'));

      if (error) console.error('[promociones] No se pudieron cargar', error);
      if (data) setPromociones(data as any[]);
      setLoading(false);
    };

    void cargarTodo();
  }, []);

  // Filtrado dinámico
  const promocionesFiltradas = promociones.filter((p: any) => {
    const texto = search.toLowerCase().trim();
    const coincideTexto =
      !texto ||
      p.titulo?.toLowerCase().includes(texto) ||
      p.descripcion?.toLowerCase().includes(texto) ||
      p.comercio?.nombre?.toLowerCase().includes(texto);

    const coincideRubro = !selectedRubro || p.comercio?.rubro_id === selectedRubro;
    const coincideTipo = tipoFiltro === 'todas' || p.tipo === tipoFiltro;

    return coincideTexto && coincideRubro && coincideTipo;
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          
          {/* INPUT BUSCADOR */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por oferta, producto o comercio (ej. Pizza, 2x1)..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* CHIPS DE TIPO */}
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0">
            {[
              { id: 'todas', label: 'Todas' },
              { id: 'promocion', label: 'Solo Ofertas' },
              { id: 'novedad', label: 'Novedades' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTipoFiltro(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  tipoFiltro === t.id
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* BARRAS DE RUBROS */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-t border-gray-100 dark:border-gray-700/60 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Rubro:
          </span>

          <button
            onClick={() => setSelectedRubro('')}
            className={`px-3 py-1 text-xs font-bold rounded-xl transition shrink-0 ${
              selectedRubro === ''
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>

          {rubros.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRubro(r.id)}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition shrink-0 inline-flex items-center gap-1.5 ${
                selectedRubro === r.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <InsigniaRubro rubro={r} />
              {r.nombre}
            </button>
          ))}
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
            {search || selectedRubro || tipoFiltro !== 'todas'
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