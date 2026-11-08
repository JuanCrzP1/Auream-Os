import type { ToolData } from "../ToolDefinition";
import { readPaymentProofConfig } from "./paymentProofConfig";

export function summarizePaymentProof(_content: ToolData, config: ToolData): string {
  const read = readPaymentProofConfig(config);
  const accounts = read.accounts.length === 1 ? "1 cuenta" : `${read.accounts.length} cuentas`;
  const checks = [
    read.matchAccount ? "cuenta" : "",
    read.matchHolder ? "titular" : "",
    read.amountCheck !== "off" ? "monto" : "",
    read.maxAgeEnabled ? "fecha" : "",
    read.rejectDuplicates ? "duplicados" : ""
  ].filter(Boolean);

  return checks.length > 0 ? `${accounts} · verifica ${checks.join(", ")}` : `${accounts} · solo lee los datos`;
}
