import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { calcularPuntaje, type PuntajePropio } from '@/lib/puntajePropio';
import { etiquetaPuntaje, textoPuntaje } from '@/lib/puntaje';
import { Estrellas } from '@/components/Estrellas';

// Una consulta por comercio y por visita: se pide recién al abrir el popup
// (el mapa no consulta nada de más al cargar).
const yaConsultados = new Map<string, Promise<PuntajePropio>>();

export function puntajeDeComercio(comercioId: string): Promise<PuntajePropio> {
  let pedido = yaConsultados.get(comercioId);
  if (!pedido) {
    pedido = Promise.resolve(
      supabase.from('resenas').select('estrellas').eq('comercio_id', comercioId).limit(1000),
    ).then(({ data, error }) => {
      if (error) throw error;
      return calcularPuntaje((data ?? []).map((r: { estrellas: unknown }) => r.estrellas));
    });
    pedido.catch(() => yaConsultados.delete(comercioId)); // si falla, se reintenta la próxima vez
    yaConsultados.set(comercioId, pedido);
  }
  return pedido;
}

/** Línea del popup: ★★★★☆ 4,6 (12), con link a las reseñas de la ficha. */
export const PuntajePopup: React.FC<{ comercioId: string; slug: string }> = ({ comercioId, slug }) => {
  const [dato, setDato] = useState<PuntajePropio | null | 'error'>(null);

  useEffect(() => {
    let vigente = true;
    puntajeDeComercio(comercioId)
      .then((p) => vigente && setDato(p))
      .catch(() => vigente && setDato('error'));
    return () => {
      vigente = false;
    };
  }, [comercioId]);

  if (dato === null) return <div className="h-4 w-28 rounded bg-gray-100 animate-pulse" aria-hidden="true" />;
  if (dato === 'error') return null; // sin datos: no se muestra la línea

  const texto = textoPuntaje(dato.puntaje, dato.total);
  return (
    <Link
      to={`/comercio/${slug}#resenas`}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 hover:underline"
      aria-label={`${etiquetaPuntaje(dato.puntaje, dato.total)} en NOGOYORK. Ver reseñas`}
    >
      {texto ? (
        <>
          <Estrellas puntaje={dato.puntaje} total={dato.total} tamano="w-3 h-3" />
          <span>{texto}</span>
        </>
      ) : (
        <span className="text-gray-500">Sin reseñas todavía</span>
      )}
    </Link>
  );
};
