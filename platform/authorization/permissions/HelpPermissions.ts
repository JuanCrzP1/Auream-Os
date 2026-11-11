import type { Scope } from "../contracts/Scope";

// Ayuda: leer artículos, ver tutoriales y abrir casos de soporte es de TODA
// persona con sesión (no pide permiso). Administrar los tutoriales, los datos
// de soporte y responder los casos de todas las cuentas es del equipo de
// Auream (`platform_admin`).
export const HelpPermissions = {
  manage: "help.manage" as Scope
} as const;
