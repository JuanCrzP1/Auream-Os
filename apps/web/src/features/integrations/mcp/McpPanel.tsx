import "../webhooks/webhooks.css";
import "./mcp.css";
import { useState } from "react";
import type { McpCredentialCreated, McpCredentialSummary } from "@contracts/McpContracts";
import { useMcpCredentials } from "@shared/mcp/useMcpCredentials";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { IntegrationSection } from "../components/IntegrationSection";
import { McpServerCard } from "./McpServerCard";
import { McpCredentialCard } from "./McpCredentialCard";
import { CreateMcpCredentialDialog } from "./CreateMcpCredentialDialog";
import { McpTokenDialog } from "./McpTokenDialog";

/**
 * Integraciones → Agentes de IA (MCP): la dirección del servidor con cómo
 * conectar cada agente, y las credenciales (permisos por área, último uso,
 * vencimiento, revocar). El token se ve una sola vez, al crearla.
 */
export function McpPanel() {
  const mcp = useMcpCredentials();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<McpCredentialCreated | null>(null);
  const [revoking, setRevoking] = useState<McpCredentialSummary | null>(null);

  return (
    <>
      {mcp.server ? <McpServerCard url={mcp.server.url} /> : null}
      <IntegrationSection
        id="mcp"
        title="Credenciales"
        noun="tus credenciales"
        description="Una por agente. Si una se pierde o ya no la usas, revócala: deja de funcionar al instante."
        status={mcp.status}
        onRetry={mcp.refresh}
        count={mcp.credentials.length}
        connectLabel="Nueva credencial"
        onConnect={() => setCreating(true)}
        empty={{
          icon: StateIcons.lock,
          title: "Crea la credencial de tu primer agente",
          description: "Elige qué puede ver y hacer (flujos, contactos, conversaciones, números) y por cuánto tiempo."
        }}
        dialogs={
          <>
            {creating ? (
              <CreateMcpCredentialDialog
                onCreate={mcp.create}
                onCreated={(result) => {
                  setCreating(false);
                  setCreated(result);
                }}
                onClose={() => setCreating(false)}
              />
            ) : null}
            {created && mcp.server ? <McpTokenDialog created={created} serverUrl={mcp.server.url} onClose={() => setCreated(null)} /> : null}
            {revoking ? (
              <ConfirmDialog
                title={`¿Revocar «${revoking.name}»?`}
                message="El agente que la use pierde el acceso al instante. No se puede deshacer: tendrías que crear otra."
                confirmLabel="Revocar credencial"
                onConfirm={() => mcp.revoke(revoking.id)}
                onClose={() => setRevoking(null)}
              />
            ) : null}
          </>
        }
      >
        {mcp.credentials.map((credential) => (
          <McpCredentialCard key={credential.id} credential={credential} onRevoke={() => setRevoking(credential)} />
        ))}
      </IntegrationSection>
    </>
  );
}
