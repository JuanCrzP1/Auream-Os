import { AI_PROVIDERS } from "@contracts/AiContracts";
import { useAiCredentials } from "@shared/ai-credentials/useAiCredentials";
import { usePixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { useWebhooks } from "@shared/webhooks/useWebhooks";
import { useMcpCredentials } from "@shared/mcp/useMcpCredentials";
import type { IntegrationSourceState } from "./integrationCatalog";

// ---------------------------------------------------------------------------
// Fuentes del centro de Integraciones: cuántas hay conectadas de cada
// integración, con los mismos datos que usan sus paneles. Una por módulo.
// ---------------------------------------------------------------------------

/** IA: una integración por proveedor (OpenAI, Gemini, OpenRouter). */
export function useAiSource(): IntegrationSourceState {
  const ai = useAiCredentials();
  const counts = Object.fromEntries(AI_PROVIDERS.map((provider) => [provider.id, ai.credentials.filter((credential) => credential.provider === provider.id).length]));
  return { status: ai.status, counts, refresh: ai.refresh };
}

/** Meta: los píxeles con la API de Conversiones. */
export function usePixelSource(): IntegrationSourceState {
  const pixels = usePixelConnections();
  return { status: pixels.status, counts: { "meta-pixel": pixels.connections.length }, refresh: pixels.refresh };
}

/** Automatización: los webhooks de entrada. */
export function useWebhookSource(): IntegrationSourceState {
  const webhooks = useWebhooks();
  return { status: webhooks.status, counts: { webhooks: webhooks.webhooks.length }, refresh: webhooks.refresh };
}

/** Agentes de IA: las credenciales MCP. */
export function useMcpSource(): IntegrationSourceState {
  const mcp = useMcpCredentials();
  return { status: mcp.status, counts: { mcp: mcp.credentials.length }, refresh: mcp.refresh };
}
