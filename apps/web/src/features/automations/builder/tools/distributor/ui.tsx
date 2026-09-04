import type { ToolUi } from "../ToolUi";
import { DistributorIcon } from "./DistributorIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const distributorUi: ToolUi = {
  type: "distributor",
  Icon: DistributorIcon,
  frame: "diamond"
};
