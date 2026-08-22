import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow";

// ---------------------------------------------------------------------------
// Validación mínima de estructura al leer del disco.
//
// Responsabilidad única: comprobar que un JSON leído tiene la forma de un
// AutomationFlow antes de tratarlo como tal.
//
// El disco es una frontera de confianza: un fichero corrupto o de una versión
// antigua no debe entrar en el dominio con un `as` ciego. Esto NO es un sistema
// de schemas; es la comprobación mínima de los campos que el dominio exige.
// ---------------------------------------------------------------------------

const VALID_STATUS: ReadonlySet<string> = new Set([
  "active",
  "paused",
  "draft",
  "archived"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAutomationFlow(value: unknown): value is AutomationFlow {
  if (!isRecord(value) || !isRecord(value["metadata"])) {
    return false;
  }

  const metadata = value["metadata"];

  return (
    typeof value["id"] === "string" &&
    typeof value["tenantId"] === "string" &&
    typeof value["key"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["status"] === "string" &&
    VALID_STATUS.has(value["status"]) &&
    typeof metadata["createdAt"] === "string" &&
    typeof metadata["updatedAt"] === "string"
  );
}
