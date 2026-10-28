import React, { useState, useEffect } from 'react';
import { Search, Store, Tag, Crosshair, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Resultado {
  id: string;
  nombre: string;
  tipo: 'comercio' | 'rubro' | 'oferta';
  url: string;
  subtexto?: string;
}

export const BuscadorGlobal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  // Atajo de teclado (Ctrl+K o Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
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
        const [
          { data: comercios },
          { data: rubros },
          { data: promociones }
        ] = await Promise.all([
          supabase
            .from('comercios')
            .select('id, nombre, slug, direccion')
            .eq('aprobado', true)
            .eq('habilitado_admin', true)
            .ilike('nombre', `%${texto}%`)
            .limit(5),
          supabase
            .from('rubros')
            .select('id, nombre')
            .ilike('nombre', `%${texto}%`)
            .limit(3),
          supabase
            .from('promociones')
            .select('id, titulo, comercio_id, comercio:comercios(slug, nombre)')
            .ilike('titulo', `%${texto}%`)
            .limit(4)
        ]);

        const lista: Resultado[] = [];

        (comercios || []).forEach((c) => {
          lista.push({
            id: c.id,
            nombre: c.nombre,
            tipo: 'comercio',
            url: `/comercio/${c.slug}`,
            subtexto: c.direccion || 'Comercio verificado'
          });
        });

        (rubros || []).forEach((r) => {
          lista.push({
            id: r.id,
            nombre: r.nombre,
            tipo: 'rubro',
            url: `/?rubro=${r.id}`,
            subtexto: 'Categoría de comercios'
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
              subtexto: `Oferta en ${comercioRel.nombre}`
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

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cabecera / Input */}
        <div className="relative flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar comercio, rubro u oferta... (Esc para salir)"
            className="w-full py-4 text-base bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none placeholder-gray-400"
            autoFocus
          />
          {cargando ? (
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin mr-2" />
          ) : (
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-4 text-center text-sm text-gray-400">
              Escribí para buscar en todo NOGOYORK...
            </div>
          ) : resultados.length === 0 && !cargando ? (
            <div className="p-4 text-center text-sm text-gray-400">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            resultados.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelect(res.url)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                {res.tipo === 'comercio' && <Store className="w-5 h-5 text-blue-500 shrink-0" />}
                {res.tipo === 'oferta' && <Tag className="w-5 h-5 text-green-500 shrink-0" />}
                {res.tipo === 'rubro' && <Crosshair className="w-5 h-5 text-orange-500 shrink-0" />}
                
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {res.nombre}
                  </p>
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
          <span>Consejo: Presioná <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 font-mono">Ctrl + K</kbd> en cualquier momento</span>
        </div>
      </div>
    </div>
  );
};

export default BuscadorGlobal;