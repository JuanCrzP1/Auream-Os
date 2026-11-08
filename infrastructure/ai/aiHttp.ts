import type { AiFailureReason } from "../../flow-engine/ports/AiGateway";
import type { FetchLike } from "./AiProviderClient";

// ---------------------------------------------------------------------------
// HTTP común de los clientes de IA: plazo, lectura del JSON y traducción de
// errores. Los mensajes del proveedor se limpian de cualquier cosa que parezca
// una clave antes de mostrarlos o registrarlos.
// ---------------------------------------------------------------------------

export type AiHttpResult =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false; readonly reason: "timeout" | "network_error"; readonly message: string };

export async function requestJson(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number): Promise<AiHttpResult> {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text();
    let body: unknown = undefined;
    try {
      body = text ? (JSON.parse(text) as unknown) : undefined;
    } catch {
      body = { error: { message: text.slice(0, 300) } };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return name === "TimeoutError" || name === "AbortError"
      ? { ok: false, reason: "timeout", message: "El proveedor de IA no respondió a tiempo." }
      : { ok: false, reason: "network_error", message: "No se pudo conectar con el proveedor de IA." };
  }
}

/** Quita de un texto lo que parezca una clave de API. */
export function scrubSecrets(text: string): string {
  return text.replace(/\b(sk-[A-Za-z0-9_*-]{6,}|AIza[A-Za-z0-9_-]{10,}|sk-or-[A-Za-z0-9_*-]{6,})/g, "[clave oculta]");
}

/** Mensaje de error del proveedor (formatos OpenAI/OpenRouter y Google). */
export function providerMessage(body: unknown): string {
  const error = (body as { error?: unknown } | null)?.error;
  const message =
    typeof error === "string" ? error : typeof (error as { message?: unknown } | null)?.message === "string" ? (error as { message: string }).message : "";
  return scrubSecrets(message).slice(0, 240);
}

export function providerErrorCode(body: unknown): string {
  const error = (body as { error?: { code?: unknown; status?: unknown; type?: unknown } } | null)?.error;
  return [error?.code, error?.status, error?.type].filter((part) => typeof part === "string").join(" ").toLowerCase();
}

/** Estado HTTP → motivo, común a los tres proveedores. */
export function failureFromStatus(status: number, body: unknown): { reason: AiFailureReason; message: string } {
  const code = providerErrorCode(body);
  const detail = providerMessage(body);
  const withDetail = (text: string) => (detail ? `${text} (${detail})` : text);

  if (status === 401 || code.includes("invalid_api_key") || /api.key.not.valid|api_key_invalid/i.test(detail)) {
    return { reason: "invalid_key", message: "El proveedor rechazó la clave de la conexión de IA." };
  }
  if (status === 402 || code.includes("insufficient_quota")) {
    return { reason: "quota_exceeded", message: "La cuenta del proveedor de IA no tiene saldo o cuota disponible." };
  }
  if (status === 429) return { reason: "rate_limited", message: withDetail("El proveedor de IA está limitando las peticiones; inténtalo en un momento") };
  if (status === 404 || code.includes("model_not_found")) {
    return { reason: "model_not_found", message: "El modelo no existe o tu cuenta del proveedor no tiene acceso a él." };
  }
  if (status === 403) return { reason: "invalid_key", message: withDetail("El proveedor no permite usar esta clave para esto") };
  return { reason: "provider_error", message: withDetail(`El proveedor de IA respondió ${status}`) };
}

/** Nombre legible de un id de modelo: `gpt-5.4-mini` → `GPT-5.4 Mini`. */
export function prettifyModelId(id: string): string {
  const parts = id.split("/").pop()!.split("-");
  if (parts[0]?.toLowerCase() === "gpt" && parts[1]) {
    return [`GPT-${parts[1]}`, ...parts.slice(2).map(capitalize)].join(" ");
  }
  return parts.map(capitalize).join(" ");
}

function capitalize(word: string): string {
  return word ? word[0]!.toUpperCase() + word.slice(1) : word;
}
