import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { readPaymentProofConfig } from "../../PaymentProofConfig";

export const MISSING_SOURCE_MESSAGE = "Indica la variable que contiene el comprobante.";
export const NO_ACCOUNTS_MESSAGE = "Registra al menos una cuenta donde recibes pagos.";
export const MISSING_NUMBER_MESSAGE = "Cada cuenta necesita su número, celular o llave.";
export const MISSING_HOLDER_MESSAGE = "Cada cuenta necesita el nombre del titular.";
export const DUPLICATE_ACCOUNT_MESSAGE = "Hay dos cuentas iguales (mismo país, entidad y número).";
export const MISSING_AMOUNT_MESSAGE = "Indica el monto que debe tener el comprobante.";
export const MISSING_RESULT_MESSAGE = "Indica dónde se guardan los datos del comprobante.";

export function validatePaymentProof(_content: BlockData, config: BlockData): BlockCheck {
  const read = readPaymentProofConfig(config);

  if (read.source.length === 0) return invalid(MISSING_SOURCE_MESSAGE);

  if (read.matchAccount || read.matchHolder) {
    if (read.accounts.length === 0) return invalid(NO_ACCOUNTS_MESSAGE);
    if (read.matchAccount && read.accounts.some((account) => account.number.length === 0)) {
      return invalid(MISSING_NUMBER_MESSAGE);
    }
    if (read.matchHolder && read.accounts.some((account) => account.holder.trim().length === 0)) {
      return invalid(MISSING_HOLDER_MESSAGE);
    }
  }

  const keys = read.accounts
    .filter((account) => account.number.length > 0)
    .map((account) => `${account.country}:${account.provider}:${account.number.replace(/\s+/g, "")}`);
  if (new Set(keys).size !== keys.length) return invalid(DUPLICATE_ACCOUNT_MESSAGE);

  if (read.amountCheck !== "off" && read.expectedAmount.trim().length === 0) return invalid(MISSING_AMOUNT_MESSAGE);
  if (read.resultVariable.length === 0) return invalid(MISSING_RESULT_MESSAGE);

  return VALID;
}
