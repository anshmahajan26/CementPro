import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";

// ✅ Lazy-load all page-level components so each route's JS is only fetched
// when the user first navigates to it. This dramatically reduces Time-to-Interactive
// on the initial load (only the Login page code is needed at app start).
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ForecastPage = lazy(() => import("@/pages/ForecastPage"));
const ProcurementPage = lazy(() => import("@/pages/ProcurementPage"));
const CarbonPage = lazy(() => import("@/pages/CarbonPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const AdminPanelPage = lazy(() => import("@/pages/AdminPanelPage"));

// Minimal loading fallback shown between route transitions
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="procurement" element={<ProcurementPage />} />
        <Route path="carbon" element={<CarbonPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={["Admin", "Manager"]}>
              <AdminPanelPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default App;
