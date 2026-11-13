import { describe, expect, it } from "vitest";
import { ContactFieldServices } from "../../domains/contact-fields/application/ContactFieldServices.js";
import { ContactFieldSync } from "../../domains/contact-fields/application/ContactFieldSync.js";
import { ContactFieldValueServices } from "../../domains/contact-fields/application/ContactFieldValueServices.js";
import { InMemoryContactFieldRepository, InMemoryContactFieldValues, InMemoryFieldOrigins } from "../../infrastructure/persistence/memory/InMemoryContactFields.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";

// ---------------------------------------------------------------------------
// La ficha de un cliente: de dónde salió cada dato. Si lo guardó un flujo, el
// bloque que llena esa clave (con su nombre de HOY); si hay dos que la llenan,
// el flujo; si lo puso el equipo, la persona. Editar no pisa lo demás.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const LAURA = "22222222-2222-4222-8222-222222222222";

const draft = (blocks: Array<[string, string, Record<string, unknown>]>): BuilderFlowSnapshot =>
  ({
    flow: { id: "f", key: "ventas", name: "Ventas" },
    nodes: Object.fromEntries(blocks.map(([id, type, config]) => [id, { id, type, name: id === "q" ? "¿En qué ciudad estás?" : `Bloque ${id}`, content: {}, config, metadata: {} }]))
  }) as unknown as BuilderFlowSnapshot;

async function setup(flows: BuilderFlowSnapshot[]) {
  let n = 0;
  const repository = new InMemoryContactFieldRepository();
  const values = new InMemoryContactFieldValues();
  values.seedContact(T, LAURA, { ciudad: "Medellín", __interno: 1 });
  const origins = new InMemoryFieldOrigins(() => "2026-11-13T12:00:00.000Z");
  const drafts = { drafts: async () => flows };
  const fields = new ContactFieldServices(repository, values, drafts, () => `00000000-0000-4000-8000-00000000000${++n}`);
  await fields.adopt(T, { fields: [{ key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"] }, { key: "ya_compro", label: "Ya compró", type: "boolean" }] });
  return {
    values,
    sync: new ContactFieldSync(repository, values, origins),
    ficha: new ContactFieldValueServices(repository, values, origins, drafts, { names: async () => new Map([["u-ana", "Ana"]]) })
  };
}

describe("de dónde salió cada dato", () => {
  it("lo que guardó un flujo: el bloque que llena esa clave, con su tipo y su nombre de hoy", async () => {
    const { sync, ficha } = await setup([draft([["q", "question", { targetKey: "ciudad" }], ["m", "message", { text: "{ciudad}" }]])]);
    await sync.persist(T, async () => LAURA, { ciudad: "bogota" }, "ventas");
    const read = await ficha.read(T, LAURA, true);
    expect(read.values).toEqual({ ciudad: "Bogotá" });
    expect(read.origins).toEqual({ ciudad: { source: "flow", at: "2026-11-13T12:00:00.000Z", flowName: "Ventas", blockName: "¿En qué ciudad estás?", blockType: "question" } });
  });

  it("si dos bloques la llenan, dice el flujo; si el flujo ya no existe, nada que inventar", async () => {
    const two = await setup([draft([["q", "question", { targetKey: "ciudad" }], ["menu", "menu", { saveToField: "ciudad" }]])]);
    await two.sync.persist(T, async () => LAURA, { ciudad: "Medellín" }, "ventas");
    expect((await two.ficha.read(T, LAURA, true)).origins.ciudad).toMatchObject({ flowName: "Ventas", blockName: null });

    const gone = await setup([]);
    await gone.sync.persist(T, async () => LAURA, { ciudad: "Medellín" }, "ventas");
    expect((await gone.ficha.read(T, LAURA, true)).origins.ciudad).toMatchObject({ source: "flow", flowName: null, blockName: null });
  });

  it("lo que puso el equipo: quién; borrar un dato borra también su origen; lo demás no se toca", async () => {
    const { ficha, values } = await setup([]);
    const saved = await ficha.update(T, LAURA, { changes: { ya_compro: "sí" } }, "u-ana");
    expect(saved.values).toEqual({ ciudad: "Medellín", ya_compro: true });
    expect(saved.origins.ya_compro).toMatchObject({ source: "team", actorName: "Ana" });

    const cleared = await ficha.update(T, LAURA, { changes: { ya_compro: null } }, "u-ana");
    expect(cleared.values).toEqual({ ciudad: "Medellín" });
    expect(cleared.origins).toEqual({});
    expect(await values.ofContact(T, LAURA)).toMatchObject({ __interno: 1 });
  });

  it("valida cada dato con su tipo y no deja tocar lo que no es un campo", async () => {
    const { ficha } = await setup([]);
    await expect(ficha.update(T, LAURA, { changes: { ciudad: "Cali" } }, "u-ana")).rejects.toThrow("«Ciudad» debe ser una de estas: Medellín o Bogotá.");
    await expect(ficha.update(T, LAURA, { changes: { otra: "x" } }, "u-ana")).rejects.toThrow("no es un campo");
    await expect(ficha.update(T, LAURA, { changes: "x" }, "u-ana")).rejects.toThrow("Manda los cambios");
    await expect(ficha.read(T, "33333333-3333-4333-8333-333333333333", true)).rejects.toThrow("no existe");
  });
});
