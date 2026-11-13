import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { money } from "../../dashboardFormat";
import type { SummaryCard } from "./summaryCards";
import { count, relativeTrend } from "./summaryTrends";

// ---------------------------------------------------------------------------
// La tarjeta de inversión (pura): sin otros gastos es «Inversión en Meta»
// como siempre; con otros gastos se llama «Inversión» y deja elegir qué ver:
// Meta, Otros o Todo. Siempre lleva el enlace a «Otros gastos» (ahí se crean).
// ---------------------------------------------------------------------------

export type InvestmentMode = "meta" | "other" | "all";
export const INVESTMENT_MODES: ReadonlyArray<readonly [InvestmentMode, string]> = [["meta", "Meta"], ["other", "Otros"], ["all", "Todo"]];

const NO_ADS = "Conecta Meta Ads para verlo";
/** La línea elegida no tiene campañas: su gasto no se conoce (no es que no haya Meta). */
export const LINE_WITHOUT_CAMPAIGNS = "Esta línea no tiene campañas";

export function investmentCard(view: SalesDashboardResponse, mode: InvestmentMode): SummaryCard | null {
  if (!view.canSeeAds) return null;
  const c = view.currency;
  const ads = view.ads;
  const other = view.otherSpend;
  const campaigns = ads ? `${count(ads.activeCampaigns)} ${ads.activeCampaigns === 1 ? "campaña activa" : "campañas activas"}` : view.lineWithoutCampaigns ? LINE_WITHOUT_CAMPAIGNS : NO_ADS;
  const base = { id: "spend", icon: "spend" as const, action: { id: "expenses" as const, label: "Otros gastos" } };

  if (!other) {
    return { ...base, label: "Inversión en Meta", value: ads ? money(ads.spend.value, c) : "—", note: campaigns, trend: ads ? relativeTrend(ads.spend.value, ads.spend.previous, "neutral") : null };
  }

  const modes = { current: mode, options: INVESTMENT_MODES };
  if (mode === "meta") {
    return { ...base, modes, label: "Inversión", value: ads ? money(ads.spend.value, c) : "—", note: campaigns, trend: ads ? relativeTrend(ads.spend.value, ads.spend.previous, "neutral") : null };
  }
  if (mode === "other") {
    const names = view.otherExpenses.map((expense) => expense.name);
    const note = `${count(names.length)} ${names.length === 1 ? "gasto" : "gastos"}: ${names.join(", ")}`;
    return { ...base, modes, label: "Inversión", value: money(other.value, c), note, trend: relativeTrend(other.value, other.previous, "neutral") };
  }
  const meta = ads?.spend ?? { value: 0, previous: 0 };
  return {
    ...base,
    modes,
    label: "Inversión",
    value: money(meta.value + other.value, c),
    note: `Meta ${money(meta.value, c)} · otros ${money(other.value, c)}`,
    trend: relativeTrend(meta.value + other.value, meta.previous + other.previous, "neutral")
  };
}

/** Qué se restó para llegar a la ganancia. */
export function profitNote(view: SalesDashboardResponse): string {
  if (!view.otherSpend) {
    if (view.costsKnown) return "Facturación − Meta − costo de productos";
    return view.ads ? "Facturación − inversión en Meta" : "Pon el costo de tus productos en Ventas › Productos";
  }
  return ["Facturación", view.ads ? "Meta" : null, "otros gastos", view.costsKnown ? "costo de productos" : null].filter(Boolean).join(" − ");
}
