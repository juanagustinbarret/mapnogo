import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Store, Clock, Plus, Trash2, ArrowLeft, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Comercio } from '@/types/database.types';
import { formatHora, mensajeError } from '@/lib/formatters';
import { geocodificarDireccion } from '@/lib/geocoding';
import { actualizarComercio, obtenerComercioDelUsuario } from '@/services/comercios';
import {
  DIAS_SEMANA,
  MAX_TURNOS_POR_DIA,
  TurnoEditable,
  guardarHorarios,
  listarHorarios,
  validarTurnos,
} from '@/services/horarios';

interface FormularioComercio {
  whatsapp: string;
  telefono: string;
  direccion: string;
  descripcion_corta: string;
  email_comercial: string;
  google_place_id: string;
}

// Cada turno lleva una clave local para poder editarlo y borrarlo antes de guardar
type TurnoLocal = TurnoEditable & { clave: number };

const campoClase = 'w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700';

export const MerchantProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { avisar } = useToast();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [form, setForm] = useState<FormularioComercio | null>(null);
  const [turnos, setTurnos] = useState<TurnoLocal[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin_comercio' | 'error'>('cargando');
  const [guardando, setGuardando] = useState(false);
  const [siguienteClave, setSiguienteClave] = useState(1);

  useEffect(() => {
    if (!user) return;
    const cargar = async () => {
      try {
        const c = await obtenerComercioDelUsuario(user.id);
        if (!c || c.eliminado_en) {
          setEstado('sin_comercio');
          return;
        }
        const hs = await listarHorarios(c.id);
        setComercio(c);
        setForm({
          whatsapp: c.whatsapp ?? '',
          telefono: c.telefono ?? '',
          direccion: c.direccion ?? '',
          descripcion_corta: c.descripcion_corta ?? '',
          email_comercial: c.email_comercial ?? '',
          google_place_id: c.google_place_id ?? '',
        });
        setTurnos(
          hs.map((h, i) => ({
            clave: i + 1,
            id: h.id,
            dia_semana: h.dia_semana,
            hora_apertura: formatHora(h.hora_apertura),
            hora_cierre: formatHora(h.hora_cierre),
          })),
        );
        setSiguienteClave(hs.length + 1);
        setEstado('listo');
      } catch (e) {
        console.error(e);
        setEstado('error');
      }
    };
    void cargar();
  }, [user]);

  const agregarTurno = (dia: number) => {
    if (turnos.filter((t) => t.dia_semana === dia).length >= MAX_TURNOS_POR_DIA) return;
    setTurnos([...turnos, { clave: siguienteClave, dia_semana: dia, hora_apertura: '08:00', hora_cierre: '12:00' }]);
    setSiguienteClave(siguienteClave + 1);
  };

  const editarTurno = (clave: number, campo: 'hora_apertura' | 'hora_cierre', valor: string) =>
    setTurnos(turnos.map((t) => (t.clave === clave ? { ...t, [campo]: valor } : t)));

  const quitarTurno = (clave: number) => setTurnos(turnos.filter((t) => t.clave !== clave));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio || !form) return;

    const errorTurnos = validarTurnos(turnos);
    if (errorTurnos) {
      avisar(errorTurnos, 'error');
      return;
    }

    setGuardando(true);
    try {
      // Si cambió la dirección, se ubica una sola vez y se guardan las coordenadas
      let coordenadas: { latitud: number; longitud: number } | undefined;
      const direccionCambio = form.direccion.trim() !== comercio.direccion;
      if (direccionCambio) {
        const coords = await geocodificarDireccion(form.direccion);
        if (coords) {
          coordenadas = { latitud: coords.lat, longitud: coords.lng };
        } else {
          avisar('No encontramos la dirección en el mapa. Se guardó igual, pero el pin puede quedar desubicado.', 'info');
        }
      }

      await actualizarComercio(comercio.id, {
        whatsapp: form.whatsapp.trim(),
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim(),
        descripcion_corta: form.descripcion_corta.trim(),
        email_comercial: form.email_comercial.trim() || null,
        google_place_id: form.google_place_id.trim() || null,
        ...coordenadas,
      });
      await guardarHorarios(comercio.id, turnos);

      setComercio({ ...comercio, direccion: form.direccion.trim(), ...coordenadas });
      avisar('Datos y horarios guardados.', 'exito');
    } catch (err) {
      avisar(`No se pudo guardar: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (estado === 'cargando') return <div className="p-8 text-center text-gray-500">Cargando datos...</div>;

  if (estado !== 'listo' || !comercio || !form) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-300 font-semibold">
          {estado === 'sin_comercio'
            ? 'Tu cuenta no tiene un comercio vinculado para editar.'
            : 'No pudimos cargar tus datos. Probá de nuevo en un rato.'}
        </p>
        <Link to="/panel" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al panel
        </Link>
      </div>
    );
  }

  const campo = (clave: keyof FormularioComercio) => ({
    id: `campo-${clave}`,
    value: form[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [clave]: e.target.value }),
    className: campoClase,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/panel" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al panel comercial
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Store className="w-6 h-6 text-brand-600" aria-hidden="true" /> Datos de {comercio.nombre}
      </h1>

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="campo-nombre" className="block text-xs font-semibold mb-1">Nombre comercial</label>
            <input id="campo-nombre" type="text" disabled value={comercio.nombre} className={`${campoClase} bg-gray-100 text-gray-500`} />
            <p className="text-[11px] text-gray-400 mt-1">El nombre y el rubro los cambia el administrador.</p>
          </div>
          <div>
            <label htmlFor="campo-whatsapp" className="block text-xs font-semibold mb-1">WhatsApp de atención</label>
            <input type="tel" required {...campo('whatsapp')} placeholder="Ej: 3435 123456" />
          </div>
          <div>
            <label htmlFor="campo-telefono" className="block text-xs font-semibold mb-1">Teléfono fijo (opcional)</label>
            <input type="tel" {...campo('telefono')} />
          </div>
          <div>
            <label htmlFor="campo-email_comercial" className="block text-xs font-semibold mb-1">Email público (opcional)</label>
            <input type="email" {...campo('email_comercial')} placeholder="contacto@tucomercio.com" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="campo-direccion" className="block text-xs font-semibold mb-1">Dirección del local</label>
            <input type="text" required {...campo('direccion')} placeholder="Ej: San Lorenzo 600" />
            <p className="text-[11px] text-gray-400 mt-1">Al guardar, ubicamos la dirección en el mapa.</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="campo-descripcion_corta" className="block text-xs font-semibold mb-1">Descripción breve</label>
            <input type="text" required maxLength={160} {...campo('descripcion_corta')} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="campo-google_place_id" className="block text-xs font-semibold mb-1">Google Place ID (opcional)</label>
            <input type="text" {...campo('google_place_id')} placeholder="Ej: ChIJ..." />
            <p className="text-[11px] text-gray-400 mt-1">
              Con este dato, el QR de reseñas abre directo el formulario de Google. Se obtiene buscando tu comercio en el
              buscador de Place ID de Google Maps.
            </p>
          </div>
        </div>

        {/* HORARIOS */}
        <div className="pt-4 border-t dark:border-gray-700 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" aria-hidden="true" /> Horarios de atención
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">
              Hasta {MAX_TURNOS_POR_DIA} turnos por día. Si el cierre es antes que la apertura (por ejemplo 20:00 a 02:00), el turno
              sigue abierto después de medianoche.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DIAS_SEMANA.map((dia, idx) => {
              const delDia = turnos.filter((t) => t.dia_semana === idx);
              return (
                <div key={dia} role="group" aria-label={dia} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-700 dark:text-gray-300">{dia}</span>
                    <button
                      type="button"
                      onClick={() => agregarTurno(idx)}
                      disabled={delDia.length >= MAX_TURNOS_POR_DIA}
                      className="p-1 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 disabled:opacity-40 flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Añadir turno
                    </button>
                  </div>

                  {delDia.length === 0 && <p className="text-[11px] text-gray-400">Cerrado</p>}

                  <div className="space-y-1.5">
                    {delDia.map((t) => {
                      const nocturno = t.hora_cierre < t.hora_apertura;
                      return (
                        <div key={t.clave} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 border dark:border-gray-700 rounded-xl">
                          <input
                            type="time"
                            aria-label={`${dia}: hora de apertura`}
                            value={t.hora_apertura}
                            onChange={(e) => editarTurno(t.clave, 'hora_apertura', e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                          />
                          <span className="text-xs text-gray-400">a</span>
                          <input
                            type="time"
                            aria-label={`${dia}: hora de cierre`}
                            value={t.hora_cierre}
                            onChange={(e) => editarTurno(t.clave, 'hora_cierre', e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border text-xs rounded-lg px-2 py-1 dark:border-gray-700 font-mono"
                          />
                          {nocturno && (
                            <span title="Cierra después de medianoche" className="text-indigo-500">
                              <Moon className="w-3.5 h-3.5" aria-label="Cierra después de medianoche" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => quitarTurno(t.clave)}
                            className="text-red-500 hover:text-red-700 ml-auto p-1"
                            aria-label={`Quitar turno del ${dia}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          <Save className="w-4 h-4" aria-hidden="true" /> {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
};
