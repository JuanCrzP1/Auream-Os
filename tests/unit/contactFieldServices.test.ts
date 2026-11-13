import { describe, expect, it, vi } from "vitest";
import { ContactFieldServices } from "../../domains/contact-fields/application/ContactFieldServices.js";
import { ContactFieldSync } from "../../domains/contact-fields/application/ContactFieldSync.js";
import { InMemoryContactFieldRepository, InMemoryContactFieldValues, observedFrom } from "../../infrastructure/persistence/memory/InMemoryContactFields.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import type { FlowRunResult } from "../../contracts/FlowTimerContracts.js";
import type { InboundEnvelope } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Campos del cliente, el servicio: catálogo con en cuántos clientes está y
// quién lo usa; el primer día; borrar solo escribiendo la clave; límites; cada
// cuenta ve lo suyo. Y el turno de un flujo: lo que es un campo pasa al
// cliente, convertido; lo demás se queda en la conversación.
// ---------------------------------------------------------------------------

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const FLOW = {
  flow: { id: "f", key: "ventas", name: "Ventas" },
  nodes: {
    q: { id: "q", type: "question", name: "¿Ciudad?", content: {}, config: { targetKey: "ciudad" }, metadata: {} },
    m: { id: "m", type: "message", name: "Envío", content: {}, config: { text: "Enviamos a {ciudad}" }, metadata: {} },
    p: { id: "p", type: "payment-proof", name: "Comprobante", content: {}, config: { resultVariable: "pago_estado" }, metadata: {} }
  }
} as unknown as BuilderFlowSnapshot;

function services() {
  const repository = new InMemoryContactFieldRepository();
  const seen = observedFrom({ ciudad: [["Medellín", 40], ["Bogotá", 20], ["Cali", 12]], resposta: [["Sí", 3]], pago_estado: [["ok", 9]], "mi dato": [["x", 2]], "año": [["2026", 1]] });
  let next = 0;
  const id = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const values = new InMemoryContactFieldValues(new Map([[A, seen]]), 120);
  return { repository, fields: new ContactFieldServices(repository, values, { drafts: async (tenantId) => (tenantId === A ? [FLOW] : []) }, id) };
}

describe("el catálogo de campos", () => {
  it("el primer día propone lo que ya se guarda, con su tipo, y deja lo técnico al final", async () => {
    const { fields } = services();
    const { suggestions } = await fields.discover(A);
    expect(suggestions.map((entry) => [entry.key, entry.suggestedType, entry.technical])).toEqual([["ciudad", "list", false], ["resposta", "boolean", false], ["pago_estado", "text", true]]);
    expect(suggestions[0]).toMatchObject({ suggestedLabel: "Ciudad", suggestedOptions: ["Medellín", "Bogotá", "Cali"], filled: 72 });
    expect(suggestions[0]!.uses.map((use) => use.role)).toEqual(["fills", "reads"]);
    expect((await fields.list(A, true)).undefinedKeys).toBe(2);
  });

  it("convertirlos los vuelve campos con lleno y usos; el primer día ya no los propone", async () => {
    const { fields } = services();
    await fields.adopt(A, { fields: [{ label: "Ciudad", key: "ciudad", type: "list", options: ["Medellín", "Bogotá", "Cali"] }] });
    const list = await fields.list(A, false);
    expect(list).toMatchObject({ totalContacts: 120, undefinedKeys: 1, canManage: false });
    expect(list.fields).toEqual([expect.objectContaining({ key: "ciudad", filled: 72, uses: [expect.objectContaining({ blockName: "¿Ciudad?", role: "fills" }), expect.objectContaining({ blockName: "Envío", role: "reads" })] })]);
    expect(list.system.map((field) => field.key)).toContain("first_name");
    expect((await fields.discover(A)).suggestions.map((entry) => entry.key)).not.toContain("ciudad");
  });

  it("valida todo antes de guardar: si uno está mal no se crea ninguno", async () => {
    const { fields, repository } = services();
    await expect(fields.adopt(A, { fields: [{ label: "Ciudad", type: "text" }, { label: "Malo", key: "phone", type: "text" }] })).rejects.toThrow("ya lo llena Auream");
    expect(await repository.list(A)).toHaveLength(0);
    await expect(fields.adopt(A, { fields: [] })).rejects.toThrow("al menos un dato");
  });

  it("no repite claves, respeta el límite y cada cuenta ve lo suyo", async () => {
    const { fields } = services();
    await fields.create(A, { label: "Ciudad", type: "text" });
    await expect(fields.create(A, { label: "Ciudad", type: "text" })).rejects.toThrow("Ya hay un campo");
    expect((await fields.list(B, true)).fields).toEqual([]);
    expect((await fields.discover(B)).suggestions).toEqual([]);
    for (let n = 0; n < 100; n += 1) await fields.create(B, { label: `Dato ${n}`, type: "text" });
    await expect(fields.create(B, { label: "Uno más", type: "text" })).rejects.toThrow("hasta 100 campos");
  });

  it("editar cambia nombre y tipo, nunca la clave; otra cuenta no lo encuentra", async () => {
    const { fields } = services();
    const created = await fields.create(A, { label: "Ciudad", type: "text" });
    expect(await fields.update(A, created.id, { label: "Ciudad de envío", key: "otra" })).toMatchObject({ key: "ciudad", label: "Ciudad de envío" });
    await expect(fields.update(B, created.id, { label: "X" })).rejects.toThrow("ya no existe");
    await expect(fields.update(A, "no-es-un-id", { label: "X" })).rejects.toThrow("ya no existe");
  });

  it("borrar exige escribir la clave, y se lleva el dato de los clientes", async () => {
    const { fields, repository } = services();
    const created = await fields.create(A, { label: "Ciudad", type: "text" });
    await expect(fields.remove(A, created.id, "Ciudad")).rejects.toThrow("escribe «ciudad»");
    await expect(fields.remove(B, created.id, "ciudad")).rejects.toThrow("ya no existe");
    await fields.remove(A, created.id, " ciudad ");
    expect(repository.removed).toEqual(["ciudad"]);
  });
});

