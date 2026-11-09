import { useId, useState } from "react";
import { MCP_AREAS, MCP_EXPIRY_OPTIONS, type CreateMcpCredentialRequest, type McpAccessLevel, type McpAreaId, type McpCredentialCreated } from "@contracts/McpContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

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
  const [permissions, setPermissions] = useState<Partial<Record<McpAreaId, McpAccessLevel>>>({ flows: "read", contacts: "read" });
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anyAccess = Object.values(permissions).some((level) => level && level !== "none");

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

        <fieldset className="mcp-permissions">
          <legend>Permisos</legend>
          {MCP_AREAS.map((area) => {
            const level = permissions[area.id] ?? "none";
            const options: Array<{ value: McpAccessLevel; label: string }> = [{ value: "none", label: "Sin acceso" }, { value: "read", label: "Ver" }, ...(area.write ? [{ value: "write" as const, label: "Ver y editar" }] : [])];
            return (
              <div key={area.id} className="mcp-permissions__row">
                <div>
                  <strong>{area.label}</strong>
                  <p className="ui-muted">{level === "write" ? area.write : area.read}</p>
                </div>
                <div className="mcp-segmented" role="radiogroup" aria-label={area.label}>
                  {options.map((option) => (
                    <button key={option.value} type="button" role="radio" aria-checked={level === option.value} className="mcp-segmented__option" onClick={() => setPermissions({ ...permissions, [area.id]: option.value })}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>

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
