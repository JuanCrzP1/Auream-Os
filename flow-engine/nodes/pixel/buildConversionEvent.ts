import type { PixelConfig } from "../../../contracts/PixelConfig";
import { renderTemplate, type VariableResolver } from "../../../contracts/TemplateVariables";
import type { ConversionEvent } from "../../ports/ConversionTracker";
import { parseAmount } from "./parseAmount";

// ---------------------------------------------------------------------------
// De la configuración del bloque Pixel a un evento de conversión. Pura.
//
// Atribución al anuncio (como Leona): si el contacto llegó por un anuncio de
// clic a WhatsApp (`ctwa_clid` en sus datos) y el bloque indica la página, el
// evento va como `business_messaging` y el Lead se llama `LeadSubmitted`.
// Si no, es una conversión de `chat`.
// ---------------------------------------------------------------------------

export type ConversionBuildFailure = "not_configured" | "invalid_value" | "invalid_page";

export interface ConversionContext {
  readonly resolve: VariableResolver;
  /** Id del contacto en Auream (o su identidad en el canal si no hay contacto). */
  readonly externalId: string;
  /** Id único del evento (descarta duplicados en Meta). */
  readonly eventId: string;
  readonly now: Date;
}

export type ConversionBuild =
  | { readonly ok: true; readonly event: ConversionEvent; readonly missingVariables: ReadonlyArray<string> }
  | { readonly ok: false; readonly reason: ConversionBuildFailure; readonly message: string; readonly missingVariables: ReadonlyArray<string> };

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined);

export function buildConversionEvent(config: PixelConfig, context: ConversionContext): ConversionBuild {
  const missing = new Set<string>();
  const render = (template: string) => {
    const rendered = renderTemplate(template, context.resolve);
    rendered.missing.forEach((name) => missing.add(name));
    return rendered.text.trim();
  };
  const fail = (reason: ConversionBuildFailure, message: string): ConversionBuild => ({ ok: false, reason, message, missingVariables: [...missing] });

  if (!config.connectionId) return fail("not_configured", "El bloque no tiene un píxel elegido.");

  let value: number | undefined;
  if (config.event === "purchase") {
    const rendered = render(config.value);
    const parsed = parseAmount(rendered);
    if (parsed === null) {
      return fail("invalid_value", rendered ? `El valor de la compra no es un número válido: «${rendered.slice(0, 40)}».` : "El valor de la compra está vacío.");
    }
    value = parsed;
  }

  const pageId = config.pageId ? render(config.pageId) : "";
  if (pageId && !/^\d{5,25}$/.test(pageId)) return fail("invalid_page", "El ID de la página de Facebook debe ser solo números.");

  const ctwaClid = text(context.resolve("ctwa_clid"));
  const fromAd = Boolean(ctwaClid && pageId);
  const fullName = text(context.resolve("full_name")) ?? "";
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const phone = text(context.resolve("phone"));
  const email = text(context.resolve("email"));

  const event: ConversionEvent = {
    name: config.event === "purchase" ? "Purchase" : fromAd ? "LeadSubmitted" : "Lead",
    eventId: context.eventId,
    eventTime: Math.floor(context.now.getTime() / 1000),
    actionSource: fromAd ? "business_messaging" : "chat",
    user: {
      externalId: context.externalId,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(firstName ? { firstName } : {}),
      ...(rest.length > 0 ? { lastName: rest.join(" ") } : {}),
      ...(fromAd ? { ctwaClid: ctwaClid!, pageId } : {})
    },
    ...(value !== undefined ? { value, currency: config.currency } : {})
  };
  return { ok: true, event, missingVariables: [...missing] };
}
