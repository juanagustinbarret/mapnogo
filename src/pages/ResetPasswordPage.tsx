import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMensaje({ tipo: 'error', texto: 'Enlace inválido o sin token de autorización.' });
      return;
    }

    setLoading(true);
    setMensaje(null);

    const { error } = await supabase.rpc('admin_cambiar_password_comercio', {
      p_nueva_password: password,
      p_token: token,
    });

    setLoading(false);

    if (error) {
      setMensaje({
        tipo: 'error',
        texto: error.message || 'Error al restablecer la contraseña.',
      });
    } else {
      setMensaje({
        tipo: 'exito',
        texto: '¡Contraseña restablecida con éxito! Redirigiendo al inicio de sesión...',
      });
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md max-w-md w-full text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-800">Enlace No Válido</h2>
          <p className="text-xs text-gray-600">
            Falta el token de autorización o el enlace está incompleto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl max-w-md w-full space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <KeyRound className="w-6 h-6 text-brand-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Establecer Nueva Contraseña</h2>
        </div>

        {mensaje && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              mensaje.tipo === 'exito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {mensaje.tipo === 'exito' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">
              Nueva Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition"
          >
            {loading ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};