describe("lo que guarda un flujo pasa al cliente", () => {
  const definitions = [
    { id: "1", key: "ciudad", label: "Ciudad", type: "list" as const, options: ["Medellín", "Bogotá"], createdAt: "", updatedAt: "" },
    { id: "2", key: "presupuesto", label: "Presupuesto", type: "number" as const, options: [], createdAt: "", updatedAt: "" }
  ];

  it("solo los campos definidos, convertidos; lo que no encaja no se guarda", async () => {
    const merge = vi.fn(async () => undefined);
    const contact = vi.fn(async () => "contacto");
    const sync = new ContactFieldSync({ list: async () => definitions }, { merge });
    expect(await sync.persist(A, contact, { ciudad: "medellin", presupuesto: "Cartagena", otra: "x", __menu: 1 })).toEqual({ ciudad: "Medellín" });
    expect(merge).toHaveBeenCalledWith(A, "contacto", { ciudad: "Medellín" });
  });

  it("no busca al cliente si nada era un campo", async () => {
    const contact = vi.fn(async () => "contacto");
    const list = vi.fn(async () => definitions);
    const sync = new ContactFieldSync({ list }, { merge: vi.fn() });
    expect(await sync.persist(A, contact, { otra: "x" })).toEqual({});
    expect(await sync.persist(A, contact, { __interno: "x" })).toEqual({});
    expect(contact).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("el turno lo entrega al cliente, y si guardar falla el turno sigue", async () => {
    const MESSAGE = { tenantId: A, flowKey: "ventas", channel: "whatsapp", conversationKey: "k", userKey: "57300", messageId: "m", payload: { text: "Medellín" }, receivedAt: "2026-11-13T12:00:00.000Z" } as InboundEnvelope;
    const RESULT = { executionStatus: "waiting", outputMessages: [], contextPatch: { ciudad: "Medellín" }, nodeResult: {}, domainEvents: [], steps: [] } as unknown as FlowRunResult;
    const afterTurn = vi.fn(async () => { throw new Error("la base no responde"); });
    const turn = new FlowTurn({ handle: async () => RESULT }, { deliver: async () => ({ sent: 0, failures: [], results: [] }) }, { recordOutbound: async () => undefined }, { afterTurn: async () => undefined }, () => new Date(), undefined, { afterTurn });
    const target = { tenantId: A, connectionId: "c", phone: "57300", conversationKey: "k", flowKey: "ventas", conversationId: "chat" };
    await expect(turn.run(target, MESSAGE)).resolves.toMatchObject({ result: RESULT });
    expect(afterTurn).toHaveBeenCalledWith(A, MESSAGE, { ciudad: "Medellín" });
    await turn.run(target, MESSAGE).catch(() => undefined);
    const quiet = vi.fn(async () => undefined);
    await new FlowTurn({ handle: async () => ({ ...RESULT, contextPatch: {} }) }, { deliver: async () => ({ sent: 0, failures: [], results: [] }) }, { recordOutbound: async () => undefined }, { afterTurn: async () => undefined }, () => new Date(), undefined, { afterTurn: quiet }).run(target, MESSAGE);
    expect(quiet).not.toHaveBeenCalled();
  });
});
