import { AD_LEVELS, type DashboardFilters } from "../../../../contracts/DashboardContracts";
import type { AdsDashboardService } from "../../../../domains/analytics/application/AdsDashboardService";
import type { AttentionDashboardService } from "../../../../domains/analytics/application/AttentionDashboardService";
import type { LineComparisonService } from "../../../../domains/analytics/application/LineComparisonService";
import type { SalesDashboardService } from "../../../../domains/analytics/application/SalesDashboardService";
import type { McpInputSchema, McpTool } from "../McpTool";
import { defined, stringListArg, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// El Dashboard (área «Dashboard y anuncios», solo ver: `analytics.read` y
// `ads.read`). Los mismos números que la pantalla: ROAS real (ventas de
// Auream contra el gasto de Meta, por el anuncio del que llegó cada cliente),
// el embudo del anuncio a la venta, qué hacer con cada campaña y la atención.
// ---------------------------------------------------------------------------

export interface DashboardToolServices {
  readonly sales: Pick<SalesDashboardService, "overview">;
  readonly ads: Pick<AdsDashboardService, "performance">;
  readonly attention: Pick<AttentionDashboardService, "overview">;
  readonly lines?: Pick<LineComparisonService, "compare">;
}

const PERIOD = "Fecha `YYYY-MM-DD` en la zona horaria de la empresa. Sin fechas: los últimos 30 días (hasta un año).";

const filterProperties: McpInputSchema["properties"] = {
  from: { type: "string", description: `Desde. ${PERIOD}` },
  to: { type: "string", description: `Hasta. ${PERIOD}` },
  line_id: { type: "string", description: "Solo una línea de venta (de list_sales_lines): sus productos, números y campañas." },
  connection_ids: { type: "array", items: { type: "string" }, description: "Solo estos números (de list_connections). Gana sobre la línea." },
  product_ids: { type: "array", items: { type: "string" }, description: "Solo estos productos (de list_products). Gana sobre la línea." },
  campaign_ids: { type: "array", items: { type: "string" }, description: "Solo estas campañas de Meta: su gasto y las ventas que trajeron. Gana sobre la línea." },
  currency: { type: "string", description: "Moneda en que ver los montos (COP, USD, VES…). Sin ella: la de la cuenta de anuncios o la más vendida." }
};

function filtersOf(args: ToolArgs): DashboardFilters {
  return defined({
    from: textArg(args, "from"),
    to: textArg(args, "to"),
    lineId: textArg(args, "line_id"),
    connectionIds: stringListArg(args, "connection_ids"),
    productIds: stringListArg(args, "product_ids"),
    campaignIds: stringListArg(args, "campaign_ids"),
    currency: textArg(args, "currency")
  });
}

export function analyticsTools(dashboard: DashboardToolServices): McpTool[] {
  return [
    {
      name: "dashboard_sales",
      title: "Dashboard: ventas y ROAS real",
      description:
        "Ventas del periodo y su comparación con el anterior: facturación, ventas, compra promedio, ganancia (facturación − inversión en Meta − costos si se conocen), ROAS real (y el que reporta Meta), facturación por anuncios, gasto en Meta, costo por venta y por chat, leads nuevos, conversión (de los leads nuevos, cuántos compraron: `conversion`, `convertedLeads`), el embudo del anuncio a la venta, qué hacer con cada campaña (escalar, revisar, apagar) y ventas por hora, número, producto y país.",
      scope: "analytics.read",
      readOnly: true,
      inputSchema: { type: "object", properties: filterProperties },
      run: async (args, { tenantId }) => dashboard.sales.overview({ tenantId, canSeeAds: true }, filtersOf(args))
    },
    {
      name: "dashboard_ads",
      title: "Dashboard: anuncios de Meta",
      description: "Rendimiento de los anuncios de Meta en el periodo por campaña, conjunto o anuncio: gasto, alcance, clics, chats, ventas reales de Auream, ROAS real frente al de Meta y costo por venta.",
      scope: "ads.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { ...filterProperties, level: { type: "string", description: "campaign (por defecto), adset o ad.", enum: AD_LEVELS } } },
      run: async (args, { tenantId }) => dashboard.ads.performance(tenantId, filtersOf(args), textArg(args, "level"))
    },
    {
      name: "dashboard_attention",
      title: "Dashboard: atención",
      description:
        "Cómo se atiende en el periodo: leads, cuántos atendieron asesores y cuántos solo el bot, chats sin responder (y desde cuándo espera el más viejo), tiempo de primera respuesta frente al periodo anterior, horas y días con más mensajes, y el detalle por asesor y por número.",
      scope: "analytics.read",
      readOnly: true,
      inputSchema: { type: "object", properties: filterProperties },
      run: async (args, { tenantId }) => dashboard.attention.overview(tenantId, filtersOf(args))
    },
    ...(dashboard.lines ? [compareLinesTool(dashboard.lines)] : [])
  ];
}

function compareLinesTool(lines: Pick<LineComparisonService, "compare">): McpTool {
  return {
    name: "dashboard_compare_lines",
    title: "Dashboard: comparar líneas de venta",
    description:
      "Cada línea de venta (de list_sales_lines) en el mismo periodo y moneda: facturación y su cambio, ventas, compra promedio, qué parte del negocio es, gasto en Meta de sus campañas, ROAS real, otros gastos, ganancia y margen, de la que más gana a la que menos; al final, todo el negocio. Una línea sin campañas no tiene gasto conocido (`spend: null`). `overlapping: true` = las líneas se pisan (un producto o campaña en dos) y su suma pasa del total.",
    scope: "ads.read",
    readOnly: true,
    inputSchema: { type: "object", properties: { from: filterProperties.from!, to: filterProperties.to!, currency: filterProperties.currency! } },
    run: async (args, { tenantId }) => lines.compare({ tenantId, canSeeAds: true }, defined({ from: textArg(args, "from"), to: textArg(args, "to"), currency: textArg(args, "currency") }))
  };
}
