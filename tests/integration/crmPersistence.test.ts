import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlContactRepository, SqlLabelRepository } from "../../infrastructure/persistence/sql/SqlContactRepositories.js";
import { SqlCrmPipelineRepository } from "../../infrastructure/persistence/sql/SqlCrmPipelineRepository.js";
import { LabelRulesContactRepository } from "../../domains/contacts/application/LabelRulesContactRepository.js";
import { StageLabelRules } from "../../domains/crm/application/StageLabelRules.js";
import { CrmEventsRelay } from "../../apps/api/composition/CrmEventsRelay.js";
import { composeCrmServices } from "../../apps/api/composition/composeCrmServices.js";
import type { CrmActor } from "../../domains/crm/application/crmViews.js";
import type { ApiConfig } from "../../apps/api/config/loadApiConfig.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// El CRM en PostgreSQL (rama `test`), armado como en producción: Contactos con
// sus reglas, el relevo de avisos y el CRM. Una etapa por embudo venga de donde
// venga la etiqueta, el tablero desde las etiquetas con valor y responsable,
// el historial, los seguimientos por día de la empresa y nada de otra cuenta.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

async function insertContact(tenantId: string, phone: string, name: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', $2, $3, $2) returning id", [tenantId, phone, name]);
  return result.rows[0]!.id;
}

function build() {
  const relay = new CrmEventsRelay();
  const errors: unknown[] = [];
  const contacts = new LabelRulesContactRepository(new SqlContactRepository(sql), new StageLabelRules(new SqlCrmPipelineRepository(sql)), relay, (error) => errors.push(error));
  const products = { findActive: async () => null };
  const crm = composeCrmServices({ config: { defaultTimezone: "America/Bogota" } as ApiConfig, sql, contacts, labels: new SqlLabelRepository(sql), products, onError: (error) => errors.push(error) });
  relay.attach(crm.tracker);
  return { crm: crm.routes, contacts, errors };
}

const actor = (tenantId: string): CrmActor => ({ tenantId, userId: "00000000-0000-4000-8000-0000000000aa", canWrite: true, canManage: true });

beforeAll(() => {
  sql = createTestSqlClient();
});

beforeEach(async () => {
  await cleanupTestData(sql);
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("CRM en PostgreSQL", () => {
  it("una etapa por embudo, el tablero desde las etiquetas y el historial", async () => {
    const tenant = await insertTenant("crm-a");
    const { crm, contacts, errors } = build();
    const pipeline = await crm.pipelines.createStarter(actor(tenant));
    const stage = (name: string) => pipeline.stages.find((candidate) => candidate.name === name)!;
    const laura = await insertContact(tenant, "573001112233", "Laura Gómez");
    const pedro = await insertContact(tenant, "573004445566", "Pedro Ríos");

    // Un flujo pone «Interesado» y después «Pagó»: queda solo en «Pagó».
    await contacts.changeLabels(tenant, laura, { add: [stage("Interesado").labelId], remove: [] }, { kind: "flow", flowKey: "bienvenida" });
    await contacts.changeLabels(tenant, laura, { add: [stage("Pagó").labelId], remove: [] }, { kind: "flow", flowKey: "bienvenida" });
    const held = (await contacts.findById(tenant, laura))!.labels.map((label) => label.name);
    expect(held).toEqual(["Pagó"]);

    // Pedro, desde el tablero, con valor y responsable.
    await crm.board.move(actor(tenant), pipeline.id, pedro, { stageId: stage("Pidió precio").id });
    await crm.deals.update(actor(tenant), pipeline.id, pedro, { amount: "49.900", currency: "COP" });

    const board = await crm.board.view(actor(tenant), pipeline.id, {});
    const column = (name: string) => board.columns.find((candidate) => candidate.stageId === stage(name).id)!;
    expect(column("Pagó")).toMatchObject({ count: 1, cards: [expect.objectContaining({ name: "Laura Gómez", country: "CO" })] });
    expect(column("Pidió precio")).toMatchObject({ count: 1, totals: [{ amount: 49900, currency: "COP" }] });
    expect(board.metrics).toMatchObject({ openCount: 1, wonCount: 1, openTotals: [{ amount: 49900, currency: "COP" }], closeRate: 0.5 });

    expect((await crm.board.view(actor(tenant), pipeline.id, { search: "pedro" })).columns.reduce((sum, c) => sum + c.count, 0)).toBe(1);
    expect((await crm.board.view(actor(tenant), pipeline.id, { owner: "none" })).columns.reduce((sum, c) => sum + c.count, 0)).toBe(2);

    const history = await crm.deals.contact(actor(tenant), laura);
    expect(history.events.map((event) => [event.kind, event.source])).toEqual([["stage", "flow"], ["stage", "flow"]]);
    expect(history.deals).toEqual([expect.objectContaining({ stageId: stage("Pagó").id })]);
    expect(errors).toEqual([]);
  });

  it("guardar el embudo reemplaza las etapas; quitar una no borra su etiqueta ni a sus clientes", async () => {
    const tenant = await insertTenant("crm-b");
    const { crm, contacts } = build();
    const pipeline = await crm.pipelines.createStarter(actor(tenant));
    const ana = await insertContact(tenant, "573007778899", "Ana");
    const perdido = pipeline.stages.find((stage) => stage.name === "Perdido")!;
    await contacts.changeLabels(tenant, ana, { add: [perdido.labelId], remove: [] });
    const kept = pipeline.stages.filter((stage) => stage.name !== "Perdido").map((stage) => ({ id: stage.id, name: stage.name, outcome: stage.outcome }));
    const updated = await crm.pipelines.update(actor(tenant), pipeline.id, { name: "Ventas", stages: kept, entryStage: 0, saleStage: 3 });
    expect(updated.stages.map((stage) => stage.name)).toEqual(["Nuevo", "Interesado", "Pidió precio", "Pagó", "Entregado"]);
    expect((await contacts.findById(tenant, ana))!.labels.map((label) => label.name)).toEqual(["Perdido"]);
    const board = await crm.board.view(actor(tenant), pipeline.id, {});
    expect(board.columns.reduce((sum, column) => sum + column.count, 0)).toBe(0);
  });

  it("seguimientos por día de la empresa y nada de otra cuenta", async () => {
    const tenant = await insertTenant("crm-c");
    const other = await insertTenant("crm-d");
    const { crm } = build();
    const pipeline = await crm.pipelines.createStarter(actor(tenant));
    const laura = await insertContact(tenant, "573001112233", "Laura");
    const soon = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 3_600_000).toISOString();
    await crm.followUps.create(actor(tenant), { contactId: laura, title: "Confirmar pago", dueAt: soon, assigneeId: null });
    await crm.followUps.create(actor(tenant), { contactId: laura, title: "Llamar", dueAt: past, assigneeId: null });
    const all = await crm.followUps.list(actor(tenant), { bucket: "overdue", assignee: "all" });
    expect(all.followUps.map((followUp) => followUp.title)).toEqual(["Llamar"]);
    expect(all.counts.overdue).toBe(1);
    expect(all.counts.today + all.counts.upcoming).toBe(1);

    await expect(crm.board.view(actor(other), pipeline.id, {})).rejects.toThrow("Ese embudo no existe.");
    await expect(crm.deals.contact(actor(other), laura)).rejects.toThrow("Ese cliente no existe.");
    expect((await crm.followUps.list(actor(other), { bucket: "overdue", assignee: "all" })).followUps).toEqual([]);
  });
});
