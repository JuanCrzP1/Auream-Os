import type { AdDailyInsight, AdEntity } from "../../domains/ads/domain/AdAccount";
import type { AdLevel } from "../../contracts/DashboardContracts";

// ---------------------------------------------------------------------------
// Cómo se leen las respuestas de la Marketing API (sin red: se prueba solo).
// https://developers.facebook.com/docs/marketing-api/insights
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Action = { action_type?: unknown; value?: unknown };

const num = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Conversaciones iniciadas por anuncios de clic a WhatsApp (ventana de 7 días de Meta). */
const CONVERSATION_ACTIONS = ["onsite_conversion.messaging_conversation_started_7d"];
/** Compras que vio el Píxel. Meta repite la misma compra con varios nombres: se toma la mayor, no la suma. */
const PURCHASE_ACTIONS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];

function largest(list: unknown, types: ReadonlyArray<string>): number {
  if (!Array.isArray(list)) return 0;
  return (list as Action[]).filter((action) => types.includes(String(action.action_type))).reduce((max, action) => Math.max(max, num(action.value)), 0);
}

export function parseInsight(row: Row): AdDailyInsight | null {
  const adId = text(row["ad_id"]);
  const day = text(row["date_start"]);
  if (!adId || !day) return null;
  return {
    adId,
    day,
    spend: Math.round(num(row["spend"]) * 100) / 100,
    impressions: Math.round(num(row["impressions"])),
    clicks: Math.round(num(row["clicks"])),
    conversations: Math.round(largest(row["actions"], CONVERSATION_ACTIONS)),
    metaPurchases: Math.round(largest(row["actions"], PURCHASE_ACTIONS)),
    metaRevenue: Math.round(largest(row["action_values"], PURCHASE_ACTIONS) * 100) / 100
  };
}

/**
 * Presupuesto diario: Meta lo da en la unidad mínima de la moneda (centavos),
 * salvo en monedas sin decimales (COP, CLP, JPY…), que van enteras.
 */
const NO_DECIMALS = new Set(["COP", "CLP", "PYG", "JPY", "KRW", "VND", "ISK", "HUF", "TWD", "IDR"]);

export function parseBudget(value: unknown, currency: string): number | null {
  const raw = num(value);
  if (raw <= 0) return null;
  return NO_DECIMALS.has(currency) ? raw : raw / 100;
}

export function parseEntity(row: Row, level: AdLevel, currency: string): AdEntity | null {
  const id = text(row["id"]);
  if (!id) return null;
  const creative = (row["creative"] ?? {}) as Row;
  return {
    level,
    externalId: id,
    parentId: level === "ad" ? text(row["adset_id"]) : level === "adset" ? text(row["campaign_id"]) : null,
    campaignId: level === "campaign" ? id : text(row["campaign_id"]),
    name: text(row["name"]) ?? id,
    status: text(row["effective_status"]) ?? "UNKNOWN",
    dailyBudget: parseBudget(row["daily_budget"], currency),
    thumbnailUrl: text(creative["thumbnail_url"])
  };
}
