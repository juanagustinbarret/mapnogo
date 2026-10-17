import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'comerciante')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-500 animate-pulse">Verificando credenciales de seguridad...</p>
      </div>
    );
  }

  // Si no hay usuario logueado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si se especifican roles y no hay perfil cargado o el rol en base de datos no coincide
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.rol;

    if (!userRole || !allowedRoles.includes(userRole as any)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};