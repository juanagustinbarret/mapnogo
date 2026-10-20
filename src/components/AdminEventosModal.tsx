import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Plus, Trash2, Clock, X, Eye } from 'lucide-react';
import { hoyArgentina } from '@/lib/fechasArgentina';

interface Evento {
  id: string;
  comercio_id?: string | null;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  ubicacion_texto?: string | null;
  imagen_url?: string | null;
  mostrar_desde?: string | null;
  mostrar_hasta?: string | null;
  activo: boolean;
}

export const AdminEventosModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);

  // Datos del Evento
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEvento, setFechaEvento] = useState(hoyArgentina());
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [ubicacionTexto, setUbicacionTexto] = useState('');

  // Rango de Publicación / Visibilidad en Mapa
  const [mostrarDesde, setMostrarDesde] = useState(`${hoyArgentina()}T00:00`);
  const [mostrarHasta, setMostrarHasta] = useState(`${hoyArgentina()}T23:59`);

  const cargarEventos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setEventos(data as Evento[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) cargarEventos();
  }, [isOpen]);

  const handleCrearEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    const { error } = await supabase.from('eventos').insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha_evento: fechaEvento,
      hora_inicio: horaInicio.trim() || null,
      hora_fin: horaFin.trim() || null,
      ubicacion_texto: ubicacionTexto.trim() || null,
      mostrar_desde: mostrarDesde ? new Date(mostrarDesde).toISOString() : null,
      mostrar_hasta: mostrarHasta ? new Date(mostrarHasta).toISOString() : null,
      activo: true,
    });

    if (error) {
      alert('Error al crear el evento: ' + error.message);
    } else {
      setTitulo('');
      setDescripcion('');
      setHoraInicio('');
      setHoraFin('');
      setUbicacionTexto('');
      cargarEventos();
    }
  };

  const handleEliminarEvento = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return;
    await supabase.from('eventos').delete().eq('id', id);
    cargarEventos();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Gestión de Eventos y Anuncios
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* FORMULARIO DE ALTA DE EVENTO */}
        <form onSubmit={handleCrearEvento} className="space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Publicar Nuevo Evento
          </h4>

          <div>
            <label className="block text-xs font-semibold mb-1">Título del Evento / Anuncio *</label>
            <input
              type="text"
              required
              placeholder="Ej: Fiesta del Agua"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Descripción corta</label>
            <textarea
              placeholder="Detalles del evento..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            />
          </div>

          {/* DATOS DEL EVENTO (FECHA Y HORARIOS) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Fecha Evento *</label>
              <input
                type="date"
                required
                value={fechaEvento}
                onChange={(e) => setFechaEvento(e.target.value)}
                className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Hora Inicio</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Hora Fin</label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Ubicación / Lugar (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Plaza Libertad / Peatonal"
              value={ubicacionTexto}
              onChange={(e) => setUbicacionTexto(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            />
          </div>

          {/* SECCIÓN VISIBILIDAD / PROGRAMACIÓN EN EL MAPA */}
          <div className="border-t dark:border-gray-800 pt-3 space-y-2">
            <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Rango de Publicación (Visibilidad en Banner)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">Mostrar Desde (Día y Hora)</label>
                <input
                  type="datetime-local"
                  required
                  value={mostrarDesde}
                  onChange={(e) => setMostrarDesde(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">Mostrar Hasta (Día y Hora)</label>
                <input
                  type="datetime-local"
                  required
                  value={mostrarHasta}
                  onChange={(e) => setMostrarHasta(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Guardar Evento
          </button>
        </form>

        {/* LISTA DE EVENTOS CREADOS */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Eventos Programados
          </h4>

          {loading ? (
            <p className="text-xs text-gray-500 text-center py-4">Cargando...</p>
          ) : eventos.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No hay eventos activos.</p>
          ) : (
            eventos.map((ev) => (
              <div
                key={ev.id}
                className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between gap-3"
              >
                <div>
                  <h5 className="font-bold text-sm text-gray-900 dark:text-white">{ev.titulo}</h5>
                  {ev.descripcion && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.descripcion}</p>
                  )}
                  <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Evento: {ev.fecha_evento} {ev.hora_inicio ? `(${ev.hora_inicio} a ${ev.hora_fin || '??'})` : ''}
                  </p>
                </div>

                <button
                  onClick={() => handleEliminarEvento(ev.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};