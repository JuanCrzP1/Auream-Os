import type { ToolData } from "../ToolDefinition";
import { readRecordSaleConfig } from "./recordSaleConfig";

export function summarizeRecordSale(_content: ToolData, config: ToolData): string {
  const read = readRecordSaleConfig(config);
  if (!read.productId) return "Sin producto elegido";
  const name = read.productName || "Producto elegido";
  return read.amountMode === "product" ? `${name} · precio del país` : `${name} · ${read.amount.trim() || "sin monto"}`;
}
