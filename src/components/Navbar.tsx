// src/components/Navbar.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogoNogoyork } from '@/components/LogoNogoyork';
import {
  Sun,
  Moon,
  LogOut,
  Store,
  Menu,
  X,
  LayoutDashboard,
  Home,
  Tag,
  Shield,
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
          
          {/* LOGO CON MARCA NOGO (VERDE) Y YORK (ROJO) */}
          <button
            onClick={() => handleNavigation('/')}
            className="flex items-center gap-2 text-xl font-black focus:outline-none"
            aria-label="NOGOYORK, ir al inicio"
          >
            <LogoNogoyork className="w-8 h-8 shrink-0" />
            <span className="font-extrabold text-xl tracking-tight">
              <span className="text-emerald-600 dark:text-emerald-500">NOGO</span>
              <span className="text-red-600 dark:text-red-500">YORK</span>
            </span>
          </button>

          {/* NAVEGACIÓN ESCRITORIO */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => handleNavigation('/')}
              className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-brand-600 flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" /> Mapa Público
            </button>

            <button
              onClick={() => handleNavigation('/promociones')}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg"
            >
              <Tag className="w-3.5 h-3.5" /> Ofertas & Promos
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Cambiar tema claro/oscuro"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </button>

            {/* BOTONES DE PANEL COMERCIAL Y ADMIN */}
            {user ? (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                {profile?.rol === 'admin' ? (
                  <>
                    <button
                      onClick={() => handleNavigation('/admin')}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl flex items-center gap-1"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-brand-600" /> Admin
                    </button>
                    <button
                      onClick={() => handleNavigation('/panel')}
                      className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center gap-1"
                    >
                      <Store className="w-3.5 h-3.5" /> Panel Negocio
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation('/panel')}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl flex items-center gap-1 shadow-sm"
                  >
                    <Store className="w-3.5 h-3.5" /> Mi Negocio
                  </button>
                )}

                <button
                  onClick={handleSignOut}
                  className="text-gray-500 hover:text-red-600 p-2 rounded-xl"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <Store className="w-3.5 h-3.5" /> Panel Comercio
                </Link>
                <Link
                  to="/admin/login"
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition"
                >
                  <Shield className="w-3.5 h-3.5 text-brand-600" /> Admin
                </Link>
              </div>
            )}
          </div>

          {/* MENÚ MÓVIL */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={toggleTheme} className="p-2 text-gray-500" aria-label="Cambiar tema">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 dark:text-gray-200"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* DESPLEGABLE MÓVIL */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-b px-4 pt-2 pb-6 space-y-3">
            <button
              onClick={() => handleNavigation('/')}
              className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <Home className="w-4 h-4 text-brand-600" /> Mapa Público
            </button>
            <button
              onClick={() => handleNavigation('/promociones')}
              className="w-full text-left flex items-center gap-2 py-2 px-2 text-sm font-medium text-amber-600"
            >
              <Tag className="w-4 h-4" /> Ofertas & Promociones
            </button>

            <div className="pt-2 border-t dark:border-gray-800 space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2 bg-brand-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" /> Panel de mi Comercio
              </Link>
              <Link
                to="/admin/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 text-brand-600" /> Acceso Administrador
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* MODAL CONFIRMACIÓN AL SALIR DEL ADMIN */}
      {confirmExitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Salir del Panel Admin
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Deseás salir de la zona de administración para ir al sitio público?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmExitTarget(null)}
                className="px-4 py-2 border dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Permanecer
              </button>
              <button
                onClick={confirmAndNavigate}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold"
              >
                Ir al Sitio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};