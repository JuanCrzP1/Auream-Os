import { GO_TO_FLOW_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeGoToFlow } from "./summarizeGoToFlow";

/**
 * Ir a otro flujo (la Conexión de flujo de Leona) — este flujo termina y el
 * cliente sigue, en el mismo momento, en el inicio del flujo elegido, con
 * los datos que guardó la conversación. Sin salidas. El salto lo hace
 * `FlowTurn` (flujo activo, no el mismo, hasta 5 saltos seguidos).
 */
export const goToFlowTool: ToolDefinition = {
  ...GO_TO_FLOW_BLOCK,
  description: "Pasa al cliente a otro flujo",
  defaultContentText: "Va a otro flujo",
  editorTitle: "Editar ir a otro flujo",
  executable: true,
  summarize: summarizeGoToFlow,
  colors: {
    header: "#0b5394",
    body: "#08396a",
    gradient: "linear-gradient(135deg,#2f80d0,#08396a)"
  },
  glyph: "↪"
};
