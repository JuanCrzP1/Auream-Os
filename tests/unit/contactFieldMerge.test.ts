import { describe, expect, it, vi } from "vitest";
import { ContactFieldMergeServices } from "../../domains/contact-fields/application/ContactFieldMergeServices.js";
import type { StoredOperation } from "../../domains/contact-fields/application/ContactFieldToolPorts.js";
import type { BlockChange } from "../../domains/contact-fields/domain/fieldMerge.js";

// ---------------------------------------------------------------------------
// Unir campos y deshacer, la orquestación: primero los datos (una
// transacción), después los flujos; un flujo que no se pudo guardar se
// reporta; deshacer solo dentro de 7 días y una sola vez.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-13T12:00:00.000Z");
const CHANGE = { flowKey: "ventas", flowName: "Ventas", blockId: "q", blockName: "Pregunta", before: { content: {}, config: {} }, after: { content: {}, config: {} } } as BlockChange;
const stored = (overrides: Partial<StoredOperation> = {}): StoredOperation => ({ id: "op", kind: "merge", title: "t", contacts: 2, keys: ["respuesta", "resposta"], definitions: { restore: [], remove: [] }, flows: [CHANGE], createdAt: "2026-11-10T12:00:00.000Z", undoneAt: null, ...overrides });

function setup(options: { found?: StoredOperation | null; skipped?: string[] } = {}) {
  const order: string[] = [];
  const operations = {
    tidy: vi.fn(),
    merge: vi.fn(async () => (order.push("datos"), 7)),
    attachFlows: vi.fn(async () => void order.push("registro de flujos")),
    recent: vi.fn(async () => []),
    find: vi.fn(async () => options.found ?? null),
    undo: vi.fn(async () => 5)
  };
  const rewriter = { rename: vi.fn(async () => (order.push("flujos"), { changes: [CHANGE], skipped: options.skipped ?? [] })), restore: vi.fn(async () => ({ skipped: 1 })) };
  const definitions = [{ id: "d1", key: "resposta", label: "Resposta", type: "list" as const, options: ["Sí", "No"], createdAt: "", updatedAt: "" }];
  let n = 0;
  const service = new ContactFieldMergeServices({ list: async () => definitions }, { filledCounts: async () => new Map() }, { conflicts: async () => 0 }, operations, { drafts: async () => [] }, rewriter, () => `id-${++n}`, () => NOW);
  return { service, operations, rewriter, order };
}

describe("unir campos", () => {
  it("primero los datos y después los flujos; la clave nueva hereda el tipo; un flujo ocupado se reporta", async () => {
    const { service, operations, rewriter, order } = setup({ skipped: ["Bienvenida"] });
    const result = await service.merge(T, { keep: "respuesta", merge: ["resposta", "resposta", "respuesta"] }, "u-ana");
    expect(order).toEqual(["datos", "flujos", "registro de flujos"]);
    expect(operations.merge).toHaveBeenCalledWith(T, expect.objectContaining({ keep: "respuesta", merge: ["resposta"], merged: [expect.objectContaining({ id: "d1" })], createKeep: { id: "id-1", shape: { key: "respuesta", label: "Respuesta", type: "list", options: ["Sí", "No"] } } }));
    expect(rewriter.rename).toHaveBeenCalledWith(T, new Map([["resposta", "respuesta"]]));
    expect(result).toMatchObject({ operation: { kind: "merge", title: "Uniste 2 campos en «Respuesta»", contacts: 7, undoUntil: "2026-11-20T12:00:00.000Z" }, flowsSkipped: ["Bienvenida"] });
  });

  it("valida qué se une", async () => {
    const { service } = setup();
    await expect(service.merge(T, { keep: "", merge: ["a"] }, "u")).rejects.toThrow("con cuál campo te quedas");
    await expect(service.merge(T, { keep: "respuesta", merge: ["respuesta"] }, "u")).rejects.toThrow("al menos otro campo");
    await expect(service.merge(T, { keep: "respuesta", merge: ["mi campo"] }, "u")).rejects.toThrow("no es una clave válida");
    await expect(service.merge(T, { keep: "first_name", merge: ["nombre"] }, "u")).rejects.toThrow("lo llena Auream");
  });
});

describe("deshacer", () => {
  it("devuelve los datos y los bloques, y dice cuántos bloques no tocó", async () => {
    const { service, operations, rewriter } = setup({ found: stored() });
    expect(await service.undo(T, "op")).toEqual({ contacts: 5, blocksSkipped: 1 });
    expect(operations.undo).toHaveBeenCalledWith(T, expect.objectContaining({ id: "op" }));
    expect(rewriter.restore).toHaveBeenCalledWith(T, [CHANGE]);
  });

  it("solo dentro de 7 días, una sola vez, y solo lo que existe", async () => {
    await expect(setup().service.undo(T, "op")).rejects.toThrow("no existe");
    await expect(setup({ found: stored({ undoneAt: "2026-11-11T00:00:00.000Z" }) }).service.undo(T, "op")).rejects.toThrow("ya se deshizo");
    const late = setup({ found: stored({ createdAt: "2026-11-05T11:00:00.000Z" }) });
    await expect(late.service.undo(T, "op")).rejects.toThrow("durante 7 días");
    expect(late.operations.undo).not.toHaveBeenCalled();
  });
});
