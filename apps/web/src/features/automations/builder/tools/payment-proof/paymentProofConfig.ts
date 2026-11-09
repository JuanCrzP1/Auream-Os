import type { ToolData, ToolOutput } from "../ToolDefinition";
import { PAYMENT_PROOF_OUTPUT, readPaymentProofConfig } from "@contracts/PaymentProofConfig";

// La forma de la configuración, sus salidas y los datos que extrae son el
// contrato compartido con el motor (`contracts/PaymentProofConfig.ts`).
export {
  MAX_AGE_LIMIT_HOURS,
  PAYMENT_PROOF_DEFAULT_CONFIG,
  PAYMENT_PROOF_FIELDS,
  PAYMENT_PROOF_OUTPUT,
  createAccount,
  readPaymentProofConfig,
  type AmountCheck,
  type PaymentAccount,
  type PaymentProofConfig,
  type PaymentProofField
} from "@contracts/PaymentProofConfig";

export function paymentProofOutputs(config: ToolData): ReadonlyArray<ToolOutput> {
  const read = readPaymentProofConfig(config);
  const O = PAYMENT_PROOF_OUTPUT;

  return [
    { id: O.valid, label: "Comprobante válido" },
    ...(read.matchAccount ? [{ id: O.wrongAccount, label: "Cuenta no registrada" }] : []),
    ...(read.matchHolder ? [{ id: O.wrongHolder, label: "Titular incorrecto" }] : []),
    ...(read.amountCheck !== "off" ? [{ id: O.wrongAmount, label: "Monto incorrecto" }] : []),
    ...(read.maxAgeEnabled ? [{ id: O.tooOld, label: "Comprobante antiguo" }] : []),
    ...(read.rejectDuplicates ? [{ id: O.duplicate, label: "Comprobante repetido" }] : []),
    { id: O.invalid, label: "No es un comprobante" },
    { id: O.failure, label: "Error" }
  ];
}

/** «••••4567» para números de cuenta; alias, correos y llaves se muestran tal cual. */
export function maskNumber(number: string): string {
  const clean = number.replace(/[\s.\-/]+/g, "");
  if (!/^\d+$/.test(clean)) return number;
  return clean.length > 4 ? `••••${clean.slice(-4)}` : clean;
}
