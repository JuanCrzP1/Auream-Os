import { COUNTRY_CODES_ISO, CURRENCY_CODES, findCountry } from "../../../contracts/Countries";
import {
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  type ProductKind,
  type ProductPrice,
  type ProductStatus,
  type SaveProductRequest
} from "../../../contracts/SalesContracts";
import { parseAmount } from "../../../flow-engine/values/parseAmount";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Producto: lo que vende la cuenta. Un precio por país (en la moneda de ese
// país o la que el negocio cobre allí, como USD en Venezuela). El catálogo lo
// usan Ventas, los flujos (Comprobante), los Agentes de IA y Meta Ads.
// ---------------------------------------------------------------------------

export interface Product {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly prices: ReadonlyArray<ProductPrice>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lo que se guarda de un producto, ya validado. */
export interface ProductDraft {
  readonly name: string;
  readonly description: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly prices: ReadonlyArray<ProductPrice>;
}

export const PRODUCT_NAME_MAX = 80;
export const PRODUCT_DESCRIPTION_MAX = 500;
/** Un precio por país; hay 17 países, y nadie vende en más. */
export const PRODUCT_PRICES_MAX = COUNTRY_CODES_ISO.length;
/** Tope de monto: cabe en `numeric(14,2)` y en cualquier moneda de la lista. */
export const AMOUNT_MAX = 999_999_999_999;
/** Tope del catálogo por cuenta. */
export const PRODUCTS_PER_TENANT_MAX = 300;

/**
 * Un monto de dinero: positivo, con hasta 2 decimales. El texto se lee con la
 * MISMA regla del Comprobante y de Ventas («49.900» = 49900, «12,5» = 12.5).
 */
export function normalizeAmount(value: unknown, label = "El monto"): number {
  const amount = typeof value === "string" ? parseAmount(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) throw new ValidationError(`${label} debe ser mayor que cero.`);
  if (amount > AMOUNT_MAX) throw new ValidationError(`${label} es demasiado grande.`);
  return Math.round(amount * 100) / 100;
}

export function normalizeCurrency(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CURRENCY_CODES.includes(code)) throw new ValidationError("Elige una moneda de la lista.");
  return code;
}

export function normalizeCountry(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!COUNTRY_CODES_ISO.includes(code)) throw new ValidationError("Elige un país de la lista.");
  return code;
}

/** El costo (opcional): cero o más, con la misma regla de montos. Vacío: no se sabe. */
function normalizeCost(value: unknown, countryName: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const cost = typeof value === "string" ? parseAmount(value) : value;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) throw new ValidationError(`El costo en ${countryName} debe ser cero o más.`);
  if (cost > AMOUNT_MAX) throw new ValidationError(`El costo en ${countryName} es demasiado grande.`);
  return Math.round(cost * 100) / 100;
}

function normalizePrices(value: unknown): ReadonlyArray<ProductPrice> {
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError("Pon el precio en al menos un país.");
  if (value.length > PRODUCT_PRICES_MAX) throw new ValidationError("Hay demasiados precios.");
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    const record = (raw ?? {}) as Record<string, unknown>;
    const country = normalizeCountry(record["country"]);
    if (seen.has(country)) throw new ValidationError(`${findCountry(country).name} tiene dos precios: deja uno.`);
    seen.add(country);
    return {
      country,
      currency: record["currency"] ? normalizeCurrency(record["currency"]) : findCountry(country).currency,
      amount: normalizeAmount(record["amount"], `El precio en ${findCountry(country).name}`),
      cost: normalizeCost(record["cost"], findCountry(country).name)
    };
  });
}

function oneOf<T extends string>(value: unknown, options: ReadonlyArray<T>, fallback: T, message: string): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" && (options as ReadonlyArray<string>).includes(value)) return value as T;
  throw new ValidationError(message);
}

/** Valida y limpia lo que manda el editor de productos. */
export function productDraft(input: Partial<SaveProductRequest>): ProductDraft {
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new ValidationError("Escribe el nombre del producto.");
  if (name.length > PRODUCT_NAME_MAX) throw new ValidationError(`El nombre puede tener hasta ${PRODUCT_NAME_MAX} caracteres.`);
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > PRODUCT_DESCRIPTION_MAX) throw new ValidationError(`La descripción puede tener hasta ${PRODUCT_DESCRIPTION_MAX} caracteres.`);
  return {
    name,
    description,
    kind: oneOf(input.kind, PRODUCT_KINDS, "main", "Elige si es principal, upsell o downsell."),
    status: oneOf(input.status, PRODUCT_STATUSES, "active", "El estado no es válido."),
    prices: normalizePrices(input.prices)
  };
}

/** El precio del producto en un país, si lo vende allí. */
export function priceIn(product: Pick<Product, "prices">, country: string | null): ProductPrice | null {
  if (!country) return null;
  return product.prices.find((price) => price.country === country) ?? null;
}
