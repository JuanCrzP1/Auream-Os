import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WebhookSummary } from "@contracts/WebhookContracts";
import { useWebhooks } from "@shared/webhooks/useWebhooks";
import { useConnections } from "@shared/connections/useConnections";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { IntegrationSection } from "@shared/ui/integration-kit/IntegrationSection";
import { CreateWebhookDialog } from "./CreateWebhookDialog";
import { WebhookCard } from "./WebhookCard";

/** Integraciones → Webhooks de entrada: la lista, crear (y pasar a configurarlo) y borrar. */
export function WebhooksPanel() {
  const hooks = useWebhooks();
  const { connections } = useConnections();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WebhookSummary | null>(null);
  const connectionName = (id: string | null) => (id ? (connections.find((connection) => connection.id === id)?.name ?? "Número eliminado") : null);

  return (
    <IntegrationSection
      id="webhooks"
      title="Tus webhooks"
      noun="tus webhooks"
      description="Cada uno tiene su dirección secreta. Lo que llega identifica al cliente por su teléfono, guarda sus datos, le pone etiquetas y puede iniciar un flujo."
      status={hooks.status}
      onRetry={hooks.refresh}
      count={hooks.webhooks.length}
      connectLabel="Nuevo webhook"
      onConnect={() => setCreating(true)}
      empty={{
        icon: StateIcons.target,
        title: "Crea tu primer webhook",
        description: "Recibe ventas de Hotmart, leads de un formulario o datos de n8n y Make, y haz que Auream actúe al instante."
      }}
      dialogs={
        <>
          {creating ? (
            <CreateWebhookDialog
              connections={connections}
              onCreate={hooks.create}
              onCreated={(webhook) => navigate(`/integrations/webhooks/${webhook.id}`)}
              onClose={() => setCreating(false)}
            />
          ) : null}
          {deleting ? (
            <ConfirmDialog
              title={`¿Eliminar «${deleting.name}»?`}
              message="Su dirección deja de funcionar al instante y se borra su historial. Lo que ya hizo (contactos, etiquetas, flujos) se queda."
              confirmLabel="Eliminar webhook"
              onConfirm={() => hooks.remove(deleting.id)}
              onClose={() => setDeleting(null)}
            />
          ) : null}
        </>
      }
    >
      {hooks.webhooks.map((webhook) => (
        <WebhookCard key={webhook.id} webhook={webhook} connectionName={connectionName(webhook.connectionId)} onDelete={() => setDeleting(webhook)} />
      ))}
    </IntegrationSection>
  );
}
