import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { QrFichaRedireccion, QrResenasRedireccion } from '@/pages/QrRedireccion';
import { AdminSolicitudesPasswordPage } from '@/pages/admin/AdminSolicitudesPasswordPage';
import { HomeExplorerPage } from '@/pages/HomeExplorerPage';
import { CommerceDetailPage } from '@/pages/CommerceDetailPage';
import { MerchantLoginPage } from '@/pages/MerchantLoginPage';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { diferida } from '@/components/CargaDiferida';
import { PromotionsPage } from '@/pages/PromotionsPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

const PanelComercio = diferida(() => import('@/pages/PanelComercio'), 'PanelComercio');
const AdminDashboardPage = diferida(() => import('@/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminNewCommercePage = diferida(() => import('@/pages/AdminNewCommercePage'), 'AdminNewCommercePage');
const AdminPaymentsPage = diferida(() => import('@/pages/AdminPaymentsPage'), 'AdminPaymentsPage');
const AdminExpirationsPage = diferida(() => import('@/pages/AdminExpirationsPage'), 'AdminExpirationsPage');
const AdminSettingsPage = diferida(() => import('@/pages/AdminSettingsPage'), 'AdminSettingsPage');
const AdminModeracionPage = diferida(() => import('@/pages/AdminModeracionPage'), 'AdminModeracionPage');
const TerminosPage = diferida(() => import('@/pages/TerminosPage'), 'TerminosPage');
const PrivacidadPage = diferida(() => import('@/pages/PrivacidadPage'), 'PrivacidadPage');
const BajaPage = diferida(() => import('@/pages/BajaPage'), 'BajaPage');

export const App: React.FC = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker de NOGOYORK registrado con éxito:', reg.scope);
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
                <Route path="/n/:slug/resenas" element={<QrResenasRedireccion />} />
                <Route path="/n/:slug" element={<QrFichaRedireccion />} />
                <Route path="/promociones" element={<PromotionsPage />} />
                <Route path="/favoritos" element={<FavoritesPage />} />
                <Route path="/terminos" element={<TerminosPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
                <Route path="/baja" element={<BajaPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Logins Separados */}
                <Route path="/login" element={<MerchantLoginPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* Rutas Comerciante */}
                {['/panel', '/panel/perfil'].map((ruta) => (
                  <Route
                    key={ruta}
                    path={ruta}
                    element={
                      <ProtectedRoute allowedRoles={['comerciante', 'admin']}>
                        <PanelComercio />
                      </ProtectedRoute>
                    }
                  />
                ))}
                
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
                  path="/admin/solicitudes-password"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminSolicitudesPasswordPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/moderacion"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminModeracionPage />
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