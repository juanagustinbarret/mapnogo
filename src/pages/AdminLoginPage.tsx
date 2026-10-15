import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, UserPlus } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('allendeveraagustin@gmail.com');
  const [password, setPassword] = useState('Vera159+');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Iniciar Sesión Normal
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setMensaje('Error al ingresar: ' + authErr.message);
      setLoading(false);
      return;
    }

    // Comprobar rol en la tabla profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', data.user.id)
      .maybeSingle();

    const userRole = profile?.rol || data.user.user_metadata?.rol;

    if (userRole !== 'admin') {
      await supabase.auth.signOut();
      setMensaje('Acceso denegado: Esta cuenta no es administradora.');
      setLoading(false);
      return;
    }

    navigate('/admin');
  };

  // 2. Botón Mágico: Crear Cuenta Admin directamente con el SDK oficial
  const handleCrearAdminMagico = async () => {
    setLoading(true);
    setMensaje('');

    // A. Registrar el usuario en Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: 'Agustín Allende Vera',
          rol: 'admin',
        },
      },
    });

    if (error) {
      setMensaje('Error al crear usuario: ' + error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // B. Asegurar la fila en public.profiles con rol admin
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        nombre: 'Agustín Allende Vera',
        rol: 'admin',
      });

      if (profErr) {
        setMensaje('Usuario creado en Auth, pero error en perfil: ' + profErr.message);
      } else {
        setMensaje('¡Usuario Administrador CREADO con éxito! Ahora hacé clic en "Acceder al Admin".');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl w-fit mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel Administrador</h1>
          <p className="text-xs text-gray-500">Ingreso exclusivo para la administración de Nogoyá Cerca.</p>
        </div>

        {mensaje && (
          <div className={`p-3 text-xs rounded-xl font-semibold ${
            mensaje.includes('¡Usuario Administrador CREADO') 
              ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' 
              : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}>
            {mensaje}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Email Administrador</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm transition"
          >
            {loading ? 'Verificando...' : 'Acceder al Admin'}
          </button>
        </form>

        <div className="pt-2 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={handleCrearAdminMagico}
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <UserPlus className="w-4 h-4" /> ⚡ Forzar Registro de esta Cuenta Admin
          </button>
        </div>
      </div>
    </div>
  );
};