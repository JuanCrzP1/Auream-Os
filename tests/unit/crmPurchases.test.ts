import { describe, expect, it } from "vitest";
import { STARTER_PIPELINE } from "../../domains/crm/domain/Pipeline.js";
import { REOPEN_AFTER_DAYS, opensNewPurchase, readyToReopen } from "../../domains/crm/domain/Deal.js";
import { OWNER, T, crmWorld } from "./helpers/crmFakes.js";

// ---------------------------------------------------------------------------
// Un negocio por cada compra: volver a «aún no compra» después de comprar (o
// de no comprar) abre otra; un mensaje solo la abre pasados 7 días; una venta
// nueva sobre una compra que ya tenía su venta abre otra, ya ganada.
// La hora es la del reloj del mundo de prueba: nada depende del día en que se
// corre (esta prueba se rompió sola el 17 de noviembre de 2026 por eso).
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function world() {
  const w = crmWorld();
  const pipeline = await w.pipelineServices.create(OWNER, { ...STARTER_PIPELINE, defaultProductId: "video" });
  const stage = (name: string) => pipeline.stages.find((candidate) => candidate.name === name)!;
  w.addContact("maria");
  await w.tracker.contactCreated(T, "maria");
  return { w, pipeline, stage };
}

describe("Compras", () => {
  it("la regla: solo abre otra compra si la actual cerró y vuelve a «aún no compra»", () => {
    expect(opensNewPurchase(null, null, "open")).toBe(false);
    expect(opensNewPurchase({ stageId: "s", wonAt: null }, "open", "open")).toBe(false);
    expect(opensNewPurchase({ stageId: "s", wonAt: "2026-11-01T00:00:00Z" }, "won", "won")).toBe(false);
    expect(opensNewPurchase({ stageId: "s", wonAt: "2026-11-01T00:00:00Z" }, "won", "open")).toBe(true);
    expect(opensNewPurchase({ stageId: "s", wonAt: null }, "lost", "open")).toBe(true);
  });

  it("la regla de los días: un mensaje abre otra compra justo a los 7 días, ni un momento antes", () => {
    const closed = { stageEnteredAt: "2026-11-10T12:00:00.000Z" };
    const after = (ms: number) => new Date(Date.parse(closed.stageEnteredAt) + ms);
    expect(REOPEN_AFTER_DAYS).toBe(7);
    expect(readyToReopen(closed, after(0))).toBe(false);
    expect(readyToReopen(closed, after(7 * DAY - 1))).toBe(false);
    expect(readyToReopen(closed, after(7 * DAY))).toBe(true);
    expect(readyToReopen(closed, after(30 * DAY))).toBe(true);
  });

  it("compró y un flujo la pone otra vez en «Interesado»: compra n.º 2; la n.º 1 queda ganada", async () => {
    const { w, pipeline, stage } = await world();
    await w.labeler.change(T, "maria", { add: [stage("Pagó").labelId], remove: [] }, { kind: "user", userId: "u-owner" });
    await w.labeler.change(T, "maria", { add: [stage("Entregado").labelId], remove: [] }, { kind: "user", userId: "u-owner" });
    await w.labeler.change(T, "maria", { add: [stage("Interesado").labelId], remove: [] }, { kind: "flow", flowKey: "promo" });

    const current = w.deals.get(`${pipeline.id}:maria`)!;
    expect(current).toMatchObject({ number: 2, current: true, stageId: stage("Interesado").id, wonAt: null, value: { amount: 49900, currency: "COP" } });
    expect(w.history).toEqual([expect.objectContaining({ number: 1, current: false, stageId: stage("Entregado").id, wonAt: expect.any(String) })]);
    expect(w.events.at(-1)).toMatchObject({ kind: "stage", detail: "Nueva compra (n.º 2)" });
  });

  it("un «gracias» el mismo día o a los 6 días no abre otra compra; a los 7 días, sí (a la etapa de entrada)", async () => {
    const { w, pipeline, stage } = await world();
    const key = `${pipeline.id}:maria`;
    await w.labeler.change(T, "maria", { add: [stage("Pagó").labelId], remove: [] }, { kind: "user", userId: "u-owner" });
    const paid = w.deals.get(key)!;

    // Escribe «gracias» una hora después: la misma compra, sigue en «Pagó».
    w.clock.advance(HOUR);
    await w.tracker.contactWrote(T, "maria");
    expect(w.deals.get(key)).toMatchObject({ number: 1, stageId: stage("Pagó").id, stageEnteredAt: paid.stageEnteredAt });

    // A los 6 días y 23 horas, tampoco.
    w.clock.advance(6 * DAY + 22 * HOUR);
    await w.tracker.contactWrote(T, "maria");
    expect(w.deals.get(key)).toMatchObject({ number: 1, stageId: stage("Pagó").id });

    // A los 7 días justos: otra compra, en la etapa de entrada; la anterior queda ganada.
    w.clock.advance(HOUR);
    await w.tracker.contactWrote(T, "maria");
    expect(w.deals.get(key)).toMatchObject({ number: 2, stageId: stage("Nuevo").id, openedAt: w.clock.now().toISOString() });
    expect(w.labelsOf("maria")).toEqual([stage("Nuevo").labelId]);
    expect(w.history).toEqual([expect.objectContaining({ number: 1, stageId: stage("Pagó").id, wonAt: paid.wonAt })]);
    expect(w.errors).toEqual([]);
  });

  it("una venta nueva sobre una compra que ya tenía su venta abre otra, ya ganada; la misma venta no se cuenta dos veces", async () => {
    const { w, pipeline, stage } = await world();
    const sale = (id: string) => ({ id, contactId: "maria", amount: 49900, currency: "COP", productId: "video", productName: "Video personalizado" });
    await w.tracker.saleApproved(T, sale("venta-1"));
    expect(w.deals.get(`${pipeline.id}:maria`)).toMatchObject({ number: 1, saleId: "venta-1", stageId: stage("Pagó").id });

    await w.tracker.saleApproved(T, sale("venta-1"));
    expect(w.deals.get(`${pipeline.id}:maria`)!.number).toBe(1);

    await w.tracker.saleApproved(T, sale("venta-2"));
    expect(w.deals.get(`${pipeline.id}:maria`)).toMatchObject({ number: 2, saleId: "venta-2", wonAt: expect.any(String), value: { amount: 49900, currency: "COP" } });
    expect(w.history).toHaveLength(1);
    expect(w.errors).toEqual([]);
  });
});
