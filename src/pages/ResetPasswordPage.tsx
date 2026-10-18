import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    // 1. Escuchar eventos de Supabase Auth por si se procesa el evento PASSWORD_RECOVERY del hash
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
    });

    // 2. Comprobar si ya existe una sesión activa traída por el enlace del correo
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasRecoverySession(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    // Actualiza la contraseña en la base de datos de Supabase para el usuario validado
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError('Error al actualizar la contraseña: ' + updateErr.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl w-fit mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Contraseña</h1>
          <p className="text-xs text-gray-500">Ingresá tu nueva clave para acceder al panel comercial.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">¡Contraseña actualizada con éxito!</h3>
            <p className="text-xs text-green-700 dark:text-green-300">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {!hasRecoverySession && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Validando token de seguridad... Podés escribir tu nueva clave a continuación.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">Nueva Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-md"
            >
              {loading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};