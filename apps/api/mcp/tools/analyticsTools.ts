import { AD_LEVELS, type DashboardFilters } from "../../../../contracts/DashboardContracts";
import type { AdsDashboardService } from "../../../../domains/analytics/application/AdsDashboardService";
import type { AttentionDashboardService } from "../../../../domains/analytics/application/AttentionDashboardService";
import type { SalesDashboardService } from "../../../../domains/analytics/application/SalesDashboardService";
import type { McpInputSchema, McpTool } from "../McpTool";
import { defined, textArg, type ToolArgs } from "./toolArgs";

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
}

const PERIOD = "Fecha `YYYY-MM-DD` en la zona horaria de la empresa. Sin fechas: los últimos 30 días (hasta un año).";

const filterProperties: McpInputSchema["properties"] = {
  from: { type: "string", description: `Desde. ${PERIOD}` },
  to: { type: "string", description: `Hasta. ${PERIOD}` },
  connection_id: { type: "string", description: "Solo un número (de list_connections)." }
};

function filtersOf(args: ToolArgs): DashboardFilters {
  return defined({ from: textArg(args, "from"), to: textArg(args, "to"), connectionId: textArg(args, "connection_id"), productId: textArg(args, "product_id") });
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
      inputSchema: { type: "object", properties: { ...filterProperties, product_id: { type: "string", description: "Solo un producto (de list_products)." } } },
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
    }
  ];
}
