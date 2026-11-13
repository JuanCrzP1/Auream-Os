import { describe, expect, it, vi } from "vitest";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { LabelMerge, LabelUse } from "../../contracts/LabelManagementContracts.js";
import { labelKey, normalizeLabelName } from "../../domains/contacts/domain/Label.js";
import { flowLabelUses, renameLabelInFlow } from "../../domains/labels/domain/flowLabels.js";
import { deleteProblem, duplicatesOf, mergeProblem } from "../../domains/labels/domain/labelRules.js";
import { LabelManagementServices, type LabelActor } from "../../domains/labels/application/LabelManagementServices.js";
import { LabelMergeRunner } from "../../domains/labels/application/LabelMergeRunner.js";

// ---------------------------------------------------------------------------
// Etiquetas: «Pagado» y «‎Pagado» (con un carácter invisible, como las trae
// WhatsApp) son la misma; quién usa cada una (también los flujos, que la
// nombran); cambiarle el nombre sin romper los flujos; y unir una en otra:
// primero sus usos, después sus clientes por tandas, al final se borra. Una
// etapa del CRM no se pierde por accidente.
// ---------------------------------------------------------------------------

const LRM = "‎";
const stage: LabelUse = { kind: "stage", pipelineId: "p1", pipelineName: "Ventas" };

describe("el nombre de una etiqueta", () => {
  it("sin caracteres invisibles, y se compara como la lee una persona", () => {
    expect(normalizeLabelName(`${LRM}Pagado  `)).toBe("Pagado");
    expect(new Set([labelKey("Pagado"), labelKey(`${LRM}pagado`), labelKey("PAGÁDO")]).size).toBe(1);
    expect(labelKey("Pago")).not.toBe(labelKey("Pagado"));
  });
});

describe("repetidas", () => {
  it("propone quedarse con la etapa del CRM (si no, la limpia y con más clientes)", () => {
    const duplicates = duplicatesOf([
      { id: "a", name: `${LRM}Pagado`, contactCount: 2454, uses: [] },
      { id: "b", name: "Pagado", contactCount: 3011, uses: [stage] },
      { id: "c", name: "VIP", contactCount: 3, uses: [] }
    ]);
    expect(duplicates).toEqual([{ name: "Pagado", keepId: "b", otherIds: ["a"] }]);
    expect(duplicatesOf([{ id: "x", name: `${LRM}Nuevo`, contactCount: 50, uses: [] }, { id: "y", name: "nuevo", contactCount: 10, uses: [] }])[0]).toMatchObject({ keepId: "y", name: "nuevo" });
    // Dos etapas que se llaman igual no se proponen unir: el embudo perdería una.
    expect(duplicatesOf([{ id: "a", name: "Pagado", contactCount: 1, uses: [stage] }, { id: "b", name: "pagado", contactCount: 1, uses: [{ ...stage, pipelineName: "Otro" }] }])).toEqual([]);
  });

  it("una etapa no se une en otra ni se borra sin más; una que se usa pide a dónde pasar sus usos", () => {
    const etapa = { id: "a", name: "Pagado", contactCount: 1, uses: [stage] };
    const suelta = { id: "b", name: "Pagó", contactCount: 1, uses: [] };
    expect(mergeProblem(etapa, suelta)).toContain("es una etapa del embudo «Ventas»");
    expect(mergeProblem(suelta, etapa)).toBeNull();
    expect(mergeProblem(suelta, suelta)).toContain("consigo misma");
    expect(deleteProblem(etapa)).toContain("etapa del embudo");
    expect(deleteProblem({ ...suelta, uses: [{ kind: "webhook", id: "w", name: "Hotmart" }] })).toContain("elige a qué etiqueta pasar");
    expect(deleteProblem(suelta)).toBeNull();
  });
});

const flow = (nodes: Record<string, { type: string; config: Record<string, unknown> }>): BuilderFlowSnapshot =>
  ({ flow: { key: "ventas", name: "Ventas" }, nodes: Object.fromEntries(Object.entries(nodes).map(([id, node]) => [id, { id, name: id, content: {}, ...node }])) }) as never;

