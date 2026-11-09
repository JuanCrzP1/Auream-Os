import type { ToolDefinition } from "../ToolDefinition";
import { PAYMENT_PROOF_DEFAULT_CONFIG, paymentProofOutputs } from "./paymentProofConfig";
import { summarizePaymentProof } from "./summarizePaymentProof";
import { validatePaymentProof } from "./validatePaymentProof";

/**
 * Comprobante automático — lee la imagen o el PDF del pago (OCR propio, sin
 * IA), extrae sus datos y verifica cuenta, titular, monto, fecha y repetidos.
 * Una salida por resultado. Lo ejecuta `PaymentProofNodeHandler`.
 */
export const paymentProofTool: ToolDefinition = {
  type: "payment-proof",
  label: "Comprobante automático",
  description: "Procesa comprobantes automáticamente",
  defaultContentText: "Validación de comprobante",
  editorTitle: "Editar comprobante automático",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultContent: {},
  defaultConfig: { ...PAYMENT_PROOF_DEFAULT_CONFIG },
  outputs: paymentProofOutputs,
  summarize: summarizePaymentProof,
  validate: validatePaymentProof,
  colors: {
    header: "#65a30d",
    body: "#4d7c0f",
    gradient: "linear-gradient(135deg,#a3e635,#4d7c0f)"
  },
  glyph: "🧾"
};
