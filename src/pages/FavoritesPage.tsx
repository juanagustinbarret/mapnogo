import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { Heart, MapPin, Store, ArrowRight, Trash2 } from 'lucide-react';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';

export const FavoritesPage: React.FC = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarFavoritos();
  }, []);

  const cargarFavoritos = async () => {
    setLoading(true);
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('nogoyork_favoritos') || '[]');
      
      if (favs.length === 0) {
        setComercios([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('comercios')
        .select(`${COLUMNAS_LISTADO_COMERCIO}, rubro:rubros(*)`)
        .in('id', favs);

      if (error) throw error;
      setComercios((data ?? []) as unknown as Comercio[]);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
    } finally {
      setLoading(false);
    }
  };

  const quitarFavorito = (id: string) => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('nogoyork_favoritos') || '[]');
      const nuevos = favs.filter((fId) => fId !== id);
      localStorage.setItem('nogoyork_favoritos', JSON.stringify(nuevos));
      setComercios((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Error al quitar favorito:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
          Mis Comercios Favoritos
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Accedé rápidamente a las fichas de los negocios que guardaste.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Cargando tus favoritos...
        </div>
      ) : comercios.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center border border-gray-200 dark:border-gray-700 space-y-4">
          <Store className="w-12 h-12 text-gray-400 mx-auto opacity-50" />
          <h3 className="font-bold text-gray-800 dark:text-white text-base">Aún no tenés comercios guardados</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Hacé clic en el botón con forma de corazón en la ficha de cualquier negocio para tenerlo siempre a mano acá.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Explorar Comercios
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comercios.map((comercio) => (
            <div
              key={comercio.id}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4 hover:border-rose-400 transition"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">
                      {comercio.rubro?.nombre || 'General'}
                    </span>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {comercio.nombre}
                    </h3>
                  </div>

                  <button
                    onClick={() => quitarFavorito(comercio.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg transition"
                    title="Quitar de favoritos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                  {comercio.descripcion_corta || 'Sin descripción disponible.'}
                </p>

                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  {comercio.direccion || 'Nogoyá, Entre Ríos'}
                </p>
              </div>

              <Link
                to={`/comercio/${comercio.slug}`}
                className="w-full py-2.5 bg-gray-50 dark:bg-gray-900 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border dark:border-gray-700 transition"
              >
                Ver Ficha <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};