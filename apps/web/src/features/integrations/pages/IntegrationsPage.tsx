import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/integrations.css";
import { useState } from "react";
import type { AiCredentialSummary } from "@contracts/AiContracts";
import { useAiCredentials } from "@shared/ai-credentials/useAiCredentials";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { AiCredentialCard } from "../components/AiCredentialCard";
import { ConnectAiDialog } from "../components/ConnectAiDialog";
import { EditAiCredentialDialog } from "../components/EditAiCredentialDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";

type Dialog =
  | { readonly kind: "connect" }
  | { readonly kind: "rename" | "key" | "delete"; readonly credential: AiCredentialSummary }
  | null;

/**
 * IntegrationsPage — las conexiones de la cuenta con servicios externos. Hoy:
 * proveedores de IA para el bloque «Extensión IA». (Píxeles de Meta, después.)
 */
export function IntegrationsPage() {
  const ai = useAiCredentials();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await ai.refresh();
    setRetrying(false);
  };

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Integraciones</h1>
          <p className="ui-page__subtitle">Conecta tus cuentas de IA y otros servicios. Las claves se guardan cifradas y nunca se muestran completas.</p>
        </div>
      </header>

      <section className="ui-panel" aria-labelledby="ai-section-title">
        <div className="integrations-section__head">
          <div>
            <h2 id="ai-section-title" className="integrations-section__title">Inteligencia artificial</h2>
            <p className="ui-muted">Las usa el bloque «Extensión IA» de tus flujos. Pagas a tu proveedor según su uso.</p>
          </div>
          {ai.status === "ready" && ai.credentials.length > 0 ? (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "connect" })}>
              Conectar IA
            </button>
          ) : null}
        </div>

        {ai.status === "error" || retrying ? (
          <StateCard
            role="alert"
            tone="warning"
            icon={StateIcons.offline}
            title="No pudimos cargar tus conexiones"
            description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
            actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
          />
        ) : ai.status === "unavailable" ? (
          <StateCard
            tone="warning"
            icon={StateIcons.lock}
            title="Conexiones de IA no disponibles"
            description="El servidor todavía no tiene configurado el cifrado de claves. Pide al administrador de la plataforma que lo active."
          />
        ) : ai.status === "forbidden" ? (
          <StateCard
            icon={StateIcons.lock}
            title="Sin acceso a las conexiones"
            description="Tu rol no permite ver las conexiones de IA de esta cuenta. Pide acceso a un administrador."
          />
        ) : ai.status === "loading" ? (
          <div className="ai-grid" aria-busy="true" aria-label="Cargando conexiones">
            <div className="ai-card ai-card--skeleton" />
            <div className="ai-card ai-card--skeleton" />
          </div>
        ) : ai.credentials.length === 0 ? (
          <StateCard
            icon={StateIcons.sparkles}
            title="Conecta tu primera IA"
            description="Pega la clave de API de OpenAI, Google Gemini u OpenRouter. La comprobamos con el proveedor y la guardamos cifrada."
            actions={
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "connect" })}>
                Conectar IA
              </button>
            }
          />
        ) : (
          <div className="ai-grid">
            {ai.credentials.map((credential) => (
              <AiCredentialCard
                key={credential.id}
                credential={credential}
                onVerify={() => ai.verify(credential.id)}
                onRename={() => setDialog({ kind: "rename", credential })}
                onReplaceKey={() => setDialog({ kind: "key", credential })}
                onDelete={() => setDialog({ kind: "delete", credential })}
              />
            ))}
          </div>
        )}
      </section>

      {dialog?.kind === "connect" ? <ConnectAiDialog onConnect={ai.create} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "rename" || dialog?.kind === "key" ? (
        <EditAiCredentialDialog
          credential={dialog.credential}
          mode={dialog.kind}
          onSave={(request) => ai.update(dialog.credential.id, request)}
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
    </div>
  );
}
