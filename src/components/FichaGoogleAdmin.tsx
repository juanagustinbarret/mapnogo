import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Search, Store, Unlink, X } from 'lucide-react';
import {
  ESTADOS_GOOGLE,
  PASOS_CREAR_FICHA,
  URL_CREAR_FICHA,
  interpretarFichaPegada,
  textoHorariosParaFicha,
  textoParaCrearFicha,
  type CandidatoGoogle,
  type DatosParaFicha,
} from '@/lib/resenasGoogle';
import { buscarEnGoogle, horariosDelComercio, type VinculoGoogle } from '@/services/googleAdmin';

interface Props {
  /** Datos del comercio para buscar y para "Crear ficha en Google". */
  comercio: DatosParaFicha & { id?: string };
  valor: VinculoGoogle;
  /** Se llama al confirmar. Si devuelve una promesa que falla, se muestra el error. */
  onCambiar: (vinculo: VinculoGoogle) => void | Promise<void>;
  /** Mostrar resultados apenas se abre (vinculación por lote). */
  buscarAlAbrir?: boolean;
}

const boton = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50';

/**
 * Campo "Ficha de Google" del admin: buscar por nombre y dirección, pegar un
 * link o place_id, o marcar que no tiene ficha. Nada se vincula solo: el
 * admin confirma cada candidato con "Es este".
 */
export const FichaGoogleAdmin: React.FC<Props> = ({ comercio, valor, onCambiar, buscarAlAbrir = false }) => {
  const [consulta, setConsulta] = useState(`${comercio.nombre}, ${comercio.direccion}, Nogoyá`);
  const [pegado, setPegado] = useState('');
  const [candidatos, setCandidatos] = useState<CandidatoGoogle[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [verCrear, setVerCrear] = useState(false);
  const [horarios, setHorarios] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setConsulta(`${comercio.nombre}, ${comercio.direccion}, Nogoyá`);
    setCandidatos(null);
    setError('');
    setVerCrear(false);
    if (buscarAlAbrir && comercio.nombre) void buscar({ texto: `${comercio.nombre}, ${comercio.direccion}, Nogoyá` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercio.id, comercio.nombre]);

  const buscar = async (pedido: { texto: string } | { placeId: string }) => {
    setBuscando(true);
    setError('');
    try {
      const encontrados = await buscarEnGoogle(pedido);
      setCandidatos(encontrados);
      if (encontrados.length === 0) setError('Google no encontró ese lugar. Probá con otro nombre o marcá "No tiene ficha en Google".');
    } catch (e: any) {
      setError(e?.message || 'No se pudo buscar en Google.');
    } finally {
      setBuscando(false);
    }
  };

  const usarPegado = () => {
    const r = interpretarFichaPegada(pegado);
    if ('error' in r) return setError(r.error);
    if ('placeId' in r) return void buscar({ placeId: r.placeId });
    setConsulta(r.busqueda);
    void buscar({ texto: r.busqueda });
  };

  const confirmar = async (vinculo: VinculoGoogle) => {
    setGuardando(true);
    setError('');
    try {
      await onCambiar(vinculo);
      setCandidatos(null);
      setPegado('');
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirCrear = async () => {
    setVerCrear((v) => !v);
    if (!horarios && comercio.id) setHorarios(textoHorariosParaFicha(await horariosDelComercio(comercio.id)));
  };

  const datosParaCopiar = textoParaCrearFicha({ ...comercio, horarios: horarios || comercio.horarios });
  const estado = ESTADOS_GOOGLE[valor.estado];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full font-bold ${estado.clase}`}>{estado.texto}</span>
        {valor.estado === 'vinculado' && valor.placeId && (
          <>
            <a
              href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(valor.placeId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 font-bold hover:underline inline-flex items-center gap-1"
            >
              Ver en Google Maps <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <button type="button" disabled={guardando} onClick={() => confirmar({ placeId: null, estado: 'no_vinculado' })} className={`${boton} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}>
              <Unlink className="w-3.5 h-3.5" aria-hidden="true" /> Desvincular
            </button>
          </>
        )}
      </div>

      {valor.estado !== 'vinculado' && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="sr-only" htmlFor={`google-buscar-${comercio.id ?? 'nuevo'}`}>Buscar en Google por nombre y dirección</label>
            <input
              id={`google-buscar-${comercio.id ?? 'nuevo'}`}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
            <button type="button" disabled={buscando} onClick={() => buscar({ texto: consulta })} className={`${boton} bg-gray-900 text-white dark:bg-white dark:text-gray-900 justify-center`}>
              <Search className="w-3.5 h-3.5" aria-hidden="true" /> {buscando ? 'Buscando…' : 'Buscar en Google'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="sr-only" htmlFor={`google-pegar-${comercio.id ?? 'nuevo'}`}>Pegar link de Google Maps o place_id</label>
            <input
              id={`google-pegar-${comercio.id ?? 'nuevo'}`}
              value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              placeholder="O pegá el link de Google Maps o el place_id"
              className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
            <button type="button" disabled={buscando || !pegado.trim()} onClick={usarPegado} className={`${boton} bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white justify-center`}>
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" /> Usar link
            </button>
          </div>
        </>
      )}

      {error && <p role="alert" className="font-semibold text-red-600 dark:text-red-400">{error}</p>}

      {candidatos && candidatos.length > 0 && (
        <ul className="space-y-2" aria-label="Candidatos de Google">
          {candidatos.map((c) => (
            <li key={c.placeId} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                <p className="text-gray-500">{c.direccion}</p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1">
                    Abrir en Google Maps para revisar <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={() => confirmar({ placeId: c.placeId, estado: 'vinculado' })}
                className={`${boton} bg-brand-600 hover:bg-brand-700 text-white`}
                aria-label={`Es este: ${c.nombre}, ${c.direccion}`}
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" /> Es este
              </button>
            </li>
          ))}
        </ul>
      )}

      {valor.estado === 'no_vinculado' && (
        <button type="button" disabled={guardando} onClick={() => confirmar({ placeId: null, estado: 'sin_ficha' })} className={`${boton} bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800`}>
          <X className="w-3.5 h-3.5" aria-hidden="true" /> Este comercio no tiene ficha en Google
        </button>
      )}

      {valor.estado === 'sin_ficha' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={abrirCrear} aria-expanded={verCrear} className={`${boton} bg-amber-500 hover:bg-amber-600 text-gray-900`}>
              <Store className="w-3.5 h-3.5" aria-hidden="true" /> Crear ficha en Google
            </button>
            <button type="button" disabled={guardando} onClick={() => confirmar({ placeId: null, estado: 'no_vinculado' })} className={`${boton} text-gray-600 dark:text-gray-300 hover:underline`}>
              Ya tiene ficha: buscarla
            </button>
          </div>
          {verCrear && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                La ficha la crea y la verifica el dueño del comercio con su cuenta de Google. NOGOMAP no puede crearla por él.
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-gray-700 dark:text-gray-300">
                {PASOS_CREAR_FICHA.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              <pre className="whitespace-pre-wrap p-2 rounded-lg bg-white dark:bg-gray-900 border dark:border-gray-700 font-mono text-[11px]">{datosParaCopiar}</pre>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(datosParaCopiar);
                      setCopiado(true);
                    } catch {
                      setCopiado(false);
                    }
                  }}
                  className={`${boton} bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-800`}
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {copiado ? 'Copiado' : 'Copiar datos'}
                </button>
                <a href={URL_CREAR_FICHA} target="_blank" rel="noopener noreferrer" className={`${boton} bg-gray-900 text-white dark:bg-white dark:text-gray-900`}>
                  Abrir Google Business Profile <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
