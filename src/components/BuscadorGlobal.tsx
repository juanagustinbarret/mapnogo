// src/components/BuscadorGlobal.tsx

import React, { useState, useEffect } from 'react';
import {
  Search,
  Store,
  Tag,
  Crosshair,
  X,
  Loader2,
  Rocket,
  Wrench,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Resultado {
  id: string;
  nombre: string;
  tipo: 'comercio' | 'emprendimiento' | 'rubro' | 'oferta' | 'seccion';
  url: string;
  subtexto?: string;
}

const ACCESOS_RAPIDOS: Resultado[] = [
  {
    id: 'nav-emprendimientos',
    nombre: 'Emprendimientos en Nogoyá',
    tipo: 'emprendimiento',
    url: '/emprendimientos',
    subtexto: 'Proyectos locales y productores independientes',
  },
  {
    id: 'nav-mapa-emprendimientos',
    nombre: 'Ver Emprendimientos en el Mapa',
    tipo: 'seccion',
    url: '/?emprendimientos=1',
    subtexto: 'Filtrar mapa interactivo solo por emprendimientos',
  },
  {
    id: 'nav-ofertas',
    nombre: 'Ofertas y Promociones',
    tipo: 'oferta',
    url: '/promociones',
    subtexto: 'Descuentos vigentes en comercios locales',
  },
  {
    id: 'nav-oficios',
    nombre: 'Guía de Oficios y Servicios',
    tipo: 'seccion',
    url: '/oficios',
    subtexto: 'Electricistas, plomeros, técnicos y más',
  },
];

export const BuscadorGlobal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  // Atajos de teclado (Ctrl+K / Cmd+K para abrir/cerrar, Escape para cerrar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Búsqueda remota en vivo sobre Supabase
  useEffect(() => {
    const texto = query.trim();
    if (!texto) {
      setResultados([]);
      return;
    }

    const buscar = async () => {
      setCargando(true);
      try {
        const pedirComercios = (conFlagEmprendimiento: boolean) =>
          supabase
            .from('comercios')
            .select(
              conFlagEmprendimiento
                ? 'id, nombre, slug, direccion, es_emprendimiento'
                : 'id, nombre, slug, direccion'
            )
            .eq('aprobado', true)
            .eq('habilitado_admin', true)
            .ilike('nombre', `%${texto}%`)
            .limit(6);

        let { data: comercios, error: errComercios } = await pedirComercios(true);
        if (errComercios) {
          ({ data: comercios } = await pedirComercios(false));
        }

        const [{ data: rubros }, { data: promociones }] = await Promise.all([
          supabase
            .from('rubros')
            .select('id, nombre')
            .ilike('nombre', `%${texto}%`)
            .limit(3),
          supabase
            .from('promociones')
            .select('id, titulo, comercio_id, comercio:comercios(slug, nombre)')
            .ilike('titulo', `%${texto}%`)
            .limit(4),
        ]);

        const lista: Resultado[] = [];
        const qLower = texto.toLowerCase();

        if ('emprendimientos'.includes(qLower) || 'emprendedor'.includes(qLower)) {
          lista.push({
            id: 'quick-emprendimientos',
            nombre: 'Explorar todos los Emprendimientos',
            tipo: 'emprendimiento',
            url: '/emprendimientos',
            subtexto: 'Ir a la sección de emprendimientos locales',
          });
        }

        (comercios || []).forEach((c: any) => {
          const esEmp = Boolean(c.es_emprendimiento);
          lista.push({
            id: c.id,
            nombre: c.nombre,
            tipo: esEmp ? 'emprendimiento' : 'comercio',
            url: `/comercio/${c.slug}`,
            subtexto: esEmp
              ? `Emprendimiento · ${c.direccion || 'Nogoyá'}`
              : c.direccion || 'Comercio verificado',
          });
        });

        (rubros || []).forEach((r) => {
          lista.push({
            id: r.id,
            nombre: r.nombre,
            tipo: 'rubro',
            url: `/?rubro=${r.id}`,
            subtexto: 'Categoría de comercios',
          });
        });

        (promociones || []).forEach((p: any) => {
          const comercioRel = Array.isArray(p.comercio) ? p.comercio[0] : p.comercio;
          if (comercioRel?.slug) {
            lista.push({
              id: p.id,
              nombre: p.titulo,
              tipo: 'oferta',
              url: `/comercio/${comercioRel.slug}`,
              subtexto: `Oferta en ${comercioRel.nombre}`,
            });
          }
        });

        setResultados(lista);
      } catch (err) {
        console.error('Error en búsqueda global:', err);
      } finally {
        setCargando(false);
      }
    };

    const timeout = setTimeout(buscar, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(url);
  };

  if (!isOpen) return null;

  const renderIcono = (tipo: Resultado['tipo']) => {
    switch (tipo) {
      case 'emprendimiento':
        return <Rocket className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />;
      case 'comercio':
        return <Store className="w-5 h-5 text-blue-500 shrink-0" />;
      case 'oferta':
        return <Tag className="w-5 h-5 text-green-500 shrink-0" />;
      case 'rubro':
        return <Crosshair className="w-5 h-5 text-orange-500 shrink-0" />;
      case 'seccion':
        return <MapPin className="w-5 h-5 text-indigo-500 shrink-0" />;
      default:
        return <Wrench className="w-5 h-5 text-gray-500 shrink-0" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cabecera / Input */}
        <div className="relative flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar comercio, emprendimiento, rubro u oferta... (Esc para salir)"
            className="w-full py-4 text-base bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none placeholder-gray-400"
            autoFocus
          />
          {cargando ? (
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin mr-2" />
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Cerrar buscador"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Lista de Resultados o Accesos Rápidos */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="space-y-1">
              <p className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Accesos rápidos
              </p>
              {ACCESOS_RAPIDOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.url)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50/70 dark:hover:bg-gray-700/50 text-left transition-colors"
                >
                  {renderIcono(item.tipo)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {item.nombre}
                      </p>
                      {item.tipo === 'emprendimiento' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold shrink-0">
                          Nuevo
                        </span>
                      )}
                    </div>
                    {item.subtexto && (
                      <p className="text-xs text-gray-400 truncate">{item.subtexto}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : resultados.length === 0 && !cargando ? (
            <div className="p-4 text-center text-sm text-gray-400">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            resultados.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => handleSelect(res.url)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                {renderIcono(res.tipo)}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {res.nombre}
                    </p>
                    {res.tipo === 'emprendimiento' && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold shrink-0">
                        Emprendimiento
                      </span>
                    )}
                  </div>
                  {res.subtexto && (
                    <p className="text-xs text-gray-400 truncate">{res.subtexto}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
          <span>
            Consejo: Presioná{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 font-mono">
              Ctrl + K
            </kbd>{' '}
            en cualquier momento
          </span>
        </div>
      </div>
    </div>
  );
};

export default BuscadorGlobal;
