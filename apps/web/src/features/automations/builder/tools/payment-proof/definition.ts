import type { ToolDefinition } from "../ToolDefinition";
import { PAYMENT_PROOF_DEFAULT_CONFIG, paymentProofOutputs } from "./paymentProofConfig";
import { summarizePaymentProof } from "./summarizePaymentProof";
import { validatePaymentProof } from "./validatePaymentProof";

/**
 * Comprobante automático — lee el comprobante de pago del cliente, extrae sus
 * datos y verifica cuenta y titular. Una salida por resultado.
 *
 * `executable: false`: faltan el almacenamiento de media y el extractor.
 */
export const paymentProofTool: ToolDefinition = {
  type: "payment-proof",
  label: "Comprobante automático",
  description: "Procesa comprobantes automáticamente",
  defaultContentText: "Validación de comprobante",
  editorTitle: "Editar comprobante automático",
  availableInPalette: true,
  terminal: false,
  executable: false,
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
