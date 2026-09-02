import type { AutomationFolder } from "../../../domains/automations/catalog/domain/AutomationFolder";

// ---------------------------------------------------------------------------
// Validación mínima de estructura al leer del disco.
//
// Responsabilidad única: comprobar que un JSON leído tiene la forma de un
// AutomationFolder antes de tratarlo como tal.
//
// Misma regla que `parseAutomationFlow`: el disco es una frontera de confianza
// y un fichero corrupto no entra en el dominio con un `as` ciego. Sin esto, un
// solo fichero malformado rompe el listado entero del tenant.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAutomationFolder(value: unknown): value is AutomationFolder {
  if (!isRecord(value)) {
    return false;
  }

  const parentFolderId = value["parentFolderId"];

  return (
    typeof value["id"] === "string" &&
    typeof value["tenantId"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["createdAt"] === "string" &&
    (parentFolderId === undefined || typeof parentFolderId === "string")
  );
}
