import type { AiProviderId } from "@contracts/AiContracts";

/** Los distintivos (logos) que conoce el kit: los proveedores de IA, Meta, webhook y MCP. */
export type IntegrationMarkKind = AiProviderId | "meta" | "webhook" | "mcp";
