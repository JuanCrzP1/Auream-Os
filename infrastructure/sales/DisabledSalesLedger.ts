import type { FlowSaleResult, SalesLedger } from "../../flow-engine/ports/SalesLedger";

// Sin Ventas conectadas (pruebas, entornos sin base): el bloque sigue y deja
// `{venta.estado}` en «error» con este motivo.
export class DisabledSalesLedger implements SalesLedger {
  public async record(): Promise<FlowSaleResult> {
    return { ok: false, reason: "unavailable", message: "Ventas no está disponible en este entorno." };
  }
}
