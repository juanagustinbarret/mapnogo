import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Store, Tag, ArrowRight, X } from 'lucide-react';
import { Comercio, Rubro } from '@/types/database.types';
import { InsigniaRubro } from '@/components/InsigniaRubro';

interface SmartSearchProps {
  comercios: Comercio[];
  rubros: Rubro[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectRubro: (rubroId: string) => void;
}

export const SmartSearch: React.FC<SmartSearchProps> = ({
  comercios,
  rubros,
  searchQuery,
  onSearchChange,
  onSelectRubro,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  // Cerrar desplegable al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const queryLimpia = searchQuery.trim().toLowerCase();

  // Sugerencias de Comercios
  const sugerenciasComercios = queryLimpia.length >= 2
    ? comercios.filter((c) =>
        c.nombre.toLowerCase().includes(queryLimpia) ||
        c.descripcion_corta?.toLowerCase().includes(queryLimpia) ||
        c.direccion?.toLowerCase().includes(queryLimpia)
      ).slice(0, 4)
    : [];

  // Sugerencias de Rubros
  const sugerenciasRubros = queryLimpia.length >= 2
    ? rubros.filter((r) => r.nombre.toLowerCase().includes(queryLimpia)).slice(0, 3)
    : [];

  const handleSelectComercio = (slug: string) => {
    setIsOpen(false);
    navigate(`/comercio/${slug}`);
  };

  const handleSelectRubroClick = (rubroId: string) => {
    onSelectRubro(rubroId);
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full z-30">
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por negocio, servicio, comida o calle..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* DESPLEGABLE DE AUTOCOMPLETADO */}
      {isOpen && queryLimpia.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto z-50 divide-y divide-gray-100 dark:divide-gray-700/60 animate-in fade-in duration-150">
          
          {/* RUBROS ENCONTRADOS */}
          {sugerenciasRubros.length > 0 && (
            <div className="p-2 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 block">
                Categorías
              </span>
              {sugerenciasRubros.map((rubro) => (
                <button
                  key={rubro.id}
                  onClick={() => handleSelectRubroClick(rubro.id)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-gray-700/60 rounded-xl flex items-center justify-between transition text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  <span className="flex items-center gap-2">
                    <InsigniaRubro rubro={rubro} />
                    {rubro.nombre}
                  </span>
                  <Tag className="w-3.5 h-3.5 opacity-60" />
                </button>
              ))}
            </div>
          )}

          {/* COMERCIOS ENCONTRADOS */}
          {sugerenciasComercios.length > 0 && (
            <div className="p-2 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 block">
                Comercios Sugeridos
              </span>
              {sugerenciasComercios.map((comercio) => (
                <button
                  key={comercio.id}
                  onClick={() => handleSelectComercio(comercio.slug)}
                  className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {comercio.nombre}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {comercio.direccion || 'Nogoyá, Entre Ríos'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {sugerenciasComercios.length === 0 && sugerenciasRubros.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-500">
              No encontramos negocios ni rubros con "<strong>{searchQuery}</strong>"
            </div>
          )}
        </div>
      )}
    </div>
  );
};