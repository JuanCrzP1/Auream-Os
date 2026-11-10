import type { TenantMembershipSummary } from "@contracts/TenancyContracts";
import { useActiveTenantOptional } from "./ActiveTenantContext";

/** Un permiso de la cuenta (`flows.write`, `team.manage`…), como lo manda el servidor. */
export type Permission = TenantMembershipSummary["permissions"][number];

/**
 * ¿La persona puede hacer esto en la cuenta activa? Sirve para mostrar u
 * ocultar acciones (p. ej. el Asesor ve las automatizaciones sin editarlas);
 * la protección real está en la API, que responde 403 de todos modos.
 *
 * Solo dice «no» cuando el servidor ya lo confirmó: con las cuentas cargadas,
 * la cuenta activa elegida y su lista de permisos sin este. Mientras tanto
 * (cargando, fuera de la app, servidor de una versión anterior) dice «sí»:
 * a la mayoría —dueños y administradores— no se le esconden ni le parpadean
 * los botones, y lo que no se pueda, la API lo rechaza.
 */
export function useCan(permission: Permission): boolean {
  const tenant = useActiveTenantOptional();
  if (!tenant || tenant.state.status !== "ready") return true;
  const active = tenant.state.tenants.find((entry) => entry.tenantId === tenant.activeTenantId);
  if (!active?.permissions) return true;
  return active.permissions.includes(permission);
}
