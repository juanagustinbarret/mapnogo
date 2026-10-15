import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PantallaCargando, ProtectedRoute } from '@/components/ProtectedRoute';

// Carga diferida por ruta: un visitante del mapa no descarga el panel de admin
const pagina = <T extends string>(cargar: () => Promise<Record<T, React.ComponentType>>, nombre: T) =>
  lazy(() => cargar().then((m) => ({ default: m[nombre] })));

const HomeExplorerPage = pagina(() => import('@/pages/HomeExplorerPage'), 'HomeExplorerPage');
const CommerceDetailPage = pagina(() => import('@/pages/CommerceDetailPage'), 'CommerceDetailPage');
const PromotionsPage = pagina(() => import('@/pages/PromotionsPage'), 'PromotionsPage');
const MerchantLoginPage = pagina(() => import('@/pages/MerchantLoginPage'), 'MerchantLoginPage');
const AdminLoginPage = pagina(() => import('@/pages/AdminLoginPage'), 'AdminLoginPage');
const MerchantDashboardPage = pagina(() => import('@/pages/MerchantDashboardPage'), 'MerchantDashboardPage');
const MerchantProfilePage = pagina(() => import('@/pages/MerchantProfilePage'), 'MerchantProfilePage');
const AdminLayout = pagina(() => import('@/components/AdminLayout'), 'AdminLayout');
const AdminDashboardPage = pagina(() => import('@/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminNewCommercePage = pagina(() => import('@/pages/AdminNewCommercePage'), 'AdminNewCommercePage');
const AdminPaymentsPage = pagina(() => import('@/pages/AdminPaymentsPage'), 'AdminPaymentsPage');
const AdminExpirationsPage = pagina(() => import('@/pages/AdminExpirationsPage'), 'AdminExpirationsPage');
const AdminPromotionsPage = pagina(() => import('@/pages/AdminPromotionsPage'), 'AdminPromotionsPage');
const AdminSettingsPage = pagina(() => import('@/pages/AdminSettingsPage'), 'AdminSettingsPage');

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col justify-between bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <div>
                <Navbar />
                <main>
                  <Suspense fallback={<PantallaCargando />}>
                    <Routes>
                      {/* Rutas públicas */}
                      <Route path="/" element={<HomeExplorerPage />} />
                      <Route path="/comercio/:slug" element={<CommerceDetailPage />} />
                      <Route path="/promociones" element={<PromotionsPage />} />

                      {/* Logins */}
                      <Route path="/login" element={<MerchantLoginPage />} />
                      <Route path="/admin/login" element={<AdminLoginPage />} />

                      {/* Comerciante */}
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

                      {/* Administrador: todas las pantallas comparten AdminLayout */}
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login">
                            <AdminLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<AdminDashboardPage />} />
                        <Route path="pagos" element={<AdminPaymentsPage />} />
                        <Route path="vencimientos" element={<AdminExpirationsPage />} />
                        <Route path="promociones" element={<AdminPromotionsPage />} />
                        <Route path="comercios/nuevo" element={<AdminNewCommercePage />} />
                        <Route path="configuracion" element={<AdminSettingsPage />} />
                      </Route>

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </main>
              </div>
              <Footer />
            </div>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
