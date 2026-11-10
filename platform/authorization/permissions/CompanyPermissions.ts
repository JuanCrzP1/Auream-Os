import type { Scope } from "../contracts/Scope";

// Permisos sobre los datos de la empresa (nombre, logo y zona horaria).
//   ver      todo el equipo (basta pertenecer a la cuenta)
//   manage   cambiarlos: los dueños de la cuenta
export const CompanyPermissions = {
  manage: "tenant.manage" as Scope
} as const;
