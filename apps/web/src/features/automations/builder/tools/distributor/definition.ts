import type { ToolDefinition } from "../ToolDefinition";
import { DISTRIBUTOR_DEFAULT_CONFIG } from "./distributorOutputs";
import { readDistributorOutputs } from "./readDistributorConfig";
import { summarizeDistributor } from "./summarizeDistributor";
import { validateDistributor } from "./validateDistributor";

/**
 * Distribuidor — reparte la conversación entre varias salidas sin mirar el
 * contexto (eso lo hace Condicional).
 *
 * `executable: false`: ya se declaran y conectan las salidas, pero la política
 * de reparto no existe y `DistributorNodeHandler` falla con
 * `distributor_executor_not_implemented`.
 *
 * Sin `duplicateConfig`: los ids de salida se resuelven dentro de su nodo, así
 * que un duplicado puede conservarlos.
 */
export const distributorTool: ToolDefinition = {
  type: "distributor",
  label: "Distribuidor",
  description: "Reparte entre varias salidas",
  defaultContentText: "Reparto entre salidas",
  editorTitle: "Editar distribuidor",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: { ...DISTRIBUTOR_DEFAULT_CONFIG },
  outputs: readDistributorOutputs,
  summarize: summarizeDistributor,
  validate: validateDistributor,
  // Acero: cabecera más clara que el cuerpo, título blanco a 3.93:1.
  colors: {
    header: "#748199",
    body: "#64748b",
    gradient: "linear-gradient(135deg,#a3aebd,#64748b)"
  },
  glyph: "🔀"
};
