import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { readRecordSaleConfig } from "../../RecordSaleConfig";

export const MISSING_PRODUCT_MESSAGE = "Elige el producto que se vende (Ventas → Productos).";
export const MISSING_AMOUNT_MESSAGE = "Indica el monto (un número o una variable, como {comprobante.valor}).";
export const MISSING_CURRENCY_MESSAGE = "Indica la moneda (como COP o {comprobante.moneda}).";

/** Que el producto exista y esté activo lo comprueba el editor con el catálogo; aquí, que esté elegido. */
export function validateRecordSale(_content: BlockData, config: BlockData): BlockCheck {
  const read = readRecordSaleConfig(config);

  if (!read.productId) return invalid(MISSING_PRODUCT_MESSAGE);
  if (read.amountMode === "variable" && read.amount.trim().length === 0) return invalid(MISSING_AMOUNT_MESSAGE);
  if (read.amountMode === "variable" && read.currency.trim().length === 0) return invalid(MISSING_CURRENCY_MESSAGE);

  return VALID;
}
