import type { ToolUi } from "../ToolUi";
import { SaleApprovedIcon } from "./SaleApprovedIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const saleApprovedUi: ToolUi = {
  type: "sale-approved",
  Icon: SaleApprovedIcon,
  frame: "circle"
};
