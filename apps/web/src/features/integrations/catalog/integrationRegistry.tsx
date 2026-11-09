import type { ComponentType } from "react";
import { AiSection } from "../components/AiSection";
import { PixelSection } from "../components/PixelSection";
import { WebhooksPanel } from "../webhooks/WebhooksPanel";
import { WebhookEditorPage } from "../webhooks/WebhookEditorPage";
import { McpPanel } from "../mcp/McpPanel";
import type { IntegrationDefinition } from "./integrationCatalog";

// ---------------------------------------------------------------------------
// Registro del centro de Integraciones: cada integración con su definición
// (lo que muestra su tarjeta) y su PANEL (su página `/integrations/<id>`,
// donde se conecta y administra). Agregar una integración = una línea aquí,
// su panel y su fuente (`sources.ts`); el centro y la página no cambian.
// ---------------------------------------------------------------------------

export interface IntegrationModule {
  readonly definition: IntegrationDefinition;
  readonly Panel: ComponentType;
  /** Página de un elemento suyo (`/integrations/<id>/<elemento>`), p. ej. el editor de un webhook. */
  readonly ItemPage?: ComponentType<{ readonly itemId: string }>;
}

const CONNECTIONS = { one: "conexión", many: "conexiones" } as const;
const AI_KEYWORDS = ["ia", "extensión ia", "chatgpt", "modelo", "clave"];

export const INTEGRATIONS: ReadonlyArray<IntegrationModule> = [
  {
    definition: { id: "openai", category: "ai", name: "OpenAI", mark: "openai", unit: CONNECTIONS, tagline: "Modelos GPT para el bloque «Extensión IA» de tus flujos.", keywords: AI_KEYWORDS },
    Panel: () => <AiSection provider="openai" />
  },
  {
    definition: { id: "gemini", category: "ai", name: "Google Gemini", mark: "gemini", unit: CONNECTIONS, tagline: "Modelos de Google, rápidos y multimodales, para «Extensión IA».", keywords: AI_KEYWORDS },
    Panel: () => <AiSection provider="gemini" />
  },
  {
    definition: { id: "openrouter", category: "ai", name: "OpenRouter", mark: "openrouter", unit: CONNECTIONS, tagline: "Una sola clave para Claude, GPT, Gemini, Llama y más.", keywords: [...AI_KEYWORDS, "claude", "llama"] },
    Panel: () => <AiSection provider="openrouter" />
  },
  {
    definition: {
      id: "meta-pixel",
      category: "tracking",
      name: "Píxel de Meta",
      mark: "meta",
      unit: { one: "píxel", many: "píxeles" },
      tagline: "API de Conversiones: registra Leads y Compras en tus campañas de Facebook e Instagram.",
      keywords: ["facebook", "instagram", "capi", "conversiones", "anuncios", "pixel"]
    },
    Panel: PixelSection
  },
  {
    definition: {
      id: "webhooks",
      category: "automation",
      name: "Webhooks de entrada",
      mark: "webhook",
      unit: { one: "webhook", many: "webhooks" },
      tagline: "Recibe datos de n8n, Make, Hotmart o formularios: crea el contacto, ponle etiquetas e inicia un flujo.",
      keywords: ["webhook", "n8n", "make", "zapier", "hotmart", "kiwify", "formulario", "api"]
    },
    Panel: WebhooksPanel,
    ItemPage: WebhookEditorPage
  },
  {
    definition: {
      id: "mcp",
      category: "agents",
      name: "Agentes de IA (MCP)",
      mark: "mcp",
      unit: { one: "credencial", many: "credenciales" },
      tagline: "Conecta Claude, n8n o Cursor a tu cuenta con permisos por área: leen y actúan por ti.",
      keywords: ["mcp", "claude", "cursor", "n8n", "agente", "ia", "api", "token"]
    },
    Panel: McpPanel
  }
];

export const INTEGRATION_DEFINITIONS: ReadonlyArray<IntegrationDefinition> = INTEGRATIONS.map((integration) => integration.definition);

export function findIntegration(id: string): IntegrationModule | null {
  return INTEGRATIONS.find((integration) => integration.definition.id === id) ?? null;
}
