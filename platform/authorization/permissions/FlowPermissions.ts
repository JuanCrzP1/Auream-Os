import type { Scope } from "../contracts/Scope";

// Permisos necesarios para cada operación sobre flows.
// Centraliza la semántica: si el requisito cambia, cambia aquí, no en los handlers.
export const FlowPermissions = {
  read: "flows.read" as Scope,
  write: "flows.write" as Scope,
  publish: "flows.publish" as Scope
} as const;
