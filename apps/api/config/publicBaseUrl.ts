import type { ApiConfig } from "./loadApiConfig";

/**
 * La dirección pública de la API, sin barra final: la que se le da a otros
 * sistemas (webhooks de entrada, servidor MCP). En producción, el dominio de
 * producción con `/api`; en local, `PUBLIC_API_BASE_URL`.
 */
export function publicBaseUrlOf(config: Pick<ApiConfig, "whatsappWebhookBaseUrl" | "publicApiBaseUrl">): string {
  return (config.whatsappWebhookBaseUrl ?? config.publicApiBaseUrl).replace(/\/+$/, "");
}
