import type { ToolUi } from "../ToolUi";
import { ConditionalIcon } from "./ConditionalIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const conditionalUi: ToolUi = {
  type: "condition",
  Icon: ConditionalIcon,
  frame: "diamond"
};
