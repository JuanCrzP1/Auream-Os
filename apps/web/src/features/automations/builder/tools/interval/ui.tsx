import type { ToolUi } from "../ToolUi";
import { IntervalIcon } from "./IntervalIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const intervalUi: ToolUi = {
  type: "delay",
  Icon: IntervalIcon,
  frame: "circle"
};
