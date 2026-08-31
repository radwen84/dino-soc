import { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { useAuthStore } from "./stores/auth.store";
import { DashboardLayout } from "./layouts/DashboardLayout";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { AlertsPage } from "./pages/AlertsPage";
import { IocPage } from "./pages/IocPage";
import { AssetsPage } from "./pages/AssetsPage";
import { ThreatIntelPage } from "./pages/ThreatIntelPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route path="incidents" element={<IncidentsPage />} />

        <Route path="incidents/:id" element={<IncidentDetailPage />} />

        <Route path="alerts" element={<AlertsPage />} />

        <Route path="ioc" element={<IocPage />} />

        <Route path="assets" element={<AssetsPage />} />

        <Route path="threat-intel" element={<ThreatIntelPage />} />

        <Route path="reports" element={<ReportsPage />} />

        <Route path="users" element={<UsersPage />} />

        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
