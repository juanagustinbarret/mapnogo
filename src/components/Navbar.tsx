import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Sun,
  Moon,
  LogOut,
  Store,
  Menu,
  X,
  PlusCircle,
  LayoutDashboard,
  Home,
  Tag,
  AlertTriangle
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmExitTarget, setConfirmExitTarget] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/admin');

  const handleNavigation = (targetPath: string) => {
    setMobileMenuOpen(false);
    
    // Si estamos en el área de administración y queremos salir al mapa público, pedir confirmación
    if (isAdminArea && !targetPath.startsWith('/admin')) {
      setConfirmExitTarget(targetPath);
    } else {
      navigate(targetPath);
    }
  };

  const confirmAndNavigate = () => {
    if (confirmExitTarget) {
      const target = confirmExitTarget;
      setConfirmExitTarget(null);
      navigate(target);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* LOGO NOGOYÁ CERCA */}
          <button onClick={() => handleNavigation('/')} className="flex items-center gap-2 text-brand-600 font-bold text-xl">
            <MapPin className="w-6 h-6 text-brand-500 fill-brand-100" />
            <span>Nogoyá <span className="text-gray-900 dark:text-white">Cerca</span></span>
          </button>

          {/* NAVEGACIÓN ESCRITORIO */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => handleNavigation('/')} className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-brand-600 flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Mapa Público
            </button>
            <button onClick={() => handleNavigation('/promociones')} className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg">
              <Tag className="w-3.5 h-3.5" /> Ofertas & Promos
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Cambiar tema"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </button>

            {/* BARRA SOLO CUANDO EL ADMIN O COMERCIANTE ESTÁ AUTENTICADO */}
            {user && (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                {profile?.rol === 'admin' && (
                  <>
                    <button
                      onClick={() => handleNavigation('/admin')}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-1"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-brand-600" /> Admin
                    </button>
                    <button
                      onClick={() => handleNavigation('/panel')}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center gap-1"
                    >
                      <Store className="w-3.5 h-3.5" /> Panel Negocio
                    </button>
                    <button
                      onClick={() => handleNavigation('/admin/comercios/nuevo')}
                      className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 dark:bg-brand-950/40 rounded-lg flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Nuevo Comercio
                    </button>
                  </>
                )}

                {profile?.rol === 'comerciante' && (
                  <button
                    onClick={() => handleNavigation('/panel')}
                    className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 rounded-lg flex items-center gap-1"
                  >
                    <Store className="w-3.5 h-3.5" /> Mi Negocio
                  </button>
                )}

                <button onClick={handleSignOut} className="text-gray-500 hover:text-red-600 p-2 rounded-lg" title="Cerrar Sesión">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* BOTÓN MÓVIL */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={toggleTheme} className="p-2 text-gray-500">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-700 dark:text-gray-200">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* DESPLEGABLE MÓVIL */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-b px-4 pt-2 pb-6 space-y-4">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Explorar</div>
              <button onClick={() => handleNavigation('/')} className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium">
                <Home className="w-4 h-4 text-brand-600" /> Mapa Público
              </button>
              <button onClick={() => handleNavigation('/promociones')} className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium text-amber-600">
                <Tag className="w-4 h-4" /> Ofertas & Promociones
              </button>
            </div>

            {user && profile?.rol === 'admin' && (
              <div className="space-y-1 pt-2 border-t">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Administración</div>
                <button onClick={() => handleNavigation('/admin')} className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium">
                  <LayoutDashboard className="w-4 h-4 text-brand-600" /> Dashboard & Métricas
                </button>
                <button onClick={() => handleNavigation('/panel')} className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium text-blue-600">
                  <Store className="w-4 h-4" /> Ir a Panel de Negocio
                </button>
              </div>
            )}

            {user && (
              <div className="pt-3 border-t">
                <button onClick={handleSignOut} className="w-full py-2 bg-red-50 text-red-600 font-semibold text-sm rounded-lg flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* MODAL DE CONFIRMACIÓN PARA SALIR DEL ADMIN */}
      {confirmExitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Salir del Panel de Administración
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Estás seguro de que deseas salir del área de administración e ir al sitio público?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmExitTarget(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                Permanecer en Admin
              </button>
              <button
                onClick={confirmAndNavigate}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};