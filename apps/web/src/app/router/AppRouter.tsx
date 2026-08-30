import { Routes, Route, Navigate } from "react-router-dom";
import { AutomationsHubPage } from "@features/automations/list/pages/AutomationsHubPage";
import { BuilderPage } from "@features/automations/builder/pages/BuilderPage";
import { ConnectionsPage } from "@features/connections/pages/ConnectionsPage";
import { AiAgentsPage } from "@features/ai-agents/pages/AiAgentsPage";
import { LoginPage } from "@features/auth/pages/LoginPage";
import { RegisterPage } from "@features/auth/pages/RegisterPage";
import { ForgotPasswordPage } from "@features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@features/auth/pages/ResetPasswordPage";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { TemplatesPage } from "./placeholders/TemplatesPage";
import { ArchivePage } from "./placeholders/ArchivePage";

/**
 * Rutas de la aplicación.
 *
 * Las rutas de autenticación son públicas; todo lo demás pasa por
 * ProtectedRoute, la única estrategia de protección del frontend.
 *
 * `/reset-password` tiene que ser pública aunque cambie una credencial: el
 * usuario llega desde el correo sin sesión, y la autoridad es el token que
 * verifica el proveedor, no una sesión nuestra.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/" element={<Navigate to="/automations" replace />} />

      <Route
        path="/automations"
        element={
          <ProtectedRoute>
            <AppShell>
              <AutomationsHubPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/automations/templates"
        element={
          <ProtectedRoute>
            <AppShell>
              <TemplatesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/automations/archive"
        element={
          <ProtectedRoute>
            <AppShell>
              <ArchivePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/connections"
        element={
          <ProtectedRoute>
            <AppShell>
              <ConnectionsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-agents"
        element={
          <ProtectedRoute>
            <AppShell>
              <AiAgentsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/builder/:flowKey"
        element={
          <ProtectedRoute>
            <BuilderPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/automations" replace />} />
    </Routes>
  );
}
