import type { SaleSummary } from "@contracts/SalesContracts";

/** De dónde vino la venta, en palabras: «por anuncio», «por flujo», «anotada por Camilo». */
export function saleOrigin(sale: SaleSummary): string {
  if (sale.source === "manual") return `anotada por ${sale.recordedByName ?? "un asesor"}`;
  if (sale.source === "webhook") return "por webhook";
  return sale.adSourceId ? "por anuncio" : "por flujo";
}

/** Iniciales para el círculo del cliente («Laura Gómez» → «LG»; sin nombre, los 2 últimos dígitos). */
export function initials(sale: SaleSummary): string {
  const words = (sale.customerName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
  return sale.customerPhone ? sale.customerPhone.slice(-2) : "?";
}

/** Un tono estable por cliente (lila, verde agua o ámbar), para que cada fila se distinga. */
export function avatarTone(sale: SaleSummary): "violet" | "teal" | "amber" {
  if (sale.status === "review") return "amber";
  const seed = [...(sale.customerName ?? sale.customerPhone ?? sale.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return seed % 2 === 0 ? "violet" : "teal";
}
