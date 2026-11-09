import { MCP_AREAS, type McpAccessLevel, type McpAreaId } from "@contracts/McpContracts";
import "./permission-matrix.css";

export type PermissionDraft = Partial<Record<McpAreaId, McpAccessLevel>>;

/** Lo que se marca por defecto: ver flujos y contactos (lo mínimo útil; el resto lo abre quien autoriza). */
export const DEFAULT_PERMISSIONS: PermissionDraft = { flows: "read", contacts: "read" };

export const hasAnyAccess = (permissions: PermissionDraft) => Object.values(permissions).some((level) => level && level !== "none");

/**
 * Los permisos de un agente por área: sin acceso, ver, o ver y editar donde
 * existe. Cada fila explica lo que deja hacer el nivel elegido. La usan el
 * diálogo de nueva credencial y la pantalla de autorización OAuth.
 */
export function PermissionMatrix({ value, onChange, legend = "Permisos" }: { readonly value: PermissionDraft; readonly onChange: (next: PermissionDraft) => void; readonly legend?: string }) {
  return (
    <fieldset className="mcp-permissions">
      <legend>{legend}</legend>
      {MCP_AREAS.map((area) => {
        const level = value[area.id] ?? "none";
        const options: Array<{ value: McpAccessLevel; label: string }> = [{ value: "none", label: "Sin acceso" }, { value: "read", label: "Ver" }, ...(area.write ? [{ value: "write" as const, label: "Ver y editar" }] : [])];
        return (
          <div key={area.id} className="mcp-permissions__row">
            <div>
              <strong>{area.label}</strong>
              <p className="ui-muted">{level === "write" ? area.write : level === "none" ? "Sin acceso." : area.read}</p>
            </div>
            <div className="mcp-segmented" role="radiogroup" aria-label={area.label}>
              {options.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={level === option.value} className="mcp-segmented__option" onClick={() => onChange({ ...value, [area.id]: option.value })}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
