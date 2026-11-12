import type { SalesDashboardResponse, Trend } from "@contracts/DashboardContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { money } from "../../dashboardFormat";
import type { SummaryIconName } from "./SummaryIcon";

// ---------------------------------------------------------------------------
// El resumen del periodo: ocho números con su cambio frente al periodo
// anterior. Función pura (sin React): de la respuesta del Dashboard a lo que
// dice cada tarjeta. Lo que el periodo anterior no permite comparar no lleva
// cambio, y lo que la persona no puede ver (el gasto) no aparece.
// ---------------------------------------------------------------------------

/** good: mejoró · bad: empeoró · flat: igual, o un número que no es bueno ni malo por sí solo (el gasto). */
export type TrendTone = "good" | "bad" | "flat";

export interface SummaryTrend {
  readonly text: string;
  readonly tone: TrendTone;
}

export interface SummaryCard {
  readonly id: string;
  readonly icon: SummaryIconName;
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly trend: SummaryTrend | null;
}

const count = (value: number) => value.toLocaleString("es-CO");
const divide = (a: number, b: number) => (b !== 0 ? a / b : null);

/** El cambio relativo de un número: «▲ 18 %». `neutral` lo pinta gris (subir no es bueno ni malo). */
export function relativeTrend(current: number | null, previous: number | null, sense: "up" | "neutral" = "up"): SummaryTrend | null {
  if (current === null || previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { text: "= igual", tone: "flat" };
  const up = pct > 0;
  return { text: `${up ? "▲" : "▼"} ${count(Math.abs(pct))} %`, tone: sense === "neutral" ? "flat" : up ? "good" : "bad" };
}

/** El cambio de una tasa, en puntos: de 10 % a 15 % es «▲ 5 pts» (no «▲ 50 %»). */
export function pointsTrend(current: number | null, previous: number | null): SummaryTrend | null {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  if (points === 0) return { text: "= igual", tone: "flat" };
  return { text: `${points > 0 ? "▲" : "▼"} ${Math.abs(points)} pts`, tone: points > 0 ? "good" : "bad" };
}

const fromTrend = (trend: Trend, sense: "up" | "neutral" = "up") => relativeTrend(trend.value, trend.previous, sense);

export function summaryCards(view: SalesDashboardResponse): SummaryCard[] {
  const c = view.currency;
  const ads = view.ads;
  const noAds = "Conecta Meta Ads para verlo";
  const organic = Math.max(0, view.leads.value - view.leadsFromAds);

  const cards: Array<SummaryCard | null> = [
    {
      id: "revenue",
      icon: "revenue",
      label: "Facturación",
      value: money(view.revenue.value, c),
      note: view.missingRates.length > 0 ? `Sin cambio para ${view.missingRates.join(", ")}: no suman` : "Todo lo vendido en el periodo",
      trend: fromTrend(view.revenue)
    },
    {
      id: "sales",
      icon: "sales",
      label: "Ventas",
      value: count(view.sales.value),
      note: view.reviewCount > 0 ? `Aprobadas · ${count(view.reviewCount)} por revisar` : "Aprobadas",
      trend: fromTrend(view.sales)
    },
    {
      id: "ticket",
      icon: "ticket",
      label: "Compra promedio",
      value: money(view.averageTicket, c),
      note: "Lo que deja cada venta",
      trend: relativeTrend(view.averageTicket, divide(view.revenue.previous, view.sales.previous))
    },
    view.profit
      ? {
          id: "profit",
          icon: "profit",
          label: "Ganancia",
          value: money(view.profit.value, c),
          note: view.costsKnown ? "Facturación − Meta − costo de productos" : ads ? "Facturación − inversión en Meta" : "Pon el costo de tus productos en Ventas › Productos",
          trend: fromTrend(view.profit)
        }
      : null,
    {
      id: "leads",
      icon: "leads",
      label: "Leads nuevos",
      value: count(view.leads.value),
      note: `${count(view.leadsFromAds)} por anuncio · ${count(organic)} orgánicos`,
      trend: fromTrend(view.leads)
    },
    {
      id: "conversion",
      icon: "conversion",
      label: "Conversión",
      value: view.conversion === null ? "—" : `${Math.round(view.conversion * 100)} %`,
      note: view.conversion === null ? "Aún no hay leads nuevos" : `${count(view.convertedLeads)} de ${count(view.leads.value)} leads compraron`,
      trend: pointsTrend(view.conversion, view.conversionPrevious)
    },
    view.canSeeAds
      ? {
          id: "roas",
          icon: "roas",
          label: "ROAS real",
          value: ads ? formatRoas(ads.roas) : "—",
          note: ads ? `Meta dice ${formatRoas(ads.roasMeta)}` : noAds,
          trend: ads ? relativeTrend(ads.roas, divide(ads.revenue.previous, ads.spend.previous)) : null
        }
      : null,
    view.canSeeAds
      ? {
          id: "spend",
          icon: "spend",
          label: "Inversión en Meta",
          value: ads ? money(ads.spend.value, c) : "—",
          note: ads ? `${count(ads.activeCampaigns)} ${ads.activeCampaigns === 1 ? "campaña activa" : "campañas activas"}` : noAds,
          trend: ads ? fromTrend(ads.spend, "neutral") : null
        }
      : null
  ];
  return cards.filter((card): card is SummaryCard => card !== null);
}
