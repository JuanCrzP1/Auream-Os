import type { ToolUi } from "../ToolUi";
import { PaymentProofIcon } from "./PaymentProofIcon";
import { PaymentProofEditor } from "./PaymentProofEditor";
import { createOutputsCompactBody } from "../_kit/OutputsCompactBody";
import { summarizePaymentProof } from "./summarizePaymentProof";

export const paymentProofUi: ToolUi = {
  type: "payment-proof",
  Icon: PaymentProofIcon,
  frame: "card",
  CompactBody: createOutputsCompactBody(summarizePaymentProof),
  Editor: PaymentProofEditor
};
