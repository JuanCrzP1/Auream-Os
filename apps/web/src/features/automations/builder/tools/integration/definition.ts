import { INTEGRATION_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeIntegration } from "./summarizeIntegration";

/**
 * Integración — petición HTTP a un servicio externo, con mapeo de la respuesta
 * a campos del contacto. Salidas: Éxito y Error.
 *
 * Lo ejecuta `IntegrationNodeHandler` con un cliente HTTP protegido (sin
 * acceso a la red interna, con plazos y tamaños máximos).
 */
export const integrationTool: ToolDefinition = {
  ...INTEGRATION_BLOCK,
  description: "Conecta servicios externos",
  defaultContentText: "Webhook o API de dominio",
  editorTitle: "Editar integración",
  executable: true,
  summarize: summarizeIntegration,
  colors: {
    header: "#ea580c",
    body: "#c2410c",
    gradient: "linear-gradient(135deg,#fb923c,#c2410c)"
  },
  glyph: "⚡"
};
