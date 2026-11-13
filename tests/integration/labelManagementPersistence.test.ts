import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlContactRepository, SqlLabelRepository } from "../../infrastructure/persistence/sql/SqlContactRepositories.js";
import { SqlCrmPipelineRepository } from "../../infrastructure/persistence/sql/SqlCrmPipelineRepository.js";
import { SqlLabelMerges } from "../../infrastructure/persistence/sql/SqlLabelMerges.js";
import { SqlLabelReferences } from "../../infrastructure/persistence/sql/SqlLabelReferences.js";
import { LabelRulesContactRepository } from "../../domains/contacts/application/LabelRulesContactRepository.js";
import { StageLabelRules } from "../../domains/crm/application/StageLabelRules.js";
import { LabelManagementServices } from "../../domains/labels/application/LabelManagementServices.js";
import { LabelMergeRunner } from "../../domains/labels/application/LabelMergeRunner.js";
import { CrmEventsRelay } from "../../apps/api/composition/CrmEventsRelay.js";
import { composeCrmServices } from "../../apps/api/composition/composeCrmServices.js";
import type { ApiConfig } from "../../apps/api/config/loadApiConfig.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Etiquetas en PostgreSQL (rama `test`), con Contactos y el CRM como en
// producción. El caso real: «‎Pagado» (con un carácter invisible) repetida
// junto a la etapa «Pagó» de un embudo. Unirla en la etapa pasa a sus clientes
// a esa etapa (dejando la anterior), cambia el público de una difusión por
// enviar y el webhook que la nombraba, y al final la borra.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const ACTOR = "00000000-0000-4000-8000-0000000000aa";

async function insert<T = { id: string }>(text: string, params: unknown[]): Promise<T> {
  return (await sql.query<T & Record<string, unknown>>(text, params)).rows[0] as T;
}

