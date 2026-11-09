
// La forma de la configuración, sus salidas y los datos que extrae son el
// contrato compartido con el motor (`contracts/PaymentProofConfig.ts`).
export {
  MAX_AGE_LIMIT_HOURS,
  PAYMENT_PROOF_DEFAULT_CONFIG,
  PAYMENT_PROOF_FIELDS,
  PAYMENT_PROOF_OUTPUT,
  createAccount,
  paymentProofRoute,
  readPaymentProofConfig,
  type AmountCheck,
  type PaymentAccount,
  type PaymentProofConfig,
  type PaymentProofField
} from "@contracts/PaymentProofConfig";

/**
 * Salidas del bloque. Lo normal son dos —válido y rechazado—, como en Leona;
 * con «Una salida por cada motivo» cada verificación activa abre la suya.
 */
export { paymentProofOutputs } from "@contracts/blocks/outputs";

/** «••••4567» para números de cuenta; alias, correos y llaves se muestran tal cual. */
export function maskNumber(number: string): string {
  const clean = number.replace(/[\s.\-/]+/g, "");
  if (!/^\d+$/.test(clean)) return number;
  return clean.length > 4 ? `••••${clean.slice(-4)}` : clean;
}
