import type { ExternalEvent, TriggerBinding } from "../../contracts/TriggerContracts";

// ---------------------------------------------------------------------------
// TriggerResolver — puerto
//
// Responsabilidad única: dado un evento externo, decidir qué flow debe
// ejecutarse. El motor declara lo que necesita; quién resuelve la regla
// (Automations, una tabla SQL, un caché) es decisión de la composición.
//
// Estado: PREPARADO. No existe implementación todavía.
// ---------------------------------------------------------------------------

export interface TriggerResolver {
  /** Devuelve el binding activo para el evento, o `null` si nada debe dispararse. */
  resolve(event: ExternalEvent): TriggerBinding | null;
}
