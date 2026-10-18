import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { HomeExplorerPage } from '@/pages/HomeExplorerPage';
import { CommerceDetailPage } from '@/pages/CommerceDetailPage';
import { MerchantLoginPage } from '@/pages/MerchantLoginPage';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { MerchantDashboardPage } from '@/pages/MerchantDashboardPage';
import { MerchantProfilePage } from '@/pages/MerchantProfilePage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminNewCommercePage } from '@/pages/AdminNewCommercePage';
import { AdminPaymentsPage } from '@/pages/AdminPaymentsPage';
import { AdminExpirationsPage } from '@/pages/AdminExpirationsPage';
import { AdminSettingsPage } from '@/pages/AdminSettingsPage';
import { PromotionsPage } from '@/pages/PromotionsPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

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