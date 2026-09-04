import type { ToolUi } from "../ToolUi";
import { WaitResponseIcon } from "./WaitResponseIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const waitResponseUi: ToolUi = {
  type: "question",
  Icon: WaitResponseIcon,
  frame: "card"
};
