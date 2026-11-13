import type { SalesDashboardResponse, Trend } from "@contracts/DashboardContracts";
import { salesUnknown } from "@contracts/AdMeasurementContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { money } from "../../dashboardFormat";
import { investmentCard, profitNote, type InvestmentMode, LINE_WITHOUT_CAMPAIGNS } from "./investmentCard";
import { count, divide, pointsTrend, relativeTrend, type SummaryTrend } from "./summaryTrends";
import type { SummaryIconName } from "./SummaryIcon";

export { pointsTrend, relativeTrend, type SummaryTrend, type TrendTone } from "./summaryTrends";

// ---------------------------------------------------------------------------
// El resumen del periodo: ocho números con su cambio frente al periodo
// anterior. Función pura (sin React): de la respuesta del Dashboard a lo que
// dice cada tarjeta. Lo que el periodo anterior no permite comparar no lleva
// cambio, y lo que la persona no puede ver (el gasto) no aparece.
// ---------------------------------------------------------------------------

export interface SummaryCard {
  readonly id: string;
  readonly icon: SummaryIconName;
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly trend: SummaryTrend | null;
  /** Qué se puede elegir ver en la tarjeta (la inversión: Meta · Otros · Todo). */
  readonly modes?: { readonly current: InvestmentMode; readonly options: ReadonlyArray<readonly [InvestmentMode, string]> };
  /** Un enlace dentro de la tarjeta (la inversión: «Otros gastos»). */
  readonly action?: { readonly id: "expenses"; readonly label: string };
}

const fromTrend = (trend: Trend, sense: "up" | "neutral" = "up") => relativeTrend(trend.value, trend.previous, sense);

/** `investment`: qué muestra la tarjeta de inversión cuando hay otros gastos. */
export function summaryCards(view: SalesDashboardResponse, investment: InvestmentMode = "all"): SummaryCard[] {
  const c = view.currency;
  const ads = view.ads;
  const noAds = view.lineWithoutCampaigns ? LINE_WITHOUT_CAMPAIGNS : "Conecta Meta Ads para verlo";
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
          note: profitNote(view),
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
          note: ads ? `${salesUnknown(ads.measurement, ads.attributedSales) ? "Sin medir · " : ""}Meta dice ${formatRoas(ads.roasMeta)}` : noAds,
          trend: ads ? relativeTrend(ads.roas, divide(ads.revenue.previous, ads.spend.previous)) : null
        }
      : null,
    investmentCard(view, investment)
  ];
  return cards.filter((card): card is SummaryCard => card !== null);
}
