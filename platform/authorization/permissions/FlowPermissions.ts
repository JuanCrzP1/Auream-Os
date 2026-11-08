import type { Scope } from "../contracts/Scope";

// Permisos necesarios para cada operación sobre flows.
// Centraliza la semántica: si el requisito cambia, cambia aquí, no en los handlers.
export const FlowPermissions = {
  read: "flows.read" as Scope,
  write: "flows.write" as Scope,
  /**
   * Poner un flujo a atender clientes. Los flujos ya no se publican (se
   * autoguardan); el scope queda reservado para asignar un flujo a una
   * conexión de WhatsApp (FASE D, D1). Hoy ninguna ruta lo exige.
   */
  publish: "flows.publish" as Scope
} as const;
