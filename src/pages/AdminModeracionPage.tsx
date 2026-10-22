import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Flag, ShieldAlert, X } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { COLUMNAS_FOTO, MOTIVOS_REPORTE, esTablaFaltante, resolverReporte, revisarFoto, type FotoComercio } from '@/lib/fotosComercio';

interface Reporte {
  id: string;
  created_at: string;
  comercio_id: string;
  foto_id: string | null;
  indice_galeria: number | null;
  motivo: string;
  detalle: string | null;
}

interface ComercioMin {
  id: string;
  nombre: string;
  slug: string;
  galeria_urls: string[] | null;
}

const textoMotivo = (m: string) => MOTIVOS_REPORTE.find((x) => x.valor === m)?.texto ?? m;
const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' });

// Cola de moderación: fotos que la revisión automática dejó en duda (o todas,
// si no hay proveedor configurado) y reportes del público.
export const AdminModeracionPage: React.FC = () => {
  const [pendientes, setPendientes] = useState<FotoComercio[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [fotosReportadas, setFotosReportadas] = useState<Record<string, FotoComercio>>({});
  const [comercios, setComercios] = useState<Record<string, ComercioMin>>({});
  const [cargando, setCargando] = useState(true);
  const [faltaConfigurar, setFaltaConfigurar] = useState(false);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = async () => {
    setError('');
    const [f, r] = await Promise.all([
      supabase.from('fotos_comercio').select(COLUMNAS_FOTO).eq('estado', 'pendiente').order('created_at', { ascending: true }),
      supabase.from('reportes_contenido').select('id, created_at, comercio_id, foto_id, indice_galeria, motivo, detalle').eq('estado', 'abierto').order('created_at', { ascending: true }),
    ]);
    if (esTablaFaltante(f.error) || esTablaFaltante(r.error)) {
      setFaltaConfigurar(true);
      setCargando(false);
      return;
    }
    if (f.error || r.error) setError((f.error ?? r.error)!.message);
    const fotos = (f.data ?? []) as FotoComercio[];
    const reps = (r.data ?? []) as Reporte[];
    const idsFotos = [...new Set(reps.map((x) => x.foto_id).filter(Boolean))] as string[];
    const reportadas = idsFotos.length ? ((await supabase.from('fotos_comercio').select(COLUMNAS_FOTO).in('id', idsFotos)).data ?? []) as FotoComercio[] : [];
    const idsComercios = [...new Set([...fotos.map((x) => x.comercio_id), ...reps.map((x) => x.comercio_id)])];
    const cs = idsComercios.length ? ((await supabase.from('comercios').select('id, nombre, slug, galeria_urls').in('id', idsComercios)).data ?? []) as ComercioMin[] : [];
    setPendientes(fotos);
    setReportes(reps);
    setFotosReportadas(Object.fromEntries(reportadas.map((x) => [x.id, x])));
    setComercios(Object.fromEntries(cs.map((x) => [x.id, x])));
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const revisar = async (foto: FotoComercio, estado: 'aprobada' | 'rechazada') => {
    setTrabajando(foto.id);
    const r = await revisarFoto(foto.id, estado);
    setTrabajando(null);
    if (!r.ok) return setError(r.mensaje);
    await cargar();
  };

  const cerrarReporte = async (rep: Reporte, estado: 'resuelto' | 'descartado') => {
    setTrabajando(rep.id);
    const r = await resolverReporte(rep.id, estado);
    setTrabajando(null);
    if (!r.ok) return setError(r.mensaje);
    setReportes((rs) => rs.filter((x) => x.id !== rep.id));
  };

  const boton = 'px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-brand-600" aria-hidden="true" /> Moderación de fotos
        </h1>
        <AdminNav />
      </div>

      {error && <p role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-semibold">{error}</p>}
      {faltaConfigurar && (
        <p className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-sm">
          Falta correr el SQL de moderación (supabase/propuestas/20261021_moderacion_imagenes.sql) y desplegar la función imagenes-comercio.
        </p>
      )}

      <section aria-labelledby="titulo-pendientes" className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 space-y-4">
        <h2 id="titulo-pendientes" className="font-bold text-gray-900 dark:text-white">Fotos en revisión ({cargando ? '…' : pendientes.length})</h2>
        {!cargando && pendientes.length === 0 && <p className="text-xs text-gray-500">No hay fotos esperando revisión.</p>}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendientes.map((f) => {
            const c = comercios[f.comercio_id];
            return (
              <li key={f.id} className="rounded-xl border dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
                {f.url && <img src={f.url} alt={`Foto en revisión de ${c?.nombre ?? 'un comercio'}`} className="w-full aspect-video object-cover" loading="lazy" />}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c?.nombre ?? 'Comercio'}</p>
                  <p className="text-[11px] text-gray-500">Subida {fecha(f.created_at)} · {f.motivo?.replace('revision:', 'motivo: ') ?? ''}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={trabajando === f.id} onClick={() => void revisar(f, 'aprobada')} className={`${boton} bg-green-600 text-white`}>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Aprobar
                    </button>
                    <button type="button" disabled={trabajando === f.id} onClick={() => void revisar(f, 'rechazada')} className={`${boton} bg-red-600 text-white`}>
                      <X className="w-3.5 h-3.5" aria-hidden="true" /> Rechazar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="titulo-reportes" className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 space-y-4">
        <h2 id="titulo-reportes" className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-600" aria-hidden="true" /> Reportes del público ({cargando ? '…' : reportes.length})
        </h2>
        {!cargando && reportes.length === 0 && <p className="text-xs text-gray-500">No hay reportes abiertos.</p>}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportes.map((rep) => {
            const c = comercios[rep.comercio_id];
            const foto = rep.foto_id ? fotosReportadas[rep.foto_id] : null;
            const url = foto?.url ?? (rep.indice_galeria !== null ? c?.galeria_urls?.[rep.indice_galeria] : undefined);
            return (
              <li key={rep.id} className="rounded-xl border dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
                {url && <img src={url} alt={`Foto reportada de ${c?.nombre ?? 'un comercio'}`} className="w-full aspect-video object-cover" loading="lazy" />}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c?.nombre ?? 'Comercio'}</p>
                  <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{textoMotivo(rep.motivo)}</p>
                  {rep.detalle && <p className="text-xs text-gray-600 dark:text-gray-300">“{rep.detalle}”</p>}
                  <p className="text-[11px] text-gray-500">{fecha(rep.created_at)} · {foto ? 'foto nueva' : 'foto cargada antes (se edita desde el Dashboard → Editar comercio)'}</p>
                  <div className="flex flex-wrap gap-2">
                    {foto && foto.estado !== 'rechazada' && (
                      <button type="button" disabled={trabajando === foto.id} onClick={() => void revisar(foto, 'rechazada')} className={`${boton} bg-red-600 text-white`}>
                        <X className="w-3.5 h-3.5" aria-hidden="true" /> Quitar foto
                      </button>
                    )}
                    <button type="button" disabled={trabajando === rep.id} onClick={() => void cerrarReporte(rep, 'resuelto')} className={`${boton} bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100`}>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Resuelto
                    </button>
                    <button type="button" disabled={trabajando === rep.id} onClick={() => void cerrarReporte(rep, 'descartado')} className={`${boton} bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100`}>
                      Descartar
                    </button>
                    {c && (
                      <Link to={`/comercio/${c.slug}`} target="_blank" className={`${boton} border dark:border-gray-700 text-gray-700 dark:text-gray-200`}>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Ficha
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
