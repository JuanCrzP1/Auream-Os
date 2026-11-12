import type { DashboardFilters } from "@contracts/DashboardContracts";
import type { SalesLineSummary } from "@contracts/SalesLineContracts";

// ---------------------------------------------------------------------------
// Qué parte del negocio mira el Dashboard: la línea de venta, los números,
// productos y campañas elegidos a mano y la moneda. Vive en la dirección
// (`line`, `numbers`, `products`, `campaigns`, `currency`) para poder
// compartirla y volver a ella. Puro: sin React.
//
// Una lista `null` = no se eligió a mano: manda la línea (o todo). Lo elegido
// a mano gana sobre la línea, igual que en la API.
// ---------------------------------------------------------------------------

export type Dimension = "connectionIds" | "productIds" | "campaignIds";

export interface ScopeSelection {
  readonly lineId: string | null;
  readonly connectionIds: ReadonlyArray<string> | null;
  readonly productIds: ReadonlyArray<string> | null;
  readonly campaignIds: ReadonlyArray<string> | null;
  readonly currency: string | null;
}

const PARAM: Readonly<Record<Dimension, string>> = { connectionIds: "numbers", productIds: "products", campaignIds: "campaigns" };
export const DIMENSIONS: ReadonlyArray<Dimension> = ["connectionIds", "productIds", "campaignIds"];

/** `*` = «todos, a propósito» (gana sobre la línea). La API lo lee como lista vacía. */
const ALL = "*";
const list = (value: string | null) => (value === null ? null : value === ALL ? [] : value.split(",").map((item) => item.trim()).filter(Boolean));
const asParam = (values: ReadonlyArray<string> | null) => (values === null ? null : values.length === 0 ? ALL : values.join(","));
const asFilter = (values: ReadonlyArray<string>) => (values.length === 0 ? [ALL] : values);

export function readSelection(params: URLSearchParams): ScopeSelection {
  return {
    lineId: params.get("line") || null,
    connectionIds: list(params.get(PARAM.connectionIds)),
    productIds: list(params.get(PARAM.productIds)),
    campaignIds: list(params.get(PARAM.campaignIds)),
    currency: params.get("currency") || null
  };
}

/** Los cambios de la dirección para guardar una selección (`null` borra). */
export function selectionParams(selection: ScopeSelection): Record<string, string | null> {
  return {
    line: selection.lineId,
    numbers: asParam(selection.connectionIds),
    products: asParam(selection.productIds),
    campaigns: asParam(selection.campaignIds),
    currency: selection.currency
  };
}

/** Los filtros que viajan a la API. */
export function selectionFilters(selection: ScopeSelection): Pick<DashboardFilters, "lineId" | Dimension | "currency"> {
  return {
    ...(selection.lineId ? { lineId: selection.lineId } : {}),
    ...(selection.connectionIds !== null ? { connectionIds: asFilter(selection.connectionIds) } : {}),
    ...(selection.productIds !== null ? { productIds: asFilter(selection.productIds) } : {}),
    ...(selection.campaignIds !== null ? { campaignIds: asFilter(selection.campaignIds) } : {}),
    ...(selection.currency ? { currency: selection.currency } : {})
  };
}

/** Lo que de verdad se mira en una dimensión: lo elegido a mano o lo de la línea. Vacío = todo. */
export function effectiveIds(selection: ScopeSelection, line: SalesLineSummary | undefined, dimension: Dimension): ReadonlyArray<string> {
  return selection[dimension] ?? line?.[dimension] ?? [];
}

/** Cuántas dimensiones están recortadas (el número del botón Filtros). */
export function activeFilters(selection: ScopeSelection, line: SalesLineSummary | undefined): number {
  return DIMENSIONS.filter((dimension) => effectiveIds(selection, line, dimension).length > 0).length;
}

/**
 * Marcar o desmarcar un elemento. Se parte de lo que se ve marcado (vacío =
 * todos marcados). Si queda todo marcado, vuelve a «todos» (`[]`).
 */
export function toggleId(current: ReadonlyArray<string>, id: string, all: ReadonlyArray<string>): ReadonlyArray<string> {
  const checked = current.length === 0 ? [...all] : [...current];
  const next = checked.includes(id) ? checked.filter((item) => item !== id) : [...checked, id];
  return next.length === all.length && all.every((item) => next.includes(item)) ? [] : next;
}

/** Elegir una línea borra lo elegido a mano (la línea manda); la moneda se queda. */
export function chooseLine(selection: ScopeSelection, lineId: string | null): ScopeSelection {
  return { lineId, connectionIds: null, productIds: null, campaignIds: null, currency: selection.currency };
}
