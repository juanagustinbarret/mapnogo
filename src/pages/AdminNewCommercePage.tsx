import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Building, User } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { Rubro } from '@/types/database.types';
import { mensajeError } from '@/lib/formatters';
import { geocodificarDireccion } from '@/lib/geocoding';
import { NOGOYA_CENTER } from '@/lib/distance';
import { crearComercioConUsuario } from '@/services/comercios';
import { listarRubrosActivos } from '@/services/configuracion';

const FORM_INICIAL = {
  email: '',
  password: '',
  nombreComerciante: '',
  nombreComercio: '',
  rubro_id: '',
  descripcion_corta: '',
  direccion: '',
  whatsapp: '',
  telefono: '',
  email_comercial: '',
};

type CampoForm = keyof typeof FORM_INICIAL;

const campoClase = 'w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm';

export const AdminNewCommercePage: React.FC = () => {
  const navigate = useNavigate();
  const { avisar, confirmar } = useToast();
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);

  useEffect(() => {
    listarRubrosActivos()
      .then((data) => {
        setRubros(data);
        if (data.length > 0) setForm((prev) => ({ ...prev, rubro_id: prev.rubro_id || data[0].id }));
      })
      .catch((e) => setError(`No se pudieron cargar los rubros: ${mensajeError(e)}`));
  }, []);

  const campo = (clave: CampoForm) => ({
    id: `nuevo-${clave}`,
    value: form[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [clave]: e.target.value }),
    className: campoClase,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Se ubica la dirección una sola vez, al dar de alta
      const coords = await geocodificarDireccion(form.direccion);
      if (!coords) {
        const seguir = await confirmar({
          titulo: 'Dirección no encontrada',
          mensaje:
            'No pudimos ubicar la dirección en el mapa. El comercio no se verá en el mapa hasta que se corrija la dirección o se use "Ubicar en el mapa". ¿Crearlo igual?',
          textoConfirmar: 'Crear igual',
        });
        if (!seguir) return;
      }

      const comercio = await crearComercioConUsuario({
        email: form.email.trim(),
        password: form.password,
        nombreComerciante: form.nombreComerciante.trim(),
        datosComercio: {
          nombre: form.nombreComercio.trim(),
          rubro_id: form.rubro_id,
          descripcion_corta: form.descripcion_corta.trim(),
          direccion: form.direccion.trim(),
          whatsapp: form.whatsapp.trim(),
          telefono: form.telefono.trim() || null,
          email_comercial: form.email_comercial.trim() || null,
          latitud: coords?.lat ?? NOGOYA_CENTER.lat,
          longitud: coords?.lng ?? NOGOYA_CENTER.lng,
        },
      });

      avisar(`${comercio.nombre} fue dado de alta. El comerciante ya puede ingresar con su email.`, 'exito');
      navigate('/admin');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-brand-600" aria-hidden="true" /> Dar de alta un comercio
        </h2>

        {error && (
          <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" aria-hidden="true" /> Acceso del comerciante
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="nuevo-nombreComerciante" className="block text-xs font-semibold mb-1">Nombre del propietario</label>
                <input type="text" required {...campo('nombreComerciante')} />
              </div>
              <div>
                <label htmlFor="nuevo-email" className="block text-xs font-semibold mb-1">Email para ingresar</label>
                <input type="email" required autoComplete="off" {...campo('email')} />
                <p className="text-[11px] text-gray-400 mt-1">No se muestra en la ficha pública.</p>
              </div>
              <div>
                <label htmlFor="nuevo-password" className="block text-xs font-semibold mb-1">Contraseña inicial</label>
                <input type="password" required minLength={8} autoComplete="new-password" {...campo('password')} />
                <p className="text-[11px] text-gray-400 mt-1">Mínimo 8 caracteres.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-600" aria-hidden="true" /> Datos del comercio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nuevo-nombreComercio" className="block text-xs font-semibold mb-1">Nombre del comercio</label>
                <input type="text" required {...campo('nombreComercio')} />
              </div>
              <div>
                <label htmlFor="nuevo-rubro_id" className="block text-xs font-semibold mb-1">Rubro</label>
                <select required {...campo('rubro_id')}>
                  {rubros.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="nuevo-descripcion_corta" className="block text-xs font-semibold mb-1">Descripción corta</label>
                <input type="text" required maxLength={160} {...campo('descripcion_corta')} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="nuevo-direccion" className="block text-xs font-semibold mb-1">Dirección</label>
                <input type="text" required placeholder="Ej: San Lorenzo 600" {...campo('direccion')} />
              </div>
              <div>
                <label htmlFor="nuevo-whatsapp" className="block text-xs font-semibold mb-1">WhatsApp</label>
                <input type="tel" required placeholder="Ej: 3435 123456" {...campo('whatsapp')} />
              </div>
              <div>
                <label htmlFor="nuevo-telefono" className="block text-xs font-semibold mb-1">Teléfono fijo (opcional)</label>
                <input type="tel" {...campo('telefono')} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="nuevo-email_comercial" className="block text-xs font-semibold mb-1">Email público del comercio (opcional)</label>
                <input type="email" {...campo('email_comercial')} />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={loading || !form.rubro_id}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            <Save className="w-4 h-4" aria-hidden="true" /> {loading ? 'Creando...' : 'Crear comercio y acceso'}
          </button>
        </form>
      </div>
    </div>
  );
};
