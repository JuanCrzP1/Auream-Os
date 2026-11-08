import { CONTACT_FIELD_KEY_PATTERN } from "@contracts/ContactContracts";

/**
 * Nombre de campo propuesto para guardar un dato de la respuesta:
 * `data.lead.id` → `lead_id`; `items[0].sku` → `sku`. Siempre válido y sin
 * chocar con los que ya existen.
 */
export function suggestFieldName(path: string, taken: ReadonlyArray<string>): string {
  const segments = path
    .replace(/\[\d+\]/g, "")
    .split(".")
    .map((segment) => segment.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "_").toLowerCase())
    .filter((segment) => segment.length > 0 && segment !== "data" && segment !== "body");
  const tail = segments.slice(-2);
  let base = (tail.length === 2 && ["id", "name", "status"].includes(tail[1]!) ? tail.join("_") : tail.at(-1)) ?? "dato";
  if (!/^[A-Za-z_]/.test(base)) base = `dato_${base}`;
  base = base.slice(0, 50);
  if (!CONTACT_FIELD_KEY_PATTERN.test(base)) base = "dato";

  let candidate = base;
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}_${n}`;
  return candidate;
}
