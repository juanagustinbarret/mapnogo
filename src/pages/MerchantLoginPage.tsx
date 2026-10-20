import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { solicitarRecuperacionPassword } from '@/services/solicitarRecuperacion';
import { useNavigate } from 'react-router-dom';
import { Store, Lock, Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';

export const MerchantLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authErr) {
      console.error('[MapNogo login]', {
        message: authErr.message,
        status: authErr.status,
        code: authErr.code,
      });

      setError('Credenciales inválidas. Verificá tu correo y contraseña.');
      setLoading(false);
      return;
    }

    navigate('/panel');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Registrar la solicitud en solicitudes_recuperacion para el Administrador
      await solicitarRecuperacionPassword(email.trim());
      setSuccess('✅ Solicitud enviada correctamente a los administradores. En breve te habilitarán el acceso.');
    } catch (resetErr: any) {
      console.error('[MapNogo reset password error]', resetErr);
      setError(resetErr.message || 'No se pudo registrar la solicitud de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg max-w-md w-full space-y-6">
        
        {/* CABECERA */}
        <div className="text-center space-y-2">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl w-fit mx-auto">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isResetMode ? 'Recuperar Contraseña' : 'Ingreso a Panel Comercio'}
          </h1>
          <p className="text-xs text-gray-500">
            {isResetMode
              ? 'Ingresá tu correo comercial para enviar la solicitud de cambio de clave al administrador.'
              : 'Accedé a la gestión de tu negocio, horarios y ofertas.'}
          </p>
        </div>

        {/* ERRORES Y ÉXITO */}
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs rounded-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
            <span>{success}</span>
          </div>
        )}

        {/* MODO LOGIN */}
        {!isResetMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Correo Electrónico Comercial</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                  placeholder="comercio@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold">Contraseña</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-xs text-brand-600 hover:underline font-semibold"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
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
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Acceder a mi Panel'}
            </button>
          </form>
        ) : (
          /* MODO RECUPERAR CONTRASEÑA */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Correo Electrónico Registrado</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                  placeholder="comercio@ejemplo.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Enviando solicitud...' : 'Enviar Solicitud al Administrador'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setError('');
                setSuccess('');
              }}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al Ingreso
            </button>
          </form>
        )}
      </div>
    </div>
  );
};