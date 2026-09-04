import type { ToolUi } from "../ToolUi";
import { PixelIcon } from "./PixelIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const pixelUi: ToolUi = {
  type: "pixel",
  Icon: PixelIcon,
  frame: "circle"
};
