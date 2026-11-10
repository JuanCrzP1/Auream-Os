import { describe, expect, it, vi } from "vitest";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { RecordSaleNodeHandler } from "../../flow-engine/nodes/record-sale/RecordSaleNodeHandler.js";
import type { FlowSaleRequest, SalesLedger } from "../../flow-engine/ports/SalesLedger.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// El bloque «Registrar venta» en el motor: resuelve las variables del
// comprobante, le pasa a Ventas la conexión, el flujo y el anuncio, deja
// `{venta.*}` para los bloques siguientes y NUNCA detiene la conversación
// aunque guardar falle.
// ---------------------------------------------------------------------------

const input: RuntimeInput = {
  envelope: { tenantId: "t", flowKey: "flujo-ventas", channel: "whatsapp", conversationKey: "conn-7:573001112233", userKey: "573001112233", messageId: "msg-9", payload: { text: "pagué" }, receivedAt: "2026-11-08T00:00:00.000Z" },
  sessionContext: { "comprobante.valor": "49900", "comprobante.moneda": "COP", "comprobante.nombre_pagador": "Laura Gómez", "comprobante.referencia": "M12345" },
  isWaitingInput: false,
  now: "2026-11-08T12:00:00.000Z",
  timezone: "UTC"
};
const session = { id: "ses-1", tenantId: "t", context: {} } as unknown as Session;
const node = (config: Record<string, unknown>) => ({ id: "rs", type: "record-sale", name: "Registrar venta", content: {}, config, metadata: {} }) as unknown as FlowNode;

describe("RecordSaleNodeHandler", () => {
  it("lee el comprobante, guarda con la conexión y el flujo, y deja {venta.*}", async () => {
    const record = vi.fn(async (_tenant: string, _request: FlowSaleRequest) => ({
      ok: true as const,
      sale: { id: "sale-1", status: "approved" as const, productName: "Video", amount: 49900, currency: "COP", country: "CO", reviewReason: null, duplicate: false, saved: true }
    }));
    const result = await new RecordSaleNodeHandler({ record }, simulationDependencies().contacts).execute(node({ productId: "prod-1" }), input, session);

    expect(record.mock.calls[0]![1]).toMatchObject({
      productId: "prod-1",
      amountMode: "variable",
      amount: "49900",
      currency: "COP",
      customerName: "Laura Gómez",
      reference: "M12345",
      connectionId: "conn-7",
      flowKey: "flujo-ventas",
      customerPhone: "573001112233",
      stepKey: "ses-1:rs:msg-9"
    });
    expect(result.executionStatus).toBe("success");
    expect(result.output).toBeUndefined();
    expect(result.contextPatch).toEqual({ "venta.id": "sale-1", "venta.estado": "aprobada", "venta.producto": "Video", "venta.valor": "49900", "venta.moneda": "COP", "venta.pais": "CO" });
    expect(result.domainEvents).toEqual(["sale_recorded:rs"]);
  });

  it("«Por revisar» queda en {venta.estado} para un Condicional o una Notificación", async () => {
    const ledger: SalesLedger = {
      record: async () => ({ ok: true, sale: { id: "sale-2", status: "review", productName: "Video", amount: null, currency: null, country: "CO", reviewReason: "Falta el monto.", duplicate: false, saved: true } })
    };
    const result = await new RecordSaleNodeHandler(ledger, simulationDependencies().contacts).execute(node({ productId: "p", amount: "{otra}" }), input, session);
    expect(result.contextPatch["venta.estado"]).toBe("por_revisar");
    expect(result.nodeResult["reviewReason"]).toBe("Falta el monto.");
    expect(result.domainEvents).toEqual(["sale_review:rs", "record_sale_variable_missing:rs:otra"]);
  });

  it("con el precio del producto no manda monto ni moneda de variables", async () => {
    const record = vi.fn(async () => ({ ok: false as const, reason: "unavailable" as const, message: "x" }));
    await new RecordSaleNodeHandler({ record }, simulationDependencies().contacts).execute(node({ productId: "p", amountMode: "product" }), input, session);
    expect(record.mock.calls[0]).toBeDefined();
    expect((record.mock.calls[0] as unknown as [string, FlowSaleRequest])[1]).toMatchObject({ amountMode: "product", amount: "", currency: "" });
  });

  it("si guardar falla, la conversación sigue y queda el motivo", async () => {
    const ledger: SalesLedger = { record: async () => ({ ok: false, reason: "error", message: "la base no respondió" }) };
    const result = await new RecordSaleNodeHandler(ledger, simulationDependencies().contacts).execute(node({ productId: "p" }), input, session);
    expect(result.executionStatus).toBe("success");
    expect(result.contextPatch).toEqual({ "venta.estado": "error" });
    expect(result.nodeResult).toMatchObject({ reason: "error", message: "la base no respondió" });
    expect(result.domainEvents).toEqual(["sale_failed:rs:error"]);
  });
});
