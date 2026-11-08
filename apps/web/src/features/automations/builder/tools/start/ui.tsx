import type { ToolUi } from "../ToolUi";
import { StartIcon } from "./StartIcon";

/** `pill`, como Finalizar: los dos nodos de sistema cierran el grafo por un extremo. */
export const startUi: ToolUi = {
  type: "start",
  Icon: StartIcon,
  frame: "pill"
};
