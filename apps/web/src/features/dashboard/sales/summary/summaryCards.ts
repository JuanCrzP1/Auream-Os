import type { SalesDashboardResponse, Trend } from "@contracts/DashboardContracts";
import { salesUnknown } from "@contracts/AdMeasurementContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { META_REPORTS, metaBeside, perUnit, purchasesText, WAITS_FOR_AD_SALES, WAITS_FOR_SALES } from "@shared/ads/metaSource";
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
// Lo de Auream y lo de Meta con la regla de `@shared/ads/metaSource`: sin
// ventas en Auream, lo que Meta reporta va con la etiqueta «Meta» y la
// ganancia y la conversión esperan a las ventas reales (nunca $0 ni pérdida).
// ---------------------------------------------------------------------------

export interface SummaryCard {
  readonly id: string;
  readonly icon: SummaryIconName;
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly trend: SummaryTrend | null;
  /** El número lo reporta Meta (lleva la etiqueta «Meta»); sin esto, es de Auream. */
  readonly source?: "meta";
  /** Con el número de Auream, lo que dice Meta al lado («Meta: 21 compras»). */
  readonly beside?: string;
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
  // Auream no ve las ventas de los anuncios: la ganancia espera. Sin ninguna venta en Auream, lo vendido es lo que reporta Meta.
  const blind = ads !== null && salesUnknown(ads.measurement, ads.attributedSales);
  const meta = blind && view.sales.value === 0 ? ads : null;
  const metaTicket = meta ? perUnit(meta.metaRevenue, meta.metaPurchases) : null;
  // Con ventas en Auream (y Meta conectado), lo de Meta va al lado del número de Auream.
  const beside = (text: (a: NonNullable<typeof ads>) => string) => (ads && !meta ? { beside: metaBeside(text(ads)) } : {});

  const cards: Array<SummaryCard | null> = [
    meta
      ? { id: "revenue", icon: "revenue", label: "Facturación", value: money(meta.metaRevenue, c), note: META_REPORTS, trend: null, source: "meta" }
      : {
          id: "revenue",
          icon: "revenue",
          label: "Facturación",
          value: money(view.revenue.value, c),
          note: view.missingRates.length > 0 ? `Sin cambio para ${view.missingRates.join(", ")}: no suman` : "Lo vendido y anotado en Auream",
          trend: fromTrend(view.revenue),
          ...beside((a) => money(a.metaRevenue, c))
        },
    meta
      ? { id: "sales", icon: "sales", label: "Ventas", value: count(meta.metaPurchases), note: "Compras que vio Meta", trend: null, source: "meta" }
      : {
          id: "sales",
          icon: "sales",
          label: "Ventas",
          value: count(view.sales.value),
          note: view.reviewCount > 0 ? `Aprobadas en Auream · ${count(view.reviewCount)} por revisar` : "Aprobadas en Auream",
          trend: fromTrend(view.sales),
          ...beside((a) => purchasesText(a.metaPurchases))
        },
    meta
      ? { id: "ticket", icon: "ticket", label: "Compra promedio", value: money(metaTicket, c), note: metaTicket === null ? WAITS_FOR_SALES : META_REPORTS, trend: null, ...(metaTicket === null ? {} : { source: "meta" as const }) }
      : {
          id: "ticket",
          icon: "ticket",
          label: "Compra promedio",
          value: money(view.averageTicket, c),
          note: "Lo que deja cada venta",
          trend: relativeTrend(view.averageTicket, divide(view.revenue.previous, view.sales.previous)),
          ...beside((a) => money(perUnit(a.metaRevenue, a.metaPurchases), c))
        },
    view.profit
      ? {
          id: "profit",
          icon: "profit",
          label: "Ganancia",
          value: blind ? "—" : money(view.profit.value, c),
          note: blind ? WAITS_FOR_AD_SALES : profitNote(view),
          trend: blind ? null : fromTrend(view.profit)
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
      value: meta || view.conversion === null ? "—" : `${Math.round(view.conversion * 100)} %`,
      note: meta ? WAITS_FOR_SALES : view.conversion === null ? "Aún no hay leads nuevos" : `${count(view.convertedLeads)} de ${count(view.leads.value)} leads compraron`,
      trend: meta ? null : pointsTrend(view.conversion, view.conversionPrevious)
    },
    roasCard(view, blind, noAds),
    investmentCard(view, investment)
  ];
  return cards.filter((card): card is SummaryCard => card !== null);
}

/** Con ventas de los anuncios en Auream, el ROAS real (y Meta al lado); sin ellas, el que reporta Meta, con su etiqueta. */
function roasCard(view: SalesDashboardResponse, blind: boolean, noAds: string): SummaryCard | null {
  if (!view.canSeeAds) return null;
  const ads = view.ads;
  const base = { id: "roas", icon: "roas" as const };
  if (!ads) return { ...base, label: "ROAS real", value: "—", note: noAds, trend: null };
  if (blind) {
    return ads.roasMeta === null
      ? { ...base, label: "ROAS real", value: "—", note: WAITS_FOR_AD_SALES, trend: null }
      : { ...base, label: "ROAS", value: formatRoas(ads.roasMeta), note: META_REPORTS, trend: null, source: "meta" };
  }
  return {
    ...base,
    label: "ROAS real",
    value: formatRoas(ads.roas),
    note: metaBeside(formatRoas(ads.roasMeta)),
    trend: relativeTrend(ads.roas, divide(ads.revenue.previous, ads.spend.previous))
  };
}
