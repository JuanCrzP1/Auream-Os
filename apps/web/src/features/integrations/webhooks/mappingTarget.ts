import type { WebhookMapping } from "@contracts/WebhookContracts";

// ---------------------------------------------------------------------------
// ¿A qué campo del mapeo va el dato que se elige en el árbol del envío? Al
// que tenga el foco (teléfono, nombre, correo o un campo personalizado). Sin
// ninguno elegido, al teléfono si está vacío (es lo primero que hace falta).
// ---------------------------------------------------------------------------

export type PathTarget = "phonePath" | "namePath" | "emailPath" | { readonly field: number };

export function assignPath(mapping: WebhookMapping, target: PathTarget | null, path: string): WebhookMapping {
  const where = target ?? (mapping.phonePath ? null : "phonePath");
  if (where === null) return mapping;
  if (typeof where === "string") return { ...mapping, [where]: path };
  return { ...mapping, fields: mapping.fields.map((field, index) => (index === where.field ? { ...field, path } : field)) };
}

export function targetLabel(mapping: WebhookMapping, target: PathTarget | null): string | null {
  if (target === "phonePath") return "Teléfono";
  if (target === "namePath") return "Nombre";
  if (target === "emailPath") return "Correo";
  if (target) return `el campo «${mapping.fields[target.field]?.key || "nuevo"}»`;
  return mapping.phonePath ? null : "Teléfono";
}

export function sameTarget(a: PathTarget | null, b: PathTarget): boolean {
  return typeof a === "object" && a !== null && typeof b === "object" ? a.field === b.field : a === b;
}
