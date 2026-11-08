import { readEnum, readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Pixel — contrato de configuración compartido por el builder (editor) y el
// motor (PixelNodeHandler).
//
// El bloque usa una conexión de píxel de la cuenta (`connectionId`): ni el ID
// del píxel ni el token viven en el flujo. Las versiones anteriores guardaban
// `pixelId` aquí; se ignora al leer.
// ---------------------------------------------------------------------------

export type PixelEvent = "lead" | "purchase";
export const PIXEL_EVENTS: ReadonlyArray<PixelEvent> = ["lead", "purchase"];

export interface PixelConfig {
  /** Conexión de píxel de la cuenta. Vacío = sin configurar. */
  readonly connectionId: string;
  readonly event: PixelEvent;
  /** Valor de la compra; admite variables. Solo con `purchase`. */
  readonly value: string;
  /** ISO 4217. */
  readonly currency: string;
  /**
   * Página de Facebook del anuncio (campañas de clic a WhatsApp). Con ella y
   * el `ctwa_clid` del contacto, el evento se atribuye al anuncio. Admite variables.
   */
  readonly pageId: string;
}

export const PIXEL_DEFAULT_CONFIG: PixelConfig = {
  connectionId: "",
  event: "lead",
  value: "",
  currency: "COP",
  pageId: ""
};

export function readPixelConfig(config: Readonly<Record<string, unknown>>): PixelConfig {
  const currency = readString(config["currency"]).trim().toUpperCase();
  return {
    connectionId: readString(config["connectionId"]).trim(),
    event: readEnum(config["event"], PIXEL_EVENTS, "lead"),
    value: readString(config["value"]),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : PIXEL_DEFAULT_CONFIG.currency,
    pageId: readString(config["pageId"]).trim()
  };
}

export const PIXEL_EVENT_LABELS: Readonly<Record<PixelEvent, string>> = {
  lead: "Lead",
  purchase: "Compra"
};
