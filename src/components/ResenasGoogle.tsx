import React, { useEffect, useState } from 'react';
import { ExternalLink, Flag, PenLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Estrellas } from '@/components/Estrellas';
import {
  etiquetaPuntaje,
  fechaResena,
  textoPuntaje,
  type ResenaGoogle,
  type RespuestaResenasGoogle,
} from '@/lib/resenasGoogle';

const LARGO_CORTO = 280;

/** ¿El comercio tiene ficha de Google vinculada? (si falta la columna, se toma como que no) */
async function estaVinculado(slug: string): Promise<boolean> {
  const { data, error } = await supabase.from('comercios').select('google_place_id').eq('slug', slug).maybeSingle();
  return !error && !!(data as { google_place_id?: string | null } | null)?.google_place_id;
}

export async function pedirResenasGoogle(slug: string, pedir: typeof fetch = fetch): Promise<RespuestaResenasGoogle> {
  try {
    const r = await pedir(`/api/google?accion=resenas&slug=${encodeURIComponent(slug)}`);
    const datos = (await r.json()) as RespuestaResenasGoogle;
    if (datos && (datos.estado === 'ok' || datos.estado === 'sin_vincular' || datos.estado === 'error')) return datos;
    return { estado: 'error', mensaje: 'Respuesta inesperada.' };
  } catch {
    return { estado: 'error', mensaje: 'No se pudo conectar.' };
  }
}

const Atribucion: React.FC = () => (
  // Atribución de Google (texto, porque no hay espacio para el logo). Ver docs/google-places.md
  <span className="text-[11px] text-gray-500 dark:text-gray-400">
    Datos de <span className="font-medium text-[#5e5e5e] dark:text-gray-300" translate="no">Google Maps</span>
  </span>
);

const UnaResena: React.FC<{ r: ResenaGoogle }> = ({ r }) => {
  const [abierta, setAbierta] = useState(false);
  const larga = r.texto.length > LARGO_CORTO;
  const visible = larga && !abierta ? `${r.texto.slice(0, LARGO_CORTO).trimEnd()}…` : r.texto;
  const fecha = fechaResena(r.fecha);

  return (
    <li className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-1.5 border dark:border-gray-800">
      <div className="flex items-center gap-2.5">
        {r.autorFoto ? (
          <img src={r.autorFoto} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          {/* Atribución del autor: nombre con link a su perfil de Google */}
          {r.autorUrl ? (
            <a href={r.autorUrl} target="_blank" rel="noopener noreferrer nofollow" className="block font-bold text-xs text-gray-900 dark:text-white hover:underline truncate">
              {r.autor}
            </a>
          ) : (
            <span className="block font-bold text-xs text-gray-900 dark:text-white truncate">{r.autor}</span>
          )}
          <span className="flex items-center gap-2 text-[11px] text-gray-500">
            <Estrellas puntaje={r.estrellas} etiqueta={`${r.estrellas} de 5 estrellas`} tamano="w-3 h-3" />
            {fecha && <time dateTime={r.fecha ?? undefined}>{fecha}</time>}
          </span>
        </div>
      </div>
      {/* Texto de terceros: siempre como texto, nunca como HTML */}
      {r.texto && <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{visible}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {larga && (
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} className="font-bold text-brand-600 hover:underline">
            {abierta ? 'Ver menos' : 'Ver más'}
          </button>
        )}
        {r.traducida && <span className="text-gray-500">Traducida por Google</span>}
        {r.url && (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline inline-flex items-center gap-0.5">
            Ver en Google Maps <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
        {r.reportarUrl && (
          <a href={r.reportarUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:underline inline-flex items-center gap-0.5">
            <Flag className="w-3 h-3" aria-hidden="true" /> Reportar
          </a>
        )}
      </div>
    </li>
  );
};

/**
 * Reseñas de Google en la ficha. No consulta a Google sola: solo cuando
 * alguien toca "Ver reseñas de Google" (cada consulta se paga y no se puede
 * guardar). Si el comercio no está vinculado, no muestra nada.
 */
export const ResenasGoogle: React.FC<{ slug: string; nombre: string; consultar?: typeof pedirResenasGoogle }> = ({
  slug,
  nombre,
  consultar = pedirResenasGoogle,
}) => {
  const [vinculado, setVinculado] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<'inicial' | 'cargando' | RespuestaResenasGoogle>('inicial');

  useEffect(() => {
    let vigente = true;
    setEstado('inicial');
    estaVinculado(slug).then((v) => vigente && setVinculado(v));
    return () => {
      vigente = false;
    };
  }, [slug]);

  if (!vinculado) return null;

  const cargar = async () => {
    setEstado('cargando');
    setEstado(await consultar(slug));
  };

  if (estado === 'inicial' || estado === 'cargando') {
    return (
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">Reseñas de Google</p>
          <Atribucion />
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={estado === 'cargando'}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900 disabled:opacity-60"
        >
          {estado === 'cargando' ? 'Cargando…' : 'Ver reseñas de Google'}
        </button>
      </div>
    );
  }

  if (estado.estado === 'sin_vincular') return null;

  if (estado.estado === 'error') {
    return (
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-2" role="status">
        <p>No se pudieron cargar las reseñas de Google en este momento.</p>
        <button type="button" onClick={cargar} className="font-bold text-brand-600 hover:underline">Reintentar</button>
      </div>
    );
  }

  const resumen = textoPuntaje(estado.puntaje, estado.total);
  return (
    <section aria-labelledby="titulo-resenas-google" className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="titulo-resenas-google" className="text-sm font-bold text-gray-900 dark:text-white">Reseñas de Google</h4>
          <Atribucion />
        </div>
        {resumen ? (
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white" aria-label={etiquetaPuntaje(estado.puntaje, estado.total)}>
            <Estrellas puntaje={estado.puntaje} total={estado.total} />
            <span aria-hidden="true">{resumen}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">Sin reseñas todavía</p>
        )}
      </div>

      {estado.resenas.length > 0 && (
        <>
          <p className="text-[11px] text-gray-500">
            Hasta 5 reseñas, ordenadas por relevancia según Google. {estado.total > estado.resenas.length && 'Las demás están en Google Maps.'}
          </p>
          <ul className="space-y-2.5">
            {estado.resenas.map((r, i) => (
              <UnaResena key={`${r.autor}-${i}`} r={r} />
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={estado.links.escribir}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
        >
          <PenLine className="w-4 h-4" aria-hidden="true" /> Dejar mi reseña en Google
        </a>
        {estado.links.verTodas && estado.total > 0 && (
          <a
            href={estado.links.verTodas}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver todas las reseñas de ${nombre} en Google`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
          >
            Ver todas en Google <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
};
