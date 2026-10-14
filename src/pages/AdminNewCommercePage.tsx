import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Rubro } from '@/types/database.types';
import { ArrowLeft, Save, Building, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const AdminNewCommercePage: React.FC = () => {
  const navigate = useNavigate();
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombreComerciante: '',
    nombreComercio: '',
    rubro_id: '',
    descripcion_corta: '',
    direccion: '',
    whatsapp: '',
    latitud: -32.3939,
    longitud: -59.7881,
  });

  useEffect(() => {
    supabase.from('rubros').select('*').eq('estado', true).then(({ data }) => {
      if (data && data.length > 0) {
        setRubros(data);
        setFormData((prev) => ({ ...prev, rubro_id: data[0].id }));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentAdminId = sessionData.session?.user?.id;

      if (!currentAdminId) throw new Error('Sesión de administrador no válida.');

      const slug = formData.nombreComercio
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      let propietarioIdFinal = currentAdminId;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { nombre: formData.nombreComerciante, rol: 'comerciante' },
        },
      });

      if (!authError && authData.user?.id) {
        propietarioIdFinal = authData.user.id;
      }

      const { data: comercioData, error: comercioError } = await supabase
        .from('comercios')
        .insert({
          nombre: formData.nombreComercio,
          slug,
          rubro_id: formData.rubro_id,
          descripcion_corta: formData.descripcion_corta,
          direccion: formData.direccion,
          whatsapp: formData.whatsapp,
          email_comercial: formData.email,
          latitud: formData.latitud,
          longitud: formData.longitud,
          propietario_id: propietarioIdFinal,
          aprobado: true,
          habilitado_admin: true,
          galeria_urls: [],
          servicios: [],
          medios_pago: [],
        })
        .select()
        .single();

      if (comercioError) throw new Error(comercioError.message);

      const proximoVencimiento = new Date();
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
      proximoVencimiento.setDate(10);

      await supabase.from('suscripciones').insert({
        comercio_id: comercioData.id,
        precio_acordado: 10000,
        estado: 'activa',
        proximo_vencimiento: proximoVencimiento.toISOString().split('T')[0],
      });

      navigate('/admin');
    } catch (err: any) {
      setError(`Error al guardar el negocio: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Volver al panel de administración
      </Link>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-brand-600" /> Dar de Alta Nuevo Comercio
        </h2>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b dark:border-gray-700 pb-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-4 h-4" /> Datos de Acceso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre Propietario</label>
                <input
                  type="text"
                  required
                  value={formData.nombreComerciante}
                  onChange={(e) => setFormData({ ...formData, nombreComerciante: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Building className="w-4 h-4" /> Ficha del Comercio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del Comercio</label>
                <input
                  type="text"
                  required
                  value={formData.nombreComercio}
                  onChange={(e) => setFormData({ ...formData, nombreComercio: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Rubro</label>
                <select
                  value={formData.rubro_id}
                  onChange={(e) => setFormData({ ...formData, rubro_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {rubros.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Descripción Corta</label>
                <input
                  type="text"
                  required
                  value={formData.descripcion_corta}
                  onChange={(e) => setFormData({ ...formData, descripcion_corta: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Dirección (Nogoyá)</label>
                <input
                  type="text"
                  required
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  placeholder="3435123456"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm transition"
          >
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Crear y Habilitar Comercio'}
          </button>
        </form>
      </div>
    </div>
  );
};