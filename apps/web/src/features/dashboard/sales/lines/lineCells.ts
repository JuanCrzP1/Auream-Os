import type { LineComparisonRow } from "@contracts/LineComparisonContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { money, trendText } from "../../dashboardFormat";

// ---------------------------------------------------------------------------
// Las columnas de «Comparar líneas»: con el gasto (dueños y administradores)
// la plata de cada línea; sin él, solo lo vendido. Puro: texto y tono de
// cada celda.
// ---------------------------------------------------------------------------

export interface Cell {
  readonly text: string;
  /** El cambio frente al periodo anterior («▲ 18 %»). */
  readonly trend?: { readonly text: string; readonly tone: "good" | "bad" | "flat" } | null;
  readonly tone?: "good" | "bad" | "muted";
  /** Lo que se lee al pasar el mouse (por qué falta un número). */
  readonly hint?: string;
}

export interface Column {
  readonly id: string;
  readonly label: string;
  readonly cell: (row: LineComparisonRow, currency: string) => Cell;
}

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);
/** Un margen de «-9393 %» no dice nada: pasando de perder lo vendido, «menos de -100 %». */
const marginText = (value: number | null) => (value !== null && value < -1 ? "< -100 %" : percent(value));
const NO_CAMPAIGNS = "Esta línea no tiene campañas: ponle las suyas para saber su gasto y su ROAS.";

const revenue: Column = { id: "revenue", label: "Facturación", cell: (row, c) => ({ text: money(row.revenue.value, c), trend: trendText(row.revenue) }) };
const sales: Column = { id: "sales", label: "Ventas", cell: (row) => ({ text: row.sales.toLocaleString("es-CO") }) };

export const MONEY_COLUMNS: ReadonlyArray<Column> = [
  revenue,
  sales,
  {
    id: "spend",
    label: "Gasto en Meta",
    cell: (row, c) => (row.spend === null ? { text: row.hasCampaigns ? "—" : "Sin campañas", tone: "muted", hint: row.hasCampaigns ? undefined : NO_CAMPAIGNS } : { text: money(row.spend, c) })
  },
  {
    id: "roas",
    label: "ROAS real",
    cell: (row) => (row.roas === null ? { text: "—", tone: "muted", hint: row.hasCampaigns ? undefined : NO_CAMPAIGNS } : { text: formatRoas(row.roas), tone: row.roas < 1 ? "bad" : row.roas >= 3 ? "good" : undefined })
  },
  { id: "other", label: "Otros gastos", cell: (row, c) => ({ text: row.otherSpend ? money(row.otherSpend, c) : "—", tone: row.otherSpend ? undefined : "muted" }) },
  {
    id: "profit",
    label: "Ganancia",
    cell: (row, c) => (row.profit === null ? { text: "—", tone: "muted" } : { text: money(row.profit.value, c), trend: trendText(row.profit), tone: row.profit.value < 0 ? "bad" : "good" })
  },
  { id: "margin", label: "Margen", cell: (row) => ({ text: marginText(row.margin), tone: row.margin === null ? "muted" : row.margin < 0 ? "bad" : undefined }) }
];

export const SALES_COLUMNS: ReadonlyArray<Column> = [
  revenue,
  sales,
  { id: "ticket", label: "Compra promedio", cell: (row, c) => ({ text: money(row.averageTicket, c) }) },
  { id: "share", label: "Del negocio", cell: (row) => ({ text: percent(row.share) }) }
];

/** La frase de la tarjeta: cuál deja más y cuál pierde. */
export function verdict(rows: ReadonlyArray<LineComparisonRow>, canSeeAds: boolean, currency: string): string | null {
  if (rows.length < 2) return null;
  if (!canSeeAds) return `${rows[0]!.name} es la que más vende: ${money(rows[0]!.revenue.value, currency)}.`;
  const best = rows[0]!;
  const losing = rows.filter((row) => (row.profit?.value ?? 0) < 0);
  if (losing.length === rows.length) return "Todas tus líneas pierden plata en este periodo: revisa su gasto y sus otros gastos.";
  const head = `${best.name} es la que más te deja: ${money(best.profit?.value ?? 0, currency)}.`;
  if (losing.length === 0) return head;
  return `${head} ${losing.length === 1 ? `${losing[0]!.name} pierde plata` : `${losing.map((row) => row.name).join(" y ")} pierden plata`}: revisa su gasto.`;
}
