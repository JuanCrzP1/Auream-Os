import { Routes, Route, Navigate } from "react-router-dom";
import { AutomationsHubPage } from "@features/automations/list/pages/AutomationsHubPage";
import { BuilderPage } from "@features/automations/builder/pages/BuilderPage";
import { ConnectionsPage } from "@features/connections/pages/ConnectionsPage";
import { ConversationsPage } from "@features/conversations/pages/ConversationsPage";
import { AiAgentsPage } from "@features/ai-agents/pages/AiAgentsPage";
import { IntegrationsPage } from "@features/integrations/pages/IntegrationsPage";
import { IntegrationDetailPage } from "@features/integrations/pages/IntegrationDetailPage";
import { IntegrationItemPage } from "@features/integrations/pages/IntegrationItemPage";
import { OAuthConsentPage } from "@features/integrations/pages/OAuthConsentPage";
import { LoginPage } from "@features/auth/pages/LoginPage";
import { RegisterPage } from "@features/auth/pages/RegisterPage";
import { ForgotPasswordPage } from "@features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@features/auth/pages/ResetPasswordPage";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { TemplatesPage } from "./placeholders/TemplatesPage";
import { ArchivePage } from "./placeholders/ArchivePage";
import { accountRoutes } from "./accountRoutes";
import { moduleRoutes } from "./moduleRoutes";
import { AcceptInvitationPage } from "@features/team/pages/AcceptInvitationPage";

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
      {/* Invitación al equipo: se abre sin sesión (quien la recibe puede no tener
          cuenta); la página pide entrar o registrarse y vuelve a sí misma. */}
      <Route path="/invite/:token" element={<AcceptInvitationPage />} />

      <Route path="/" element={<Navigate to="/automations" replace />} />

      {/* Autorizar un agente de IA (Claude web y escritorio) por OAuth: con
          sesión, pero suelta (sin barra lateral): se llega desde el agente y
          se vuelve a él. */}
      <Route
        path="/oauth/authorize"
        element={
          <ProtectedRoute>
            <OAuthConsentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/conversations"
        element={
          <ProtectedRoute>
            <AppShell>
              <ConversationsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

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
      {/* Una carpeta abierta es la MISMA pantalla, no otra: comparte
          cabecera, buscador, acciones y tarjetas, y solo cambia qué
          contiene. Vive en la ruta para que recargar siga dentro de la
          carpeta y el botón atrás del navegador funcione. */}
      <Route
        path="/automations/folders/:folderId"
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
        path="/integrations"
        element={
          <ProtectedRoute>
            <AppShell>
              <IntegrationsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/:integrationId"
        element={
          <ProtectedRoute>
            <AppShell>
              <IntegrationDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/:integrationId/:itemId"
        element={
          <ProtectedRoute>
            <AppShell>
              <IntegrationItemPage />
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

      {moduleRoutes()}
      {accountRoutes()}

      <Route path="*" element={<Navigate to="/automations" replace />} />
    </Routes>
  );
}
