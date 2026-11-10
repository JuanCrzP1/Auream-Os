import { CURRENCY_NAMES, findCountry } from "@contracts/Countries";
import type { ProductKind, SaleSource, SaleStatus } from "@contracts/SalesContracts";

// Cómo se muestran montos, fechas y nombres en Ventas.

/** «$ 150.000 COP» con los decimales de cada moneda (sin decimales si son ,00). */
export function formatMoney(amount: number, currency: string): string {
  const number = new Intl.NumberFormat("es-CO", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  return `$ ${number} ${currency}`;
}

export const currencyName = (code: string) => CURRENCY_NAMES[code] ?? code;

const DATE_TIME = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const DATE_TIME_YEAR = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function formatSoldAt(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return (date.getFullYear() === now.getFullYear() ? DATE_TIME : DATE_TIME_YEAR).format(date);
}

export function countryLabel(code: string | null): string {
  if (!code) return "";
  const country = findCountry(code);
  return `${country.flag} ${country.name}`;
}

export const SALE_STATUS_LABEL: Readonly<Record<SaleStatus, string>> = { approved: "Aprobada", review: "Por revisar", void: "Anulada" };
export const SALE_SOURCE_LABEL: Readonly<Record<SaleSource, string>> = { receipt: "Flujo", manual: "Asesor", webhook: "Webhook" };
export const PRODUCT_KIND_LABEL: Readonly<Record<ProductKind, string>> = { main: "Principal", upsell: "Upsell", downsell: "Downsell" };
export const PRODUCT_KIND_HINT: Readonly<Record<ProductKind, string>> = {
  main: "Lo que anuncias y vendes primero.",
  upsell: "Se ofrece después de comprar el principal.",
  downsell: "Una opción más barata si no compra el principal."
};

/** `YYYY-MM-DD` de una fecha local. */
export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
