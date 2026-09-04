import type { ToolUi } from "../ToolUi";
import { MenuIcon } from "./MenuIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const menuUi: ToolUi = {
  type: "menu",
  Icon: MenuIcon,
  frame: "card"
};
