import type { ToolDefinition } from "../ToolDefinition";
import { INTEGRATION_DEFAULT_CONFIG, integrationOutputs } from "./integrationConfig";
import { summarizeIntegration } from "./summarizeIntegration";
import { validateIntegration } from "./validateIntegration";

/**
 * Integración — petición HTTP a un servicio externo, con mapeo de la respuesta
 * a campos del contacto. Salidas: Éxito y Error.
 *
 * Lo ejecuta `IntegrationNodeHandler` con un cliente HTTP protegido (sin
 * acceso a la red interna, con plazos y tamaños máximos).
 */
export const integrationTool: ToolDefinition = {
  type: "integration",
  label: "Integración",
  description: "Conecta servicios externos",
  defaultContentText: "Webhook o API de dominio",
  editorTitle: "Editar integración",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultContent: {},
  defaultConfig: { ...INTEGRATION_DEFAULT_CONFIG },
  outputs: integrationOutputs,
  summarize: summarizeIntegration,
  validate: validateIntegration,
  colors: {
    header: "#ea580c",
    body: "#c2410c",
    gradient: "linear-gradient(135deg,#fb923c,#c2410c)"
  },
  glyph: "⚡"
};