function build() {
  const relay = new CrmEventsRelay();
  const errors: unknown[] = [];
  const labels = new SqlLabelRepository(sql);
  const contacts = new LabelRulesContactRepository(new SqlContactRepository(sql), new StageLabelRules(new SqlCrmPipelineRepository(sql)), relay, (error) => errors.push(error));
  const crm = composeCrmServices({ config: { defaultTimezone: "America/Bogota" } as ApiConfig, sql, contacts, labels, products: { findActive: async () => null }, onError: (error) => errors.push(error) });
  relay.attach(crm.tracker);
  const merges = new SqlLabelMerges(sql);
  // La cola corre en el acto: cada vuelta pide la siguiente.
  const queue = { next: async (tenantId: string, mergeId: string, round: number) => runner.run(tenantId, mergeId, round) };
  const runner: LabelMergeRunner = new LabelMergeRunner(
    merges,
    { holders: (t, l, n) => merges.holders(t, l, n), move: (t, c, from, into, note) => contacts.changeLabels(t, c, { add: [into], remove: [from] }, { kind: "auto", note }) },
    labels,
    queue,
    2
  );
  const flows = { drafts: async () => [], rename: async () => [] };
  const services = new LabelManagementServices(labels, new SqlLabelReferences(sql), flows, merges, merges, queue);
  return { crm: crm.routes, contacts, labels, services, errors };
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("Etiquetas en PostgreSQL", () => {
  it("unir la repetida en la etapa: sus clientes entran a la etapa, sus usos cambian y se borra", async () => {
    const tenant = (await insert("insert into tenants (key, name) values ($1, 'labels') returning id", [TEST_KEY_PREFIX + "labels"])).id;
    const { crm, contacts, labels, services, errors } = build();
    const actor = { tenantId: tenant, actorId: ACTOR, canManage: true, canEdit: true, canSeeSales: true };
    const pipeline = await crm.pipelines.createStarter({ tenantId: tenant, userId: ACTOR, canWrite: true, canManage: true });
    const pago = pipeline.stages.find((stage) => stage.name === "Pagó")!;
    const interesado = pipeline.stages.find((stage) => stage.name === "Interesado")!;

    // La repetida no se puede crear hoy por la app (se lee igual que otra): se inserta como venía de antes.
    const repeated = (await insert("insert into contact_labels (tenant_id, name) values ($1, $2) returning id", [tenant, "‎Pagó"])).id;
    await expect(labels.create({ id: "11111111-1111-4111-8111-111111111111", tenantId: tenant, name: "pago", color: "#64748b", createdAt: new Date().toISOString() })).rejects.toThrow("Ya existe una etiqueta llamada");

    const contact = async (phone: string) => (await insert("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', $2, $2, $2) returning id", [tenant, phone])).id;
    const laura = await contact("573001110001");
    const pedro = await contact("573001110002");
    const ana = await contact("573001110003");
    await contacts.changeLabels(tenant, laura, { add: [interesado.labelId], remove: [] }, { kind: "flow" });
    for (const id of [laura, pedro, ana]) await sql.query("insert into contact_label_assignments (tenant_id, contact_id, label_id) values ($1, $2, $3)", [tenant, id, repeated]);
    await sql.query(
      `insert into broadcasts (id, tenant_id, name, status, variants, audience, connection_ids, settings) values (gen_random_uuid(), $1, 'Black Friday', 'scheduled', '[{"kind":"message","text":"Hola","media":null}]'::jsonb, $2::jsonb, array[gen_random_uuid()], '{}'::jsonb)`,
      [tenant, JSON.stringify({ labelIds: [repeated], excludeLabelIds: [] })]
    );
    await sql.query(`insert into inbound_webhooks (id, tenant_id, name, secret_envelope, mapping) values (gen_random_uuid(), $1, 'Hotmart', 'x', $2::jsonb)`, [
      tenant,
      JSON.stringify({ addTags: ["‎Pagó", "VIP"], removeTags: [] })
    ]);
    const product = (await insert("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
    await sql.query("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, contact_id, sold_at) values ($1, 'approved', 'manual', $2, 'Video', 50000, 'COP', $3, now())", [tenant, product, pedro]);

    const before = await services.overview(actor);
    const row = before.labels.find((label) => label.id === repeated)!;
    expect(row).toMatchObject({ contactCount: 3, sales: [{ currency: "COP", amount: 50000, sales: 1 }] });
    expect(row.uses.map((use) => use.kind)).toEqual(["broadcast"]);
    // El webhook dice «‎Pagó», pero el motor le pone la más antigua de las que se leen igual: la etapa.
    expect(before.labels.find((label) => label.id === pago.labelId)!.uses.map((use) => use.kind)).toEqual(["stage", "webhook"]);
    expect(before.duplicates).toEqual([{ name: "Pagó", keepId: pago.labelId, otherIds: [repeated] }]);
    await expect(services.remove(actor, repeated, null)).rejects.toThrow("elige a qué etiqueta pasar");

    const { merge } = await services.merge(actor, { from: repeated, into: pago.labelId });
    expect(merge).toMatchObject({ total: 3, status: "running" });

    const after = await services.overview(actor);
    expect(after.labels.map((label) => label.id)).not.toContain(repeated);
    expect(after.merges[0]).toMatchObject({ id: merge.id, status: "done", moved: 3, total: 3 });
    // Laura estaba en «Interesado»: entra a «Pagó» y deja la anterior (una etapa por embudo), con su negocio al día.
    expect((await contacts.findById(tenant, laura))!.labels.map((label) => label.name)).toEqual(["Pagó"]);
    expect((await crm.deals.contact({ tenantId: tenant, userId: ACTOR, canWrite: true, canManage: true }, laura)).deals).toEqual([expect.objectContaining({ stageId: pago.id })]);
    expect(after.labels.find((label) => label.id === pago.labelId)!.contactCount).toBe(3);
    const audience = (await sql.query<{ audience: { labelIds: string[] } }>("select audience from broadcasts where tenant_id = $1", [tenant])).rows[0]!.audience;
    expect(audience.labelIds).toEqual([pago.labelId]);
    const mapping = (await sql.query<{ mapping: { addTags: string[] } }>("select mapping from inbound_webhooks where tenant_id = $1", [tenant])).rows[0]!.mapping;
    expect(mapping.addTags).toEqual(["Pagó", "VIP"]);
    expect(errors).toEqual([]);
  });

  it("una etapa no se une en otra, y otra cuenta no ve ni toca estas etiquetas", async () => {
    const a = (await insert("insert into tenants (key, name) values ($1, 'a') returning id", [TEST_KEY_PREFIX + "labels-a"])).id;
    const b = (await insert("insert into tenants (key, name) values ($1, 'b') returning id", [TEST_KEY_PREFIX + "labels-b"])).id;
    const { crm, services } = build();
    const pipeline = await crm.pipelines.createStarter({ tenantId: a, userId: ACTOR, canWrite: true, canManage: true });
    const [first, second] = pipeline.stages;
    const actor = (tenantId: string) => ({ tenantId, actorId: ACTOR, canManage: true, canEdit: true, canSeeSales: false });
    await expect(services.merge(actor(a), { from: first!.labelId, into: second!.labelId })).rejects.toThrow("es una etapa del embudo");
    expect((await services.overview(actor(b))).labels).toEqual([]);
    await expect(services.merge(actor(b), { from: first!.labelId, into: second!.labelId })).rejects.toThrow("Esa etiqueta ya no existe.");
    await expect(services.update(actor(b), first!.labelId, { name: "robada" })).rejects.toThrow("Esa etiqueta ya no existe.");
  });
});
