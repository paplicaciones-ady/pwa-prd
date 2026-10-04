import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { ConnectivityProvider } from './shared/connectivity/ConnectivityContext';
import { ConnectivityBanner } from './shared/components/ConnectivityBanner';
import { RouteConnectivityProbe } from './shared/connectivity/RouteConnectivityProbe';
import { ThemeProvider } from './shared/theme/ThemeContext';
import { LoginPage } from './modules/auth/LoginPage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { AppLayout } from './shared/layout/AppLayout';
import { RequirePerm } from './shared/components/RequirePerm';
import { RequireSuper } from './shared/components/RequireSuper';
import { NotFoundPage } from './shared/pages/ErrorPages';
import { HomePage } from './modules/home/HomePage';
import { ProfilePage } from './modules/profile/ProfilePage';
import { MODULES } from './modules/registry';
import { SuperAdminGlobalConfigPage } from './modules/global/SuperAdminGlobalConfigPage';

// Vista de pruebas (callbacks de créditos): solo se empaqueta en desarrollo
// (import dinámico condicional + ruta con import.meta.env.DEV), nunca en prod.
const TestViewPage = import.meta.env.DEV
  ? lazy(() => import('./modules/test/TestViewPage').then((m) => ({ default: m.TestViewPage })))
  : null;

export function App() {
  return (
    // El proveedor de conexión envuelve a AuthProvider a propósito: la sonda
    // debe funcionar también en /login, donde no hay sesión que consultar.
    <ConnectivityProvider>
      <AuthProvider>
        <BrowserRouter>
          <ThemeProvider>
            <ConnectivityBanner />
            <RouteConnectivityProbe />
            {/* El layout envuelve TODAS las rutas (incluidas las que solo usan
                RequirePerm, /login y el 404) para que la topbar sea parte del
                chrome fijo y no dependa de estar detrás de ProtectedRoute. */}
            <AppLayout>
            <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />

            {/* Módulos: generados desde el registro (modules/registry). Cada
                ruta va envuelta en RequirePerm con el permiso que declara. */}
            {MODULES.flatMap((m) =>
              m.routes.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={
                    <RequirePerm module={m.module} perm={r.perm}>
                      {r.element}
                    </RequirePerm>
                  }
                />
              )),
            )}

            <Route
              path="/global-config"
              element={
                <RequireSuper>
                  <SuperAdminGlobalConfigPage />
                </RequireSuper>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Vista de pruebas (solo DEV) */}
            {TestViewPage && (
              <Route
                path="/test"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={null}>
                      <TestViewPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
            )}

            {/* 404 real: antes redirigía silenciosamente a /home */}
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </AppLayout>
          </ThemeProvider>
        </BrowserRouter>
      </AuthProvider>
    </ConnectivityProvider>
  );
}
