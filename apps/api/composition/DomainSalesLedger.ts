import type { FlowSaleRequest, FlowSaleResult, SalesLedger } from "../../../flow-engine/ports/SalesLedger";
import type { FlowSaleRecorder } from "../../../domains/sales/application/FlowSaleRecorder";

// ---------------------------------------------------------------------------
// DomainSalesLedger — el puente entre el bloque «Registrar venta» (motor) y el
// dominio de Ventas. `record` guarda (producción); `preview` calcula sin
// guardar (simulación del builder y Laboratorio). Un error de la base no tumba
// el flujo: vuelve como `{ ok: false }` y el bloque sigue.
// ---------------------------------------------------------------------------

export class DomainSalesLedger implements SalesLedger {
  public constructor(
    private readonly recorder: FlowSaleRecorder,
    private readonly mode: "record" | "preview"
  ) {}

  public async record(tenantId: string, request: FlowSaleRequest): Promise<FlowSaleResult> {
    try {
      const sale = this.mode === "record" ? await this.recorder.record(tenantId, request) : await this.recorder.preview(tenantId, request);
      return { ok: true, sale };
    } catch (error) {
      return { ok: false, reason: "error", message: error instanceof Error ? error.message.slice(0, 200) : "No se pudo guardar la venta." };
    }
  }
}
