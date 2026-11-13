import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { OfertaLaboral, PostulacionCV } from '@/types/database.types';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { formatDate } from '@/lib/formatters';
import {
  Briefcase,
  PlusCircle,
  Trash2,
  FileText,
  Download,
  MessageCircle,
  Phone,
  Users,
  PauseCircle,
  PlayCircle,
  X,
} from 'lucide-react';

interface Props {
  comercioId: string;
  comercioNombre: string;
}

export const GestorEmpleosComercio: React.FC<Props> = ({ comercioId, comercioNombre }) => {
  const [ofertas, setOfertas] = useState<OfertaLaboral[]>([]);
  const [postulaciones, setPostulaciones] = useState<PostulacionCV[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal nueva búsqueda
  const [modalAbierto, setModalAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    const [{ data: dataOfertas }, { data: dataPostulaciones }] = await Promise.all([
      supabase
        .from('ofertas_laborales')
        .select('*')
        .eq('comercio_id', comercioId)
        .order('created_at', { ascending: false }),
      supabase
        .from('postulaciones_cv')
        .select('*')
        .eq('comercio_id', comercioId)
        .order('created_at', { ascending: false }),
    ]);

    if (dataOfertas) setOfertas(dataOfertas as OfertaLaboral[]);
    if (dataPostulaciones) setPostulaciones(dataPostulaciones as PostulacionCV[]);
    setCargando(false);
  };

  useEffect(() => {
    if (comercioId) void cargarDatos();
  }, [comercioId]);

  const handleCrearOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) return;
    setGuardando(true);

    const { error } = await supabase.from('ofertas_laborales').insert({
      comercio_id: comercioId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      activa: true,
    });

    setGuardando(false);

    if (error) {
      console.error(error);
      alert('No se pudo publicar la búsqueda laboral. Revisá tu conexión.');
      return;
    }

    setTitulo('');
    setDescripcion('');
    setModalAbierto(false);
    void cargarDatos();
  };

  const handleToggleActiva = async (oferta: OfertaLaboral) => {
    const { error } = await supabase
      .from('ofertas_laborales')
      .update({ activa: !oferta.activa })
      .eq('id', oferta.id);

    if (error) {
      alert('No se pudo cambiar el estado de la búsqueda.');
      return;
    }
    void cargarDatos();
  };

  const handleEliminarOferta = async (oferta: OfertaLaboral) => {
    if (!confirm(`¿Eliminar la búsqueda "${oferta.titulo}" y todos sus currículums recibidos?`)) return;

    // Borrar primero archivos físicos de Storage si existen
    const cvsDeOferta = postulaciones.filter((p) => p.oferta_id === oferta.id);
    if (cvsDeOferta.length > 0) {
      await supabase.storage
        .from('curriculums')
        .remove(cvsDeOferta.map((p) => p.archivo_path));
    }

    const { error } = await supabase.from('ofertas_laborales').delete().eq('id', oferta.id);
    if (error) {
      alert('No se pudo eliminar la búsqueda.');
      return;
    }
    void cargarDatos();
  };

  const handleVerODescargarCV = async (postulacion: PostulacionCV) => {
    setDescargandoId(postulacion.id);
    try {
      // Genera una URL firmada temporal válida por 5 minutos (solo accesible para el dueño del comercio)
      const { data, error } = await supabase.storage
        .from('curriculums')
        .createSignedUrl(postulacion.archivo_path, 300);

      if (error || !data?.signedUrl) throw error || new Error('No se pudo abrir el archivo');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      alert('No se pudo abrir el currículum. Probá de nuevo.');
    } finally {
      setDescargandoId(null);
    }
  };

  const handleEliminarPostulacion = async (postulacion: PostulacionCV) => {
    if (!confirm(`¿Eliminar el CV de ${postulacion.nombre_postulante}?`)) return;
    await supabase.storage.from('curriculums').remove([postulacion.archivo_path]);
    await supabase.from('postulaciones_cv').delete().eq('id', postulacion.id);
    void cargarDatos();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-700 pb-4">
        <div>
          <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" /> Ofertas Laborales & CVs Recibidos
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Publicá búsquedas de personal y recibí currículums de forma privada en tu panel.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" /> Publicar Búsqueda Laboral
        </button>
      </div>

      {cargando ? (
        <p className="text-xs text-gray-500 animate-pulse py-4">Cargando búsquedas laborales...</p>
      ) : ofertas.length === 0 ? (
        <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
          <p className="text-sm font-semibold">No tenés búsquedas laborales publicadas.</p>
          <p className="text-xs">Publicá un puesto y recibí CVs sin que los postulantes tengan que registrarse.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {ofertas.map((oferta) => {
            const cvs = postulaciones.filter((p) => p.oferta_id === oferta.id);

            return (
              <div
                key={oferta.id}
                className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4"
              >
                {/* Cabecera de la búsqueda */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          oferta.activa
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {oferta.activa ? 'Activa en el portal' : 'Pausada'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Publicada el {formatDate(oferta.created_at)}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                      {oferta.titulo}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                      {oferta.descripcion}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleActiva(oferta)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 inline-flex items-center gap-1"
                    >
                      {oferta.activa ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5 text-amber-500" /> Pausar
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 text-emerald-500" /> Reactivar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleEliminarOferta(oferta)}
                      className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      title="Eliminar búsqueda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CVs Recibidos para esta búsqueda */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2.5">
                  <h5 className="text-xs font-extrabold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Currículums recibidos ({cvs.length})
                  </h5>

                  {cvs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Todavía no se postuló nadie a esta búsqueda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {cvs.map((cv) => {
                        const wp = normalizeWhatsAppNumber(cv.celular);
                        const mensajeWp = `Hola ${cv.nombre_postulante}! Te escribimos desde *${comercioNombre}* por tu postulación para *${oferta.titulo}* en NOGOYORK.`;
                        const urlWp = buildWhatsAppUrl(wp.isValid ? wp.normalized : cv.celular, mensajeWp);

                        return (
                          <div
                            key={cv.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {cv.nombre_postulante}
                              </p>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" /> {cv.celular}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                                <FileText className="w-3 h-3 shrink-0" /> {cv.archivo_nombre}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={descargandoId === cv.id}
                                onClick={() => void handleVerODescargarCV(cv)}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition"
                                title="Ver o descargar CV"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {descargandoId === cv.id ? '...' : 'Ver CV'}
                              </button>

                              <a
                                href={urlWp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                                title="Contactar por WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              <button
                                type="button"
                                onClick={() => void handleEliminarPostulacion(cv)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                                title="Borrar postulación"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR BÚSQUEDA LABORAL (UN SOLO CUADRO DE TEXTO) */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" /> Nueva Búsqueda Laboral
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearOferta} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Puesto o rubro buscado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Se busca Cajero/a - Atención al Público"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Detalle completo (horarios, tareas, requisitos) *
                </label>
                <textarea
                  required
                  rows={7}
                  placeholder={`Describí todo en este cuadro. Por ejemplo:\n\n• Horarios: Lunes a Sábado de 8:00 a 12:30 y de 16:30 a 20:30 hs.\n• Tareas: Atención en caja, reposición de mercadería y control de stock.\n• Requisitos: Buena presencia, experiencia previa comprobable y disponibilidad horaria.`}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs leading-relaxed dark:bg-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {guardando ? 'Publicando...' : 'Publicar Búsqueda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};