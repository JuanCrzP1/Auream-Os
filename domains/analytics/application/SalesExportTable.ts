import { COUNTRIES } from "../../../contracts/Countries";
import type { MoneyBook } from "./MoneyBook";
import type { SaleExportRow } from "./SalesExportService";

// ---------------------------------------------------------------------------
// Las columnas de «Descargar ventas», en español y en el orden en que se leen
// en una hoja de cálculo. Los montos van como números (para sumarlos en la
// hoja); lo que no se pudo convertir queda vacío, nunca un número inventado.
// Puro.
// ---------------------------------------------------------------------------

export type ExportValue = string | number | null;

export interface SalesExportTable {
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<ExportValue>>;
  /** La moneda de la columna convertida. */
  readonly currency: string;
  /** Monedas sin tasa ese día (su monto convertido quedó vacío). */
  readonly missingRates: ReadonlyArray<string>;
}

/** Indicativos de más largo a más corto («593» antes que «59…»). */
const DIALS = [...new Set(COUNTRIES.map((country) => country.dial))].sort((a, b) => b.length - a.length);

/**
 * «57 301 381 5302»: con espacios la hoja lo deja como texto (sin «+», que
 * Excel tomaría como fórmula, ni «5,73E+11», como haría con solo dígitos).
 */
export function phoneText(digits: string): string {
  const dial = DIALS.find((code) => digits.startsWith(code)) ?? "";
  const national = digits.slice(dial.length);
  const blocks: string[] = [national.slice(-4)];
  for (let end = national.length - 4; end > 0; end -= 3) blocks.unshift(national.slice(Math.max(0, end - 3), end));
  return [dial, ...blocks].filter(Boolean).join(" ");
}

const SOURCE: Readonly<Record<string, string>> = { receipt: "Comprobante en el chat", manual: "Anotada a mano", webhook: "Integración" };

export function exportTable(rows: ReadonlyArray<SaleExportRow>, book: MoneyBook): SalesExportTable {
  const columns = [
    "Fecha", "Hora", "Cliente", "Teléfono (con indicativo)", "País", "Producto", "Monto", "Moneda", `Monto en ${book.currency}`,
    "Número de WhatsApp", "Origen", "Campaña", "Anuncio", "Cómo se registró", "Comprobante", "Nota", "ID de la venta"
  ];
  const table = rows.map((row) => {
    const converted = book.tryConvert(row.amount, row.currency, row.day);
    return [
      row.day,
      row.time,
      row.customerName,
      row.customerPhone ? phoneText(row.customerPhone) : null,
      row.country,
      row.productName,
      row.amount,
      row.currency,
      converted === null ? null : Math.round(converted * 100) / 100,
      row.connectionName ?? "Anotada a mano",
      row.fromAd ? "Anuncio" : row.hasAdSource ? "Anuncio (cuenta o campaña no conectada)" : "Orgánica",
      row.campaignName,
      row.adName,
      SOURCE[row.source] ?? row.source,
      row.receiptReference,
      row.note || null,
      row.id
    ];
  });
  return { columns, rows: table, currency: book.currency, missingRates: book.missing };
}
