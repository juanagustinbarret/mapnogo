import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Iniciar sesión en Supabase Auth
    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !data.user) {
      setError('Credenciales inválidas. Verificá tu correo y contraseña.');
      setLoading(false);
      return;
    }

    // 2. Verificar el rol en la tabla 'profiles'
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', data.user.id)
      .maybeSingle();

    // Comprobar rol en la tabla 'profiles' O en los metadatos del usuario de Auth
    const userRole = profile?.rol || data.user.user_metadata?.rol;

    if (userRole !== 'admin') {
      await supabase.auth.signOut();
      setError('Acceso denegado: Esta cuenta no tiene permisos de administrador.');
      setLoading(false);
      return;
    }

    // 3. Acceso concedido
    navigate('/admin');
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

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold">
            {error}
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
                placeholder="admin@nogoyacerca.com"
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
                placeholder="••••••••"
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
      </div>
    </div>
  );
};