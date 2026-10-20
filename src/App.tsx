import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminSolicitudesPasswordPage } from '@/pages/admin/AdminSolicitudesPasswordPage';
import { HomeExplorerPage } from '@/pages/HomeExplorerPage';
import { CommerceDetailPage } from '@/pages/CommerceDetailPage';
import { MerchantLoginPage } from '@/pages/MerchantLoginPage';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { diferida } from '@/components/CargaDiferida';
import { PromotionsPage } from '@/pages/PromotionsPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

// Paneles del comercio y del admin: se cargan recién al entrar (no van en el
// paquete inicial que descarga cada visitante del mapa)
const MerchantDashboardPage = diferida(() => import('@/pages/MerchantDashboardPage'), 'MerchantDashboardPage');
const MerchantProfilePage = diferida(() => import('@/pages/MerchantProfilePage'), 'MerchantProfilePage');
const AdminDashboardPage = diferida(() => import('@/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminNewCommercePage = diferida(() => import('@/pages/AdminNewCommercePage'), 'AdminNewCommercePage');
const AdminPaymentsPage = diferida(() => import('@/pages/AdminPaymentsPage'), 'AdminPaymentsPage');
const AdminExpirationsPage = diferida(() => import('@/pages/AdminExpirationsPage'), 'AdminExpirationsPage');
const AdminSettingsPage = diferida(() => import('@/pages/AdminSettingsPage'), 'AdminSettingsPage');
const TerminosPage = diferida(() => import('@/pages/TerminosPage'), 'TerminosPage');
const PrivacidadPage = diferida(() => import('@/pages/PrivacidadPage'), 'PrivacidadPage');

export const App: React.FC = () => {
  // Registrar el Service Worker al montar la aplicación
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker de NOGOMAP registrado con éxito:', reg.scope);
        })
        .catch((err) => {
          console.error('Error al registrar el Service Worker:', err);
        });
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col justify-between bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div>
              <Navbar />
              <Routes>
                {/* Rutas Públicas */}
                <Route path="/" element={<HomeExplorerPage />} />
                <Route path="/comercio/:slug" element={<CommerceDetailPage />} />
                <Route path="/promociones" element={<PromotionsPage />} />
                <Route path="/terminos" element={<TerminosPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                {/* Logins Separados */}
                <Route path="/login" element={<MerchantLoginPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* Rutas Comerciante */}
                <Route
                  path="/panel"
                  element={
                    <ProtectedRoute allowedRoles={['comerciante', 'admin']}>
                      <MerchantDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/panel/perfil"
                  element={
                    <ProtectedRoute allowedRoles={['comerciante', 'admin']}>
                      <MerchantProfilePage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Rutas Administrador */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/comercios/nuevo"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminNewCommercePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/pagos"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminPaymentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/vencimientos"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminExpirationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/solicitudes-password" element={<AdminSolicitudesPasswordPage />} 
                />
                <Route
                  path="/admin/configuracion"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminSettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;