describe("en los flujos", () => {
  const draft = flow({
    pone: { type: "tags", config: { action: "add", tags: [`${LRM}Pagado`, "VIP"] } },
    quita: { type: "tags", config: { action: "remove", tags: ["pagado"] } },
    pregunta: { type: "condition", config: { rules: [{ category: "tag", value: "Pagado" }, { category: "customField", field: "x", value: "Pagado" }] } }
  });

  it("dónde la pone, la quita o la pregunta, aunque esté escrita distinto", () => {
    expect(flowLabelUses([draft]).get(labelKey("Pagado"))?.map((use) => [use.blockId, use.how])).toEqual([["pone", "adds"], ["quita", "removes"], ["pregunta", "checks"]]);
  });

  it("renombrar cambia el nombre en esos bloques, sin repetirlo y sin tocar lo demás", () => {
    const result = renameLabelInFlow(draft, { from: ["Pagado"], to: "Pagó" });
    expect(result.changed).toBe(3);
    expect(result.draft.nodes["pone"]!.config["tags"]).toEqual(["Pagó", "VIP"]);
    expect((result.draft.nodes["pregunta"]!.config["rules"] as unknown[])[1]).toEqual({ category: "customField", field: "x", value: "Pagado" });
    expect(renameLabelInFlow(flow({ t: { type: "tags", config: { tags: ["Pagado", "Pagó"] } } }), { from: ["Pagado"], to: "Pagó" }).draft.nodes["t"]!.config["tags"]).toEqual(["Pagó"]);
    expect(renameLabelInFlow(draft, { from: ["Otra"], to: "X" }).changed).toBe(0);
  });
});

const actor = (over: Partial<LabelActor> = {}): LabelActor => ({ tenantId: "t", actorId: "u1", canManage: true, canEdit: true, canSeeSales: true, ...over });
// La repetida es la más antigua: los flujos que dicen «Pagado» le ponen esa (el motor usa la más antigua).
const LABELS = [
  { id: "11111111-1111-4111-8111-111111111111", tenantId: "t", name: "Pagado", color: "#22c55e", createdAt: "2026-02-01T00:00:00Z", contactCount: 3011 },
  { id: "22222222-2222-4222-8222-222222222222", tenantId: "t", name: `${LRM}Pagado`, color: "#64748b", createdAt: "2026-01-01T00:00:00Z", contactCount: 2454 }
];
const [PAGADO, OTRA] = LABELS;

