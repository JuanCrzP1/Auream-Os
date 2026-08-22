import { Routes, Route, Navigate } from "react-router-dom";
import { AutomationsHubPage } from "@features/automations/list/pages/AutomationsHubPage";
import { BuilderPage } from "@features/automations/builder/pages/BuilderPage";
import { ConnectionsPage } from "@features/connections/pages/ConnectionsPage";
import { AiAgentsPage } from "@features/ai-agents/pages/AiAgentsPage";
import { AppShell } from "@shared/ui/app-shell/AppShell";

function TemplatesPage() {
  return <div style={{ padding: 40 }}>Plantillas — próximamente</div>;
}

function ArchivePage() {
  return <div style={{ padding: 40 }}>Archivo — próximamente</div>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/automations" replace />} />
      <Route path="/automations" element={<AppShell><AutomationsHubPage /></AppShell>} />
      <Route path="/automations/templates" element={<AppShell><TemplatesPage /></AppShell>} />
      <Route path="/automations/archive" element={<AppShell><ArchivePage /></AppShell>} />
      <Route path="/connections" element={<AppShell><ConnectionsPage /></AppShell>} />
      <Route path="/ai-agents" element={<AppShell><AiAgentsPage /></AppShell>} />
      <Route path="/builder/:flowKey" element={<BuilderPage />} />
      <Route path="*" element={<Navigate to="/automations" replace />} />
    </Routes>
  );
}
