import { DISTRIBUTOR_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeDistributor } from "./summarizeDistributor";

/**
 * Distribuidor — reparte la conversación entre varias salidas sin mirar el
 * contexto (eso lo hace Condicional).
 *
 * Se ejecuta (`DistributorNodeHandler`): reparte por turnos, en el orden de las
 * salidas, con un contador compartido entre conversaciones.
 *
 * Sin `duplicateConfig`: los ids de salida se resuelven dentro de su nodo, así
 * que un duplicado puede conservarlos.
 */
export const distributorTool: ToolDefinition = {
  ...DISTRIBUTOR_BLOCK,
  description: "Reparte entre varias salidas",
  defaultContentText: "Reparto entre salidas",
  editorTitle: "Editar distribuidor",
  executable: true,
  summarize: summarizeDistributor,
  // Acero: cabecera más clara que el cuerpo, título blanco a 3.93:1.
  colors: {
    header: "#748199",
    body: "#64748b",
    gradient: "linear-gradient(135deg,#a3aebd,#64748b)"
  },
  glyph: "🔀"
};
