import { describe, expect, it } from "vitest";
import { BoardServices } from "../../domains/crm/application/BoardServices.js";
import { DealServices } from "../../domains/crm/application/DealServices.js";
import type { FollowUpRepository } from "../../domains/crm/application/CrmRepositories.js";
import { STARTER_PIPELINE } from "../../domains/crm/domain/Pipeline.js";
import { OWNER, T, crmWorld } from "./helpers/crmFakes.js";

// ---------------------------------------------------------------------------
// El CRM al día sin que nadie lo toque: un contacto nuevo entra a «Nuevo»,
// con el precio del producto en su país y un responsable por turnos; un flujo
// lo mueve con el bloque Etiquetas; una venta aprobada lo pasa a «Pagó» con
// el valor real. Todo queda en el historial con quién lo hizo.
// ---------------------------------------------------------------------------

async function setup(options: { autoAssign?: boolean } = {}) {
  const world = crmWorld();
  const created = await world.pipelineServices.create(OWNER, { ...STARTER_PIPELINE, defaultProductId: "video", autoAssign: options.autoAssign ?? false });
  const stage = (name: string) => created.stages.find((candidate) => candidate.name === name)!;
  const noFollowUps = { list: async () => [] } as unknown as FollowUpRepository;
  const board = new BoardServices(world.pipelineServices, {} as never, world.labeler);
  const deals = new DealServices(world.pipelineServices, world.pipelineRepository, world.dealRepository, world.eventLog, noFollowUps, world.labeler, world.catalog, world.team);
  return { world, pipeline: created, stage, board, deals };
}

describe("StageTracker", () => {
  it("un contacto nuevo entra a la etapa de entrada con el precio de su país y un responsable por turnos", async () => {
    const { world, pipeline, stage } = await setup({ autoAssign: true });
    world.addContact("c1", "573001112233");
    world.addContact("c2", "584121112233");
    await world.tracker.contactCreated(T, "c1");
    await world.tracker.contactCreated(T, "c2");
    expect(world.labelsOf("c1")).toEqual([stage("Nuevo").labelId]);
    expect(world.deals.get(`${pipeline.id}:c1`)).toMatchObject({ stageId: stage("Nuevo").id, value: { amount: 49900, currency: "COP" }, productName: "Video personalizado", ownerId: "u-owner" });
    // Venezuela cobra en dólares; el siguiente turno es de Sofía (la de solo lectura no entra en el reparto).
    expect(world.deals.get(`${pipeline.id}:c2`)).toMatchObject({ value: { amount: 12.5, currency: "USD" }, ownerId: "u-sofia" });
    expect(world.events.filter((event) => event.contactId === "c1").map((event) => [event.kind, event.source])).toEqual([["stage", "auto"], ["owner", "auto"]]);
  });

  it("un flujo que pone la etiqueta de otra etapa lo mueve y lo anota con su flujo", async () => {
    const { world, pipeline, stage } = await setup();
    world.addContact("c1");
    await world.tracker.contactCreated(T, "c1");
    await world.labeler.change(T, "c1", { add: [stage("Pidió precio").labelId], remove: [] }, { kind: "flow", flowKey: "bienvenida" });
    expect(world.labelsOf("c1")).toEqual([stage("Pidió precio").labelId]);
    expect(world.deals.get(`${pipeline.id}:c1`)!.stageId).toBe(stage("Pidió precio").id);
    expect(world.events.at(-1)).toMatchObject({ kind: "stage", fromStageId: stage("Nuevo").id, toStageId: stage("Pidió precio").id, source: "flow", flowKey: "bienvenida" });
  });

  it("una venta aprobada lo pasa a «Pagó» con el valor real; si ya va más adelante, no lo devuelve", async () => {
    const { world, pipeline, stage } = await setup();
    world.addContact("c1");
    await world.tracker.contactCreated(T, "c1");
    await world.tracker.saleApproved(T, { contactId: "c1", amount: 64900, currency: "COP", productId: "video", productName: "Video + Portada" });
    expect(world.labelsOf("c1")).toEqual([stage("Pagó").labelId]);
    expect(world.deals.get(`${pipeline.id}:c1`)).toMatchObject({ value: { amount: 64900, currency: "COP" }, productName: "Video + Portada" });
    expect(world.deals.get(`${pipeline.id}:c1`)!.wonAt).not.toBeNull();
    await world.labeler.change(T, "c1", { add: [stage("Entregado").labelId], remove: [] }, { kind: "user" });
    await world.tracker.saleApproved(T, { contactId: "c1", amount: 15000, currency: "COP", productId: null, productName: "Portada" });
    expect(world.labelsOf("c1")).toEqual([stage("Entregado").labelId]);
  });

  it("quitarle la etiqueta lo saca del embudo y queda en el historial", async () => {
    const { world, pipeline, stage } = await setup();
    world.addContact("c1");
    await world.tracker.contactCreated(T, "c1");
    await world.labeler.change(T, "c1", { add: [], remove: [stage("Nuevo").labelId] }, { kind: "user", userId: "u-sofia" });
    expect(world.deals.get(`${pipeline.id}:c1`)!.stageId).toBeNull();
    expect(world.events.at(-1)).toMatchObject({ kind: "left", fromStageId: stage("Nuevo").id, actorId: "u-sofia" });
  });

  it("un fallo del CRM nunca lanza (no rompe el flujo ni el chat)", async () => {
    const { world } = await setup();
    await expect(world.tracker.labelsChanged(T, "no-existe", { added: ["x"], removed: [] }, { kind: "flow" })).resolves.toBeUndefined();
    await expect(world.tracker.saleApproved(T, { contactId: "no-existe", amount: 1, currency: "COP", productId: null, productName: null })).resolves.toBeUndefined();
  });
});

