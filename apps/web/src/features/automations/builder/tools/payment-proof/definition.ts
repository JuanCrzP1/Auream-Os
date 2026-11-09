import { PAYMENT_PROOF_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizePaymentProof } from "./summarizePaymentProof";

/**
 * Comprobante automático — lee la imagen o el PDF del pago (OCR propio, sin
 * IA), extrae sus datos y verifica cuenta, titular, monto, fecha y repetidos.
 * Una salida por resultado. Lo ejecuta `PaymentProofNodeHandler`.
 */
export const paymentProofTool: ToolDefinition = {
  ...PAYMENT_PROOF_BLOCK,
  description: "Procesa comprobantes automáticamente",
  defaultContentText: "Validación de comprobante",
  editorTitle: "Editar comprobante automático",
  executable: true,
  summarize: summarizePaymentProof,
  colors: {
    header: "#65a30d",
    body: "#4d7c0f",
    gradient: "linear-gradient(135deg,#a3e635,#4d7c0f)"
  },
  glyph: "🧾"
};
