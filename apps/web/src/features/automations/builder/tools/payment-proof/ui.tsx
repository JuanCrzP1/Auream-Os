import type { ToolUi } from "../ToolUi";
import { PaymentProofIcon } from "./PaymentProofIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const paymentProofUi: ToolUi = {
  type: "payment-proof",
  Icon: PaymentProofIcon,
  frame: "card"
};
