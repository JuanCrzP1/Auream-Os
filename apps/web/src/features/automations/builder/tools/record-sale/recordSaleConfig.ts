// La forma de la configuración es el contrato compartido con el motor
// (`contracts/RecordSaleConfig.ts`): el producto, de dónde sale el monto y las
// variables del comprobante.
export {
  RECORD_SALE_AMOUNT_MODES,
  RECORD_SALE_DEFAULT_CONFIG,
  RECORD_SALE_FIELDS,
  readRecordSaleConfig,
  type RecordSaleAmountMode,
  type RecordSaleConfig
} from "@contracts/RecordSaleConfig";
