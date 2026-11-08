import type { ToolData } from "../ToolDefinition";
import { readEnum, readString } from "../_kit/read";
import { CURRENCY_CODES } from "../_kit/catalogs";

export type PixelPlatform = "meta";
export type PixelEvent = "lead" | "purchase";

/** Evento de conversión hacia la API de Conversiones de Meta. */
export interface PixelConfig {
  readonly platform: PixelPlatform;
  /** Id del pixel / conjunto de datos de Meta. */
  readonly pixelId: string;
  readonly event: PixelEvent;
  /** Valor de la compra; admite variables. Solo con `purchase`. */
  readonly value: string;
  readonly currency: string;
  /** Página de Facebook asociada (opcional; campañas de clic a WhatsApp). */
  readonly pageId: string;
}

export const PIXEL_DEFAULT_CONFIG: PixelConfig = {
  platform: "meta",
  pixelId: "",
  event: "lead",
  value: "",
  currency: "COP",
  pageId: ""
};

export function readPixelConfig(config: ToolData): PixelConfig {
  return {
    platform: "meta",
    pixelId: readString(config.pixelId).trim(),
    event: readEnum(config.event, ["lead", "purchase"] as const, "lead"),
    value: readString(config.value),
    currency: readEnum(config.currency, CURRENCY_CODES, "COP"),
    pageId: readString(config.pageId).trim()
  };
}

export const PIXEL_EVENT_LABELS: Readonly<Record<PixelEvent, string>> = {
  lead: "Lead",
  purchase: "Compra"
};
