import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ForecastPage = lazy(() => import("@/pages/ForecastPage"));
const ProcurementPage = lazy(() => import("@/pages/ProcurementPage"));
const CarbonPage = lazy(() => import("@/pages/CarbonPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const OperatorDashboard = lazy(() => import("@/pages/OperatorDashboard"));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const RootRoute = () => {
  const { user } = useAuth();
  if (user?.role === "Operator") {
    return <Navigate to="/operator" replace />;
  }
  return <DashboardPage />;
};

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
        <Route index element={<RootRoute />} />
        
        {/* Manager Routes */}
        <Route path="forecast" element={<ProtectedRoute roles={["Manager"]}><ForecastPage /></ProtectedRoute>} />
        <Route path="procurement" element={<ProtectedRoute roles={["Manager"]}><ProcurementPage /></ProtectedRoute>} />
        <Route path="carbon" element={<ProtectedRoute roles={["Manager"]}><CarbonPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={["Manager"]}><ReportsPage /></ProtectedRoute>} />

        {/* Operator Route */}
        <Route path="operator" element={<ProtectedRoute roles={["Operator"]}><OperatorDashboard /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default App;
