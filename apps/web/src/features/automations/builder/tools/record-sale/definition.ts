import { RECORD_SALE_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeRecordSale } from "./summarizeRecordSale";

/**
 * Registrar venta — guarda la venta en Ventas con el producto del catálogo,
 * el monto y la moneda (del comprobante o del precio del país) y el cliente.
 * Va después de la salida «válido» del Comprobante. Separa responsabilidades:
 * el Comprobante verifica, este bloque registra. Si falta algo, la venta queda
 * «Por revisar» (nunca un precio inventado). Lo ejecuta `RecordSaleNodeHandler`;
 * si guardar falla, el flujo sigue.
 */
export const recordSaleTool: ToolDefinition = {
  ...RECORD_SALE_BLOCK,
  description: "Guarda la venta en Ventas",
  defaultContentText: "Venta registrada",
  editorTitle: "Editar registrar venta",
  executable: true,
  summarize: summarizeRecordSale,
  colors: {
    header: "#115e59",
    body: "#134e4a",
    gradient: "linear-gradient(135deg,#14b8a6,#134e4a)"
  },
  glyph: "💰"
};