describe("mover y editar desde el tablero", () => {
  it("mover a «Perdido» guarda el motivo; mover pide una etapa del embudo y un cliente que exista", async () => {
    const { world, pipeline, stage, board } = await setup();
    world.addContact("11111111-1111-4111-8111-111111111111");
    const contactId = "11111111-1111-4111-8111-111111111111";
    await board.move(OWNER, pipeline.id, contactId, { stageId: stage("Perdido").id, reason: "Le pareció caro" });
    expect(world.events.at(-1)).toMatchObject({ kind: "stage", toStageId: stage("Perdido").id, source: "user", actorId: "u-owner", detail: "Le pareció caro" });
    await expect(board.move(OWNER, pipeline.id, contactId, { stageId: "otra" })).rejects.toThrow("Esa etapa no es de este embudo.");
    await expect(board.move(OWNER, pipeline.id, "22222222-2222-4222-8222-222222222222", { stageId: stage("Nuevo").id })).rejects.toThrow("Ese cliente no existe.");
  });

  it("cambiar valor y responsable queda en el historial; el producto pone su precio del país", async () => {
    const { world, pipeline, stage, deals } = await setup();
    const contactId = "11111111-1111-4111-8111-111111111111";
    world.addContact(contactId, "584121112233", [stage("Interesado").labelId]);
    // Tenía la etiqueta antes de que existiera el embudo: el registro se crea al tocarlo.
    const updated = await deals.update(OWNER, pipeline.id, contactId, { productId: "video", ownerId: "u-sofia" });
    expect(updated).toMatchObject({ stageId: stage("Interesado").id, value: { amount: 12.5, currency: "USD" }, ownerId: "u-sofia" });
    expect(world.events.map((event) => [event.kind, event.detail])).toEqual([["value", "$ 12,5 USD"], ["owner", "Sofía"]]);
    await expect(deals.update(OWNER, pipeline.id, contactId, { ownerId: "u-viewer" })).rejects.toThrow("solo lectura");
    await expect(deals.update(OWNER, pipeline.id, contactId, { amount: "-5", currency: "COP" })).rejects.toThrow("mayor que cero");
    expect((await deals.update(OWNER, pipeline.id, contactId, { amount: "49.900", currency: "cop" })).value).toEqual({ amount: 49900, currency: "COP" });
  });

  it("la ficha dice en qué etapa va en cada embudo, aunque no tenga registro todavía", async () => {
    const { world, pipeline, stage, deals } = await setup();
    const contactId = "11111111-1111-4111-8111-111111111111";
    world.addContact(contactId, null, [stage("Pagó").labelId]);
    const view = await deals.contact(OWNER, contactId);
    expect(view.deals).toEqual([expect.objectContaining({ pipelineId: pipeline.id, stageId: stage("Pagó").id, value: null, enteredAt: null })]);
  });
});

describe("Entrada automática (quien escribe y aún no está en el embudo)", () => {
  it("un cliente de antes que escribe entra a la etapa de entrada; quien ya está no se mueve", async () => {
    const { world, stage } = await setup();
    world.addContact("viejo");
    world.addContact("avanzado", "573001112233", [stage("Pagó").labelId]);
    await world.tracker.contactWrote(T, "viejo");
    await world.tracker.contactWrote(T, "avanzado");
    expect(world.labelsOf("viejo")).toEqual([stage("Nuevo").labelId]);
    expect(world.labelsOf("avanzado")).toEqual([stage("Pagó").labelId]);
  });

  it("con «solo los de anuncios», entran solo quienes llegaron por un anuncio", async () => {
    const world = crmWorld();
    const created = await world.pipelineServices.create(OWNER, { ...STARTER_PIPELINE, entrySource: "ads" });
    const nuevo = created.stages.find((candidate) => candidate.name === "Nuevo")!;
    world.addContact("organico");
    world.addContact("anuncio", "573001112233", [], true);
    await world.tracker.contactCreated(T, "organico");
    await world.tracker.contactWrote(T, "anuncio");
    expect(world.labelsOf("organico")).toEqual([]);
    expect(world.labelsOf("anuncio")).toEqual([nuevo.labelId]);
  });
});
