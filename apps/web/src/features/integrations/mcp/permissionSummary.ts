import { MCP_AREAS, type McpPermissions } from "@contracts/McpContracts";

/** «Contactos y etiquetas: ver y editar · Flujos: ver» — los permisos de una credencial en palabras. */
export function permissionSummary(permissions: McpPermissions): string[] {
  return MCP_AREAS.flatMap((area) => {
    const level = permissions[area.id];
    if (level === "read") return [`${area.label}: ver`];
    if (level === "write") return [`${area.label}: ver y editar`];
    return [];
  });
}
