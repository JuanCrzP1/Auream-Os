import type { MetaPixelAccess, PixelAccessCheck } from "../../domains/integrations/application/ports/MetaPixelAccess";
import type { ConversionEvent, TrackConversionResult } from "../../flow-engine/ports/ConversionTracker";
import { toMetaUserData } from "./metaUserData";

// ---------------------------------------------------------------------------
// Cliente de la API de Conversiones de Meta (Graph API).
//
//   verifyPixel  GET  /<versión>/<píxel>?fields=id,name   ¿el token da acceso?
//   send         POST /<versión>/<píxel>/events           un evento
//
// El token va en la cabecera `Authorization`, nunca en la URL (las URLs
// acaban en registros). Nunca lanza: todo fallo vuelve con su motivo, y los
// mensajes de Meta se limpian de cualquier cosa con forma de token.
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 15_000;

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
}

function scrub(text: string): string {
  return text.replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token oculto]").slice(0, 240);
}

/** Error de la Graph API → motivo. https://developers.facebook.com/docs/graph-api/guides/error-handling */
function classify(status: number, error: GraphError | undefined): { reason: Exclude<TrackConversionResult, { ok: true }>["reason"]; message: string } {
  const code = error?.code;
  const detail = scrub(error?.error_user_msg || error?.message || "");
  if (code === 190 || status === 401) return { reason: "invalid_token", message: "Meta rechazó el token del píxel (vencido o revocado)." };
  if ((code === 100 && error?.error_subcode === 33) || code === 803 || status === 404) {
    return { reason: "pixel_not_found", message: "El token no tiene acceso a ese píxel." };
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
    return { reason: "rate_limited", message: "Meta está limitando las peticiones; se intentará más tarde." };
  }
  if (code === 100 || status === 400) return { reason: "invalid_event", message: detail ? `Meta rechazó el evento: ${detail}` : "Meta rechazó el evento." };
  return { reason: "provider_error", message: detail ? `Meta respondió ${status}: ${detail}` : `Meta respondió ${status}.` };
}

async function call(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<{ ok: true; status: number; body: Record<string, unknown> } | { ok: false; reason: "timeout" | "network_error"; message: string }> {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = { error: { message: text.slice(0, 200) } };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return name === "TimeoutError" || name === "AbortError"
      ? { ok: false, reason: "timeout", message: "Meta no respondió a tiempo." }
      : { ok: false, reason: "network_error", message: "No se pudo conectar con Meta." };
  }
}

export class MetaConversionsClient implements MetaPixelAccess {
  private readonly fetchImpl: FetchLike;

  public constructor(
    private readonly graphVersion = "v23.0",
    fetchImpl?: FetchLike,
    private readonly baseUrl = "https://graph.facebook.com"
  ) {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private url(path: string): string {
    return `${this.baseUrl}/${this.graphVersion}/${path}`;
  }

  public async verifyPixel(pixelId: string, accessToken: string): Promise<PixelAccessCheck> {
    const result = await call(this.fetchImpl, this.url(`${encodeURIComponent(pixelId)}?fields=id,name`), {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!result.ok) return { ok: false, reason: "unavailable", message: result.message };
    if (result.status >= 200 && result.status < 300) {
      return { ok: true, ...(typeof result.body["name"] === "string" ? { pixelName: result.body["name"] } : {}) };
    }
    const failure = classify(result.status, result.body["error"] as GraphError | undefined);
    if (failure.reason === "invalid_token" || failure.reason === "pixel_not_found") return { ok: false, reason: failure.reason, message: failure.message };
    return { ok: false, reason: "unavailable", message: failure.message };
  }

  public async send(pixelId: string, accessToken: string, event: ConversionEvent, testEventCode?: string): Promise<TrackConversionResult> {
    const payload = {
      data: [
        {
          event_name: event.name,
          event_time: event.eventTime,
          event_id: event.eventId,
          action_source: event.actionSource,
          ...(event.actionSource === "business_messaging" ? { messaging_channel: "whatsapp" } : {}),
          user_data: toMetaUserData(event.user),
          ...(event.value !== undefined ? { custom_data: { value: event.value, currency: event.currency } } : {})
        }
      ],
      ...(testEventCode ? { test_event_code: testEventCode } : {})
    };
    const result = await call(this.fetchImpl, this.url(`${encodeURIComponent(pixelId)}/events`), {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return result;
    if (result.status >= 200 && result.status < 300) {
      const received = result.body["events_received"];
      return { ok: true, eventsReceived: typeof received === "number" ? received : 1 };
    }
    return { ok: false, ...classify(result.status, result.body["error"] as GraphError | undefined) };
  }
}
