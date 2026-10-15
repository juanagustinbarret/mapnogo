import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types/database.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  // Adónde mandar a quien no inició sesión
  loginPath?: string;
}

export const PantallaCargando: React.FC<{ mensaje?: string }> = ({ mensaje = 'Cargando...' }) => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <p className="text-sm font-semibold text-gray-500 animate-pulse" role="status">
      {mensaje}
    </p>
  </div>
);

// Protección solo de la interfaz: los datos los protegen las reglas RLS de la base.
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, loginPath = '/login' }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <PantallaCargando mensaje="Verificando credenciales..." />;
  }

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!profile || profile.estado !== 'activo' || !allowedRoles.includes(profile.rol)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
