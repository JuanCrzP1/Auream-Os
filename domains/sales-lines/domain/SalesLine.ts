import { SALES_LINE_COLORS, SALES_LINE_NAME_MAX, type SaveSalesLineRequest } from "../../../contracts/SalesLineContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Una línea de venta: reglas puras. Nombre de 1 a 40, un color de la paleta,
// y qué junta (productos, números y campañas de Meta). Debe tener al menos un
// producto o una campaña: una línea sin nada mediría todo el negocio.
// ---------------------------------------------------------------------------

export interface SalesLine {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly color: string;
  readonly productIds: ReadonlyArray<string>;
  readonly connectionIds: ReadonlyArray<string>;
  readonly campaignIds: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lo que se guarda de una línea, ya validado. */
export type SalesLineDraft = Pick<SalesLine, "name" | "color" | "productIds" | "connectionIds" | "campaignIds">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Ids de campaña del proveedor de anuncios (Meta usa dígitos): se respetan mayúsculas. */
export const CAMPAIGN_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const MAX_ITEMS = 200;

function ids(value: unknown, valid: RegExp, what: string, normalize: (item: string) => string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`«${what}» debe ser una lista.`);
  const list = [...new Set(value.map((item) => normalize(String(item).trim())).filter(Boolean))];
  if (list.length > MAX_ITEMS) throw new ValidationError(`Una línea admite hasta ${MAX_ITEMS} ${what}.`);
  if (list.some((item) => !valid.test(item))) throw new ValidationError(`Hay ${what} que no existen o no son válidos.`);
  return list;
}

const lower = (item: string) => item.toLowerCase();
const asIs = (item: string) => item;

export function salesLineDraft(input: Partial<SaveSalesLineRequest>): SalesLineDraft {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new ValidationError("Ponle un nombre a la línea (p. ej. «Venezuela»).");
  if (name.length > SALES_LINE_NAME_MAX) throw new ValidationError(`El nombre admite hasta ${SALES_LINE_NAME_MAX} caracteres.`);
  const color = typeof input.color === "string" ? input.color.trim().toLowerCase() : SALES_LINE_COLORS[0];
  if (!(SALES_LINE_COLORS as ReadonlyArray<string>).includes(color)) throw new ValidationError("Elige uno de los colores de la lista.");
  const productIds = ids(input.productIds, UUID, "productos", lower);
  const campaignIds = ids(input.campaignIds, CAMPAIGN_ID, "campañas", asIs);
  if (productIds.length === 0 && campaignIds.length === 0) throw new ValidationError("Elige al menos un producto o una campaña: si no, la línea sería todo el negocio.");
  return { name, color, productIds, connectionIds: ids(input.connectionIds, UUID, "números", lower), campaignIds };
}