function setup() {
  const catalog = { list: vi.fn(async () => LABELS), findById: vi.fn(async (_t: string, id: string) => LABELS.find((label) => label.id === id) ?? null), update: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
  const references = { byId: async () => [{ labelId: PAGADO!.id, use: stage }], byName: async () => [], sales: async () => [{ labelId: PAGADO!.id, currency: "COP", amount: 9_800_000, sales: 40 }] };
  const flows = { drafts: async () => [flow({ pone: { type: "tags", config: { tags: [`${LRM}Pagado`] } } })], rename: vi.fn(async () => ["Bienvenida"]) };
  const rewriter = { replace: vi.fn(async () => undefined), rename: vi.fn(async () => undefined) };
  const merge: LabelMerge = { id: "m1", fromName: OTRA!.name, intoId: PAGADO!.id, intoName: "Pagado", total: 2454, moved: 0, status: "running", error: null, createdAt: "" };
  const merges = { start: vi.fn(async () => merge), find: vi.fn(), recent: async () => [], advance: vi.fn(), finish: vi.fn() };
  const queue = { next: vi.fn(async () => undefined) };
  const services = new LabelManagementServices(catalog, references, flows, rewriter, merges, queue, () => new Date("2026-11-13T12:00:00Z"), () => "m1");
  return { catalog, flows, rewriter, merges, queue, services };
}

describe("el servicio", () => {
  it("dice quién usa cada una, lo que vendieron y las repetidas; las ventas, solo a quien las ve", async () => {
    const { services } = setup();
    const view = await services.overview(actor());
    expect(view.labels[0]).toMatchObject({ name: "Pagado", contactCount: 3011, uses: [stage], sales: [{ currency: "COP", amount: 9_800_000, sales: 40 }] });
    expect(view.labels[0]!.uses).toEqual([stage]);
    expect(view.labels[1]!.uses).toEqual([{ kind: "flow", flowKey: "ventas", flowName: "Ventas", blockId: "pone", blockName: "pone", how: "adds" }]);
    expect(view.duplicates).toEqual([{ name: "Pagado", keepId: PAGADO!.id, otherIds: [OTRA!.id] }]);
    expect((await services.overview(actor({ canSeeSales: false }))).labels[0]!.sales).toBeNull();
  });

  it("unir: primero los flujos y lo demás, después la cola; avisa del flujo que no pudo tocar", async () => {
    const { services, flows, rewriter, queue } = setup();
    const result = await services.merge(actor(), { from: OTRA!.id, into: PAGADO!.id });
    expect(flows.rename).toHaveBeenCalledWith("t", { from: [OTRA!.name], to: "Pagado" });
    expect(rewriter.replace).toHaveBeenCalledWith("t", expect.objectContaining({ id: OTRA!.id }), expect.objectContaining({ id: PAGADO!.id }));
    expect(queue.next).toHaveBeenCalledWith("t", "m1", 0);
    expect(result.flowsSkipped).toEqual(["Bienvenida"]);
    await expect(services.merge(actor(), { from: PAGADO!.id, into: OTRA!.id })).rejects.toThrow("es una etapa del embudo «Ventas»");
    await expect(services.merge(actor({ canManage: false }), { from: OTRA!.id, into: PAGADO!.id })).rejects.toThrow("dueños y administradores");
  });

  it("renombrar es de dueños y administradores y cambia los flujos; el color lo cambia quien edita", async () => {
    const { services, flows, rewriter, catalog } = setup();
    await expect(services.update(actor({ canManage: false }), PAGADO!.id, { name: "Pagó" })).rejects.toThrow("los flujos la usan por su nombre");
    await services.update(actor({ canManage: false }), PAGADO!.id, { color: "#0ea5e9" });
    expect(flows.rename).not.toHaveBeenCalled();
    await services.update(actor(), PAGADO!.id, { name: "Pagó" });
    expect(flows.rename).toHaveBeenCalledWith("t", { from: ["Pagado"], to: "Pagó" });
    expect(rewriter.rename).toHaveBeenCalledWith("t", { from: ["Pagado"], to: "Pagó" });
    expect(catalog.update).toHaveBeenCalledTimes(2);
  });

  it("borrar una que se usa pide a dónde pasarla; con destino, es unir", async () => {
    const { services, catalog, queue } = setup();
    await expect(services.remove(actor(), OTRA!.id, null)).rejects.toThrow("elige a qué etiqueta pasar");
    await services.remove(actor(), OTRA!.id, PAGADO!.id);
    expect(queue.next).toHaveBeenCalled();
    expect(catalog.delete).not.toHaveBeenCalled();
  });
});

describe("las vueltas de la cola", () => {
  const run = (left: number, batch = 2) => {
    const pending = Array.from({ length: left }, (_, i) => `c${i}`);
    const merges = { find: vi.fn(async () => ({ id: "m1", fromId: "a", fromName: "‎Pagado", intoId: "b", intoName: "Pagado", status: "running" })), advance: vi.fn(), finish: vi.fn() };
    const holders = { holders: vi.fn(async (_t: string, _l: string, limit: number) => pending.slice(0, limit)), move: vi.fn(async () => undefined) };
    const catalog = { delete: vi.fn(async () => undefined) };
    const queue = { next: vi.fn(async () => undefined) };
    return { merges, holders, catalog, queue, runner: new LabelMergeRunner(merges as never, holders, catalog, queue, batch) };
  };

  it("pasa una tanda por el camino de siempre y pide otra vuelta si quedan", async () => {
    const { runner, holders, queue, catalog, merges } = run(5);
    await runner.run("t", "m1", 3);
    expect(holders.move).toHaveBeenCalledWith("t", "c0", "a", "b", "Se unió «‎Pagado» en «Pagado»");
    expect(merges.advance).toHaveBeenCalledWith("t", "m1", 2);
    expect(queue.next).toHaveBeenCalledWith("t", "m1", 4);
    expect(catalog.delete).not.toHaveBeenCalled();
  });

  it("la última tanda borra la de origen y la da por terminada; una ya terminada no hace nada", async () => {
    const last = run(1);
    await last.runner.run("t", "m1", 9);
    expect(last.catalog.delete).toHaveBeenCalledWith("t", "a");
    expect(last.merges.finish).toHaveBeenCalledWith("t", "m1", "done");
    const done = run(5);
    done.merges.find.mockResolvedValueOnce({ status: "done" } as never);
    await done.runner.run("t", "m1", 0);
    expect(done.holders.holders).not.toHaveBeenCalled();
  });
});
