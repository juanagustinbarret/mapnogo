import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const emailParam = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

    try {
      if (emailParam) {
        // Ejecuta la función RPC que actualiza la clave del comercio directamente por email
        const { error: rpcErr } = await supabase.rpc('admin_cambiar_password_comercio', {
          email_target: emailParam.trim(),
          nueva_password: password.trim(),
        });

        if (rpcErr) throw rpcErr;
      } else {
        // Si entra por sesión tokenizada directa
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) throw updateErr;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError('Error al actualizar la contraseña: ' + (err.message || 'Ocurrió un error inesperado'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl w-fit mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Contraseña</h1>
          <p className="text-xs text-gray-500">
            {emailParam ? `Reestableciendo clave para: ${emailParam}` : 'Ingresá tu nueva clave para acceder al panel.'}
          </p>
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