import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { LoginPage } from './modules/auth/LoginPage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { RequirePerm } from './shared/components/RequirePerm';
import { RequireSuper } from './shared/components/RequireSuper';
import { NotFoundPage } from './shared/pages/ErrorPages';
import { HomePage } from './modules/home/HomePage';
import { ClientsListPage } from './modules/clients/ClientsListPage';
import { CreateClientPage } from './modules/clients/CreateClientPage';
import { EditClientPage } from './modules/clients/EditClientPage';
import { ProfilePage } from './modules/profile/ProfilePage';
import { ConfigPage } from './modules/config/ConfigPage';
import { CreditsHomePage } from './modules/credits/CreditsHomePage';
import { CreditsListPage } from './modules/credits/CreditsListPage';
import { CreditStudyPage } from './modules/credits/CreditStudyPage';
import { CreditResultPage } from './modules/credits/CreditResultPage';
import { CreditSignPage } from './modules/credits/CreditSignPage';
import { CreditSuccessPage } from './modules/credits/CreditSuccessPage';
import { CreditPortfolioPage } from './modules/credits/CreditPortfolioPage';
import { CreditDocumentsPage } from './modules/credits/CreditDocumentsPage';
import { UsersListPage } from './modules/users/UsersListPage';
import { PortfolioPage } from './modules/portfolio/PortfolioPage';
import { DiscountsPage } from './modules/discounts/DiscountsPage';
import { SurveysPage } from './modules/surveys/SurveysPage';
import { ExpensesPage } from './modules/expenses/ExpensesPage';
import { ComplaintsPage } from './modules/complaints/ComplaintsPage';
import { PricesPage } from './modules/prices/PricesPage';
import { NewProductsPage } from './modules/newProducts/NewProductsPage';
import { RoutesPage } from './modules/routes/RoutesPage';
import { BrainPage } from './modules/brain/BrainPage';
import { ProfilesPage } from './modules/profiles/ProfilesPage';
import { CalculatorPage } from './modules/calculator/CalculatorPage';
import { CatalogPage } from './modules/catalog/CatalogPage';
import { PromosPage } from './modules/promos/PromosPage';
import { PromoCreatePage } from './modules/promos/PromoCreatePage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { SuperAdminGlobalConfigPage } from './modules/global/SuperAdminGlobalConfigPage';

// Vista de pruebas (callbacks de créditos): solo se empaqueta en desarrollo
// (import dinámico condicional + ruta con import.meta.env.DEV), nunca en prod.
const TestViewPage = import.meta.env.DEV
  ? lazy(() => import('./modules/test/TestViewPage').then((m) => ({ default: m.TestViewPage })))
  : null;

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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

          {/* Clientes */}
          <Route
            path="/clients"
            element={
              <RequirePerm module="clients" perm="clients.read">
                <ClientsListPage />
              </RequirePerm>
            }
          />
          <Route
            path="/clients/new"
            element={
              <RequirePerm module="clients" perm="clients.create">
                <CreateClientPage />
              </RequirePerm>
            }
          />
          <Route
            path="/clients/:id/edit"
            element={
              <RequirePerm module="clients" perm="clients.update">
                <EditClientPage />
              </RequirePerm>
            }
          />

          {/* Configuración */}
          <Route
            path="/config"
            element={
              <RequirePerm module="config" perm="config.read">
                <ConfigPage />
              </RequirePerm>
            }
          />
          <Route
            path="/global-config"
            element={
              <RequireSuper>
                <SuperAdminGlobalConfigPage />
              </RequireSuper>
            }
          />

          {/* Créditos */}
          <Route
            path="/credits"
            element={
              <RequirePerm module="credits" perm="credits.read">
                <CreditsHomePage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/list"
            element={
              <RequirePerm module="credits" perm="credits.read">
                <CreditsListPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/study"
            element={
              <RequirePerm module="credits" perm="credits.study">
                <CreditStudyPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/result/:id"
            element={
              <RequirePerm module="credits" perm="credits.study">
                <CreditResultPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/sign/:id"
            element={
              <RequirePerm module="credits" perm="credits.study">
                <CreditSignPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/success/:id"
            element={
              <RequirePerm module="credits" perm="credits.study">
                <CreditSuccessPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/mine"
            element={
              <RequirePerm module="credits" perm="credits.read">
                <CreditPortfolioPage />
              </RequirePerm>
            }
          />
          <Route
            path="/credits/:id/documents"
            element={
              <RequirePerm module="credits" perm="credits.read">
                <CreditDocumentsPage />
              </RequirePerm>
            }
          />

          {/* Usuarios / perfiles */}
          <Route
            path="/users"
            element={
              <RequirePerm module="users" perm="users.read">
                <UsersListPage />
              </RequirePerm>
            }
          />
          <Route
            path="/profiles"
            element={
              <RequirePerm module="profiles" perm="profiles.read">
                <ProfilesPage />
              </RequirePerm>
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

          {/* Módulos comerciales Herragro (9 nuevos) */}
          <Route path="/portfolio" element={<RequirePerm module="portfolio" perm="portfolio.read"><PortfolioPage /></RequirePerm>} />
          <Route path="/discounts" element={<RequirePerm module="discounts" perm="discounts.read"><DiscountsPage /></RequirePerm>} />
          <Route path="/surveys" element={<RequirePerm module="surveys" perm="surveys.read"><SurveysPage /></RequirePerm>} />
          <Route path="/expenses" element={<RequirePerm module="expenses" perm="expenses.read"><ExpensesPage /></RequirePerm>} />
          <Route path="/complaints" element={<RequirePerm module="complaints" perm="complaints.read"><ComplaintsPage /></RequirePerm>} />
          <Route path="/prices" element={<RequirePerm module="prices" perm="prices.read"><PricesPage /></RequirePerm>} />
          <Route path="/new-products" element={<RequirePerm module="new-products" perm="new-products.read"><NewProductsPage /></RequirePerm>} />
          <Route path="/routes" element={<RequirePerm module="routes" perm="routes.read"><RoutesPage /></RequirePerm>} />
          <Route path="/brain" element={<RequirePerm module="brain" perm="brain.read"><BrainPage /></RequirePerm>} />

          {/* Otros módulos (algunos aún no registrados en BD; RequirePerm los mantiene coherentes) */}
          <Route path="/calculator" element={<RequirePerm module="calculator" perm="calculator.sumar"><CalculatorPage /></RequirePerm>} />
          <Route path="/catalog" element={<RequirePerm module="catalog" perm="catalog.ver"><CatalogPage /></RequirePerm>} />
          <Route path="/promos" element={<RequirePerm module="promos" perm="promos.ver"><PromosPage /></RequirePerm>} />
          <Route path="/promos/nueva" element={<RequirePerm module="promos" perm="promos.crear"><PromoCreatePage /></RequirePerm>} />
          <Route path="/reports" element={<RequirePerm module="reports" perm="reports.ver"><ReportsPage /></RequirePerm>} />

          {/* 404 real: antes redirigía silenciosamente a /home */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
