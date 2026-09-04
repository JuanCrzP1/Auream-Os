import type { ToolUi } from "../ToolUi";
import { IntegrationIcon } from "./IntegrationIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const integrationUi: ToolUi = {
  type: "integration",
  Icon: IntegrationIcon,
  frame: "card"
};
