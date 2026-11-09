import { useId, useState } from "react";
import { MCP_EXPIRY_OPTIONS, type CreateMcpCredentialRequest, type McpCredentialCreated } from "@contracts/McpContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { DEFAULT_PERMISSIONS, hasAnyAccess, PermissionMatrix, type PermissionDraft } from "./PermissionMatrix";

const EXPIRY_LABEL = (days: number | null) => (days === null ? "No vence" : days === 365 ? "1 año" : `${days} días`);

/**
 * Crear una credencial para un agente: nombre, permisos por área (sin acceso,
 * ver, o ver y editar donde existe) y vencimiento. Leona no tiene permisos:
 * aquí cada agente solo puede lo que se le da.
 */
export function CreateMcpCredentialDialog({
  onCreate,
  onCreated,
  onClose
}: {
  readonly onCreate: (request: CreateMcpCredentialRequest) => Promise<McpCredentialCreated>;
  readonly onCreated: (created: McpCredentialCreated) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<PermissionDraft>(DEFAULT_PERMISSIONS);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anyAccess = hasAnyAccess(permissions);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onCreated(await onCreate({ name: name.trim(), permissions, expiresInDays }));
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la credencial. Inténtalo de nuevo."));
      setSaving(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog mcp-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id={titleId}>Nueva credencial</h2>
        <p className="ui-muted">Para un agente (Claude, n8n, Cursor…). Solo podrá lo que marques aquí.</p>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={60} placeholder="Ej.: Claude de ventas" autoFocus onChange={(e) => setName(e.target.value)} />
        </label>

        <PermissionMatrix value={permissions} onChange={setPermissions} />

        <label className="ui-field">
          <span>Vence</span>
          <select className="ui-input" value={expiresInDays === null ? "never" : String(expiresInDays)} onChange={(e) => setExpiresInDays(e.target.value === "never" ? null : Number(e.target.value))}>
            {MCP_EXPIRY_OPTIONS.map((days) => (
              <option key={String(days)} value={days === null ? "never" : String(days)}>
                {EXPIRY_LABEL(days)}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || !name.trim() || !anyAccess}>
            {saving ? "Creando…" : "Crear credencial"}
          </button>
        </div>
      </form>
    </div>
  );
}
