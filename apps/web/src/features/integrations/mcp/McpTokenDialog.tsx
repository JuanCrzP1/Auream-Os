import "@shared/ui/integration-kit/integration-card.css";
import { useId } from "react";
import type { McpCredentialCreated } from "@contracts/McpContracts";
import { CopyButton } from "./CopyButton";
import { McpSnippets } from "./McpSnippets";

/** El token recién creado: se muestra UNA vez, con la configuración lista para copiar. */
export function McpTokenDialog({ created, serverUrl, onClose }: { readonly created: McpCredentialCreated; readonly serverUrl: string; readonly onClose: () => void }) {
  const titleId = useId();
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ui-dialog mcp-dialog">
        <h2 id={titleId}>Credencial «{created.credential.name}» creada</h2>
        <p className="ai-card__warning">Copia el token ahora: por seguridad no se vuelve a mostrar. Si lo pierdes, revoca esta credencial y crea otra.</p>
        <div className="webhook-address">
          <input className="ui-input webhook-address__url" readOnly value={created.token} aria-label="Token de la credencial" onFocus={(event) => event.target.select()} />
          <CopyButton text={created.token} label="Copiar token" className="ui-btn ui-btn--primary" />
        </div>
        <McpSnippets url={serverUrl} token={created.token} />
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>Ya lo guardé</button>
        </div>
      </div>
    </div>
  );
}
