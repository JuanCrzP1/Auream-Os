import type { Scope } from "../contracts/Scope";

// Permisos necesarios para operaciones de runtime/ejecución.
export const RuntimePermissions = {
  execute: "runtime.execute" as Scope
} as const;
