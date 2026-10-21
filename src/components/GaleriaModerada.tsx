import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload, Clock, CheckCircle2, Info } from 'lucide-react';
import { GestionGaleriaComercio } from '@/components/GestionGaleriaComercio';
import { TEXTO_ESTADO, borrarFoto, cargarFotosComercio, subirFoto, type FotoComercio } from '@/lib/fotosComercio';

interface Props {
  comercioId: string;
  /** Fotos viejas (guardadas como texto en comercios.galeria_urls) */
  galeriaVieja: string[];
  /** Mientras la base no tenga fotos_comercio, se usa la galería anterior */
  onGuardarGaleriaVieja: (urls: string[]) => void;
  maxFotos?: number;
}

const ESTILO_ESTADO = {
  aprobada: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  rechazada: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
} as const;

// Galería del panel con moderación: cada foto pasa por el servidor (valida,
// limpia, modera) antes de verse en la ficha. Si la base todavía no tiene la
// tabla fotos_comercio (falta correr el SQL), sigue la galería anterior.
export const GaleriaModerada: React.FC<Props> = ({ comercioId, galeriaVieja, onGuardarGaleriaVieja, maxFotos = 6 }) => {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [fotos, setFotos] = useState<FotoComercio[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    cargarFotosComercio(comercioId).then((r) => {
      if (!vivo) return;
      setDisponible(r.disponible);
      setFotos(r.fotos);
    });
    return () => {
      vivo = false;
    };
  }, [comercioId]);

  if (disponible === false) {
    return <GestionGaleriaComercio galeriaUrls={galeriaVieja} onChange={onGuardarGaleriaVieja} maxFotos={maxFotos} />;
  }

  const lugar = maxFotos - fotos.length;

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setAviso(null);
    setSubiendo(true);
    for (const archivo of Array.from(archivos).slice(0, Math.max(0, lugar))) {
      const r = await subirFoto(comercioId, archivo);
      if (r.ok) {
        setFotos((f) => [...f, r.valor]);
        setAviso({ tipo: r.valor.estado === 'aprobada' ? 'ok' : 'info', texto: r.mensaje ?? 'Foto subida.' });
      } else {
        setAviso({ tipo: 'error', texto: `${archivo.name}: ${r.mensaje}` });
      }
    }
    setSubiendo(false);
    if (entrada.current) entrada.current.value = '';
  };

  const borrar = async (foto: FotoComercio) => {
    if (!confirm('¿Borrar esta foto?')) return;
    const r = await borrarFoto(foto.id);
    if (r.ok) setFotos((f) => f.filter((x) => x.id !== foto.id));
    else setAviso({ tipo: 'error', texto: r.mensaje });
  };

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/80">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Fotos del local
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cada foto se revisa antes de mostrarse en tu ficha.</p>
        </div>
        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-200 dark:bg-gray-800 px-2.5 py-1 rounded-lg shrink-0">
          {fotos.length} / {maxFotos}
        </span>
      </div>

      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={subiendo || lugar <= 0 || disponible === null}
        className="w-full border-2 border-dashed rounded-2xl p-5 text-center transition flex flex-col items-center gap-2 border-gray-300 dark:border-gray-700 hover:border-emerald-500 bg-white dark:bg-gray-800 disabled:opacity-50"
      >
        <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full">
          <Upload className="w-6 h-6" aria-hidden="true" />
        </span>
        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
          {subiendo ? 'Subiendo y revisando…' : lugar <= 0 ? `Llegaste al máximo de ${maxFotos} fotos` : 'Subir fotos desde tu dispositivo'}
        </span>
        <span className="text-[11px] text-gray-500">JPG, PNG o WebP. Se achican y se les quitan los datos ocultos (ubicación, cámara).</span>
      </button>
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void subir(e.target.files)} aria-label="Elegir fotos" />

      {aviso && (
        <p role="status" className={`text-xs font-semibold ${aviso.tipo === 'error' ? 'text-red-600 dark:text-red-400' : aviso.tipo === 'info' ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-400'}`}>
          {aviso.texto}
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fotos.map((f) => (
            <li key={f.id} className="relative rounded-xl overflow-hidden aspect-video border border-gray-200 dark:border-gray-700 bg-black/10">
              {f.url && <img src={f.url} alt="Foto del local" className="w-full h-full object-cover" loading="lazy" />}
              <span className={`absolute left-1.5 bottom-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${ESTILO_ESTADO[f.estado]}`}>
                {f.estado === 'aprobada' ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                {TEXTO_ESTADO[f.estado]}
              </span>
              <button type="button" onClick={() => void borrar(f)} aria-label="Borrar esta foto" className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 text-white rounded-lg shadow-md hover:bg-red-700">
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {galeriaVieja.length > 0 && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
          <span>
            Tenés {galeriaVieja.length} foto{galeriaVieja.length === 1 ? '' : 's'} cargada{galeriaVieja.length === 1 ? '' : 's'} antes de este cambio: se siguen viendo en tu ficha. Para quitarlas, pedíselo al administrador.
          </span>
        </div>
      )}
    </div>
  );
};
