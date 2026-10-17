import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Actualiza directamente la clave del usuario autenticado vía token del mail
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg('Error al cambiar la contraseña: ' + error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login-comercio');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900/90 dark:bg-gray-800 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 rounded-2xl">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Establecer Nueva Contraseña</h1>
          <p className="text-xs text-slate-400">Ingresá tu nueva clave para acceder al panel comercial.</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/50 text-red-400 border border-red-800/50 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/50 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">¡Contraseña actualizada con éxito!</h3>
            <p className="text-xs text-emerald-300">Redirigiendo al panel de inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};