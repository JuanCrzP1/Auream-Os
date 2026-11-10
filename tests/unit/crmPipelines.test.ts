import { describe, expect, it } from "vitest";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import { requirePipelineDraft } from "../../domains/crm/domain/Pipeline.js";
import { pipelineMetrics } from "../../domains/crm/domain/PipelineMetrics.js";
import { OWNER, crmWorld } from "./helpers/crmFakes.js";

// ---------------------------------------------------------------------------
// Embudos: cada etapa es una etiqueta (se reutiliza la que ya exista con ese
// nombre), una etiqueta es etapa de un solo embudo, y los números del embudo
// se cuentan de forma acumulada (quien pagó ya pasó por «Interesado»).
// ---------------------------------------------------------------------------

const stages = [
  { name: "Nuevo", outcome: "open" as const },
  { name: "Pagó", outcome: "won" as const }
];

describe("requirePipelineDraft", () => {
  it("pide nombre, al menos una etapa abierta y una de compra, y nombres sin repetir", () => {
    expect(() => requirePipelineDraft({ name: " ", stages })).toThrow("El embudo necesita un nombre.");
    expect(() => requirePipelineDraft({ name: "V", stages: [stages[0]!, { name: "Otro", outcome: "open" }] })).toThrow("Falta una etapa de «Ya compró».");
    expect(() => requirePipelineDraft({ name: "V", stages: [...stages, { name: "nuevo", outcome: "open" }] })).toThrow("Hay dos etapas llamadas «nuevo».");
    expect(() => requirePipelineDraft({ name: "V", stages: [{ name: "Solo", outcome: "open" }] })).toThrow(ValidationError);
  });

  it("la etapa de entrada debe ser de «Aún no compra» y la de compra de «Ya compró»", () => {
    expect(() => requirePipelineDraft({ name: "V", stages, entryStage: 1 })).toThrow("Los contactos nuevos entran en una etapa de «Aún no compra».");
    expect(() => requirePipelineDraft({ name: "V", stages, saleStage: 0 })).toThrow("Quien compra pasa a una etapa de «Ya compró».");
    expect(requirePipelineDraft({ name: "  Ventas   de video ", stages, entryStage: 0, saleStage: 1 })).toMatchObject({ name: "Ventas de video", entryStage: 0, saleStage: 1 });
  });
});

describe("PipelineServices", () => {
  it("el embudo de ejemplo crea sus etiquetas, o usa las que ya existen con ese nombre", async () => {
    const world = crmWorld();
    world.labels.set("existing", { id: "existing", name: "Interesado", color: "#123456" });
    const created = await world.pipelineServices.createStarter(OWNER);
    expect(created.stages.map((stage) => stage.name)).toEqual(["Nuevo", "Interesado", "Pidió precio", "Pagó", "Entregado", "Perdido"]);
    expect(created.stages[1]!.labelId).toBe("existing");
    expect(created.entryStageId).toBe(created.stages[0]!.id);
    expect(created.saleStageId).toBe(created.stages[3]!.id);
  });

  it("una etiqueta no puede ser etapa de dos embudos", async () => {
    const world = crmWorld();
    await world.pipelineServices.create(OWNER, { name: "Ventas", stages });
    await expect(world.pipelineServices.create(OWNER, { name: "Mayoristas", stages })).rejects.toThrow("«Nuevo» ya es una etapa del embudo «Ventas». Usa otro nombre.");
  });

  it("renombrar una etapa renombra su etiqueta; quitarla no borra la etiqueta", async () => {
    const world = crmWorld();
    const created = await world.pipelineServices.create(OWNER, { name: "Ventas", stages: [...stages, { name: "Perdido", outcome: "lost" }] });
    const [nuevo, pago] = created.stages;
    const updated = await world.pipelineServices.update(OWNER, created.id, {
      name: "Ventas",
      stages: [{ id: nuevo!.id, name: "Recién llegado", outcome: "open" }, { id: pago!.id, name: "Pagó", outcome: "won" }]
    });
    expect(updated.stages.map((stage) => stage.name)).toEqual(["Recién llegado", "Pagó"]);
    expect(world.labels.get(nuevo!.labelId)!.name).toBe("Recién llegado");
    expect([...world.labels.values()].some((label) => label.name === "Perdido")).toBe(true);
  });

  it("no acepta etapas de otro embudo ni nombres de embudo repetidos", async () => {
    const world = crmWorld();
    const a = await world.pipelineServices.create(OWNER, { name: "Ventas", stages });
    const b = await world.pipelineServices.create(OWNER, { name: "Mayoristas", stages: [{ name: "Contacto", outcome: "open" }, { name: "Cerrado", outcome: "won" }] });
    await expect(world.pipelineServices.update(OWNER, b.id, { name: "Mayoristas", stages: [{ id: a.stages[0]!.id, name: "Nuevo", outcome: "open" }, { name: "X", outcome: "won" }] })).rejects.toThrow("no es de este embudo");
    await expect(world.pipelineServices.update(OWNER, b.id, { name: "ventas", stages: [{ name: "Y", outcome: "open" }, { name: "Z", outcome: "won" }] })).rejects.toThrow("Ya hay un embudo llamado «ventas».");
  });

  it("lista los embudos con quién puede ser responsable (sin los de solo lectura)", async () => {
    const world = crmWorld();
    await world.pipelineServices.createStarter(OWNER);
    const list = await world.pipelineServices.list({ ...OWNER, canManage: false });
    expect(list.members.map((member) => member.name)).toEqual(["Camilo", "Sofía"]);
    expect(list).toMatchObject({ canWrite: true, canManage: false });
  });
});

describe("pipelineMetrics", () => {
  it("avance acumulado, cierre sobre todos (con perdidos) y sin dividir por cero", () => {
    const pipeline = {
      stages: [
        { id: "a", outcome: "open", position: 0 },
        { id: "b", outcome: "open", position: 1 },
        { id: "c", outcome: "won", position: 2 },
        { id: "x", outcome: "lost", position: 3 }
      ]
    } as never;
    const metrics = pipelineMetrics(pipeline, { counts: new Map([["a", 50], ["b", 30], ["c", 20], ["x", 25]]), openTotals: [], wonTotals: [], wonCount: 0, avgDaysToClose: null });
    expect(metrics.advance).toEqual([0.5, 0.4]);
    expect(metrics.closeRate).toBe(20 / 125);
    expect(metrics).toMatchObject({ openCount: 80, lostCount: 25 });
    expect(pipelineMetrics(pipeline, { counts: new Map(), openTotals: [], wonTotals: [], wonCount: 0, avgDaysToClose: null })).toMatchObject({ closeRate: null, advance: [null, null] });
  });
});
