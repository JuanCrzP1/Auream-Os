import { useState } from "react";
import { aiProviderInfo, type AiCredentialSummary, type AiProviderId } from "@contracts/AiContracts";
import { useAiCredentials } from "@shared/ai-credentials/useAiCredentials";
import { ConnectionCard } from "./ConnectionCard";
import { ConnectAiDialog } from "./ConnectAiDialog";
import { EditConnectionDialog } from "./EditConnectionDialog";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { ProviderMark } from "./ProviderMark";
import { IntegrationSection } from "./IntegrationSection";
import { formatDateTime } from "@shared/format/formatDate";
import { StateIcons } from "@shared/ui/state/stateIcons";

type Dialog = { readonly kind: "connect" } | { readonly kind: "rename" | "secret" | "delete"; readonly credential: AiCredentialSummary } | null;

/**
 * Integraciones → Inteligencia artificial: conexiones para el bloque
 * «Extensión IA». Con `provider`, solo las de ese proveedor (su página en el
 * catálogo) y el diálogo de conectar llega con él elegido.
 */
export function AiSection({ provider }: { readonly provider?: AiProviderId } = {}) {
  const ai = useAiCredentials();
  const [dialog, setDialog] = useState<Dialog>(null);
  const credentials = provider ? ai.credentials.filter((credential) => credential.provider === provider) : ai.credentials;
  const providerName = provider ? aiProviderInfo(provider).name : null;

  return (
    <IntegrationSection
      id="ai"
      title={providerName ? `Conexiones de ${providerName}` : "Inteligencia artificial"}
      noun="tus conexiones de IA"
      description="Las usa el bloque «Extensión IA» de tus flujos. Pagas a tu proveedor según su uso."
      status={ai.status}
      onRetry={ai.refresh}
      count={credentials.length}
      connectLabel={providerName ? `Conectar ${providerName}` : "Conectar IA"}
      onConnect={() => setDialog({ kind: "connect" })}
      empty={{
        icon: StateIcons.sparkles,
        title: providerName ? `Conecta tu cuenta de ${providerName}` : "Conecta tu primera IA",
        description: providerName
          ? `Pega tu clave de API de ${providerName}. La comprobamos con ${providerName} y la guardamos cifrada.`
          : "Pega la clave de API de OpenAI, Google Gemini u OpenRouter. La comprobamos con el proveedor y la guardamos cifrada."
      }}
      dialogs={
        <>
          {dialog?.kind === "connect" ? <ConnectAiDialog onConnect={ai.create} onClose={() => setDialog(null)} {...(provider ? { provider } : {})} /> : null}
          {dialog?.kind === "rename" || dialog?.kind === "secret" ? (
            <EditConnectionDialog
              name={dialog.credential.name}
              mode={dialog.kind}
              secretLabel="la clave"
              secretFieldLabel={`Nueva clave de ${aiProviderInfo(dialog.credential.provider).name}`}
              secretPlaceholder={aiProviderInfo(dialog.credential.provider).keyPlaceholder}
              secretHint="Los bloques que usan esta conexión empiezan a usar la clave nueva al instante."
              onSave={(value) => ai.update(dialog.credential.id, dialog.kind === "rename" ? { name: value } : { apiKey: value })}
              onClose={() => setDialog(null)}
            />
          ) : null}
          {dialog?.kind === "delete" ? (
            <ConfirmDialog
              title={`¿Eliminar «${dialog.credential.name}»?`}
              message="La clave se borra de Auream. Los bloques de IA que usan esta conexión saldrán por «Error» hasta que elijas otra."
              confirmLabel="Eliminar conexión"
              onConfirm={() => ai.remove(dialog.credential.id)}
              onClose={() => setDialog(null)}
            />
          ) : null}
        </>
      }
    >
      {credentials.map((credential) => (
        <ConnectionCard
          key={credential.id}
          mark={<ProviderMark provider={credential.provider} />}
          name={credential.name}
          subtitle={aiProviderInfo(credential.provider).name}
          active={credential.status === "active"}
          facts={[
            { label: "Clave", value: credential.hint, mono: true },
            { label: "Verificada", value: credential.lastVerifiedAt ? formatDateTime(credential.lastVerifiedAt) : "Nunca" }
          ]}
          invalidWarning="El proveedor ya no acepta esta clave: los bloques que la usan saldrán por «Error». Cámbiala por una nueva."
          invalidLabel="Clave rechazada"
          replaceLabel="Cambiar clave"
          onVerify={() => ai.verify(credential.id)}
          onRename={() => setDialog({ kind: "rename", credential })}
          onReplaceSecret={() => setDialog({ kind: "secret", credential })}
          onDelete={() => setDialog({ kind: "delete", credential })}
        />
      ))}

    </IntegrationSection>
  );
}
