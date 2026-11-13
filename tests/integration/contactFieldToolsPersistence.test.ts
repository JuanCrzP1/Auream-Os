import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_AUDIENCE } from "../../contracts/BroadcastContracts.js";
import { ContactFieldMergeServices } from "../../domains/contact-fields/application/ContactFieldMergeServices.js";
import { ContactFieldServices } from "../../domains/contact-fields/application/ContactFieldServices.js";
import { ContactFieldTidyServices } from "../../domains/contact-fields/application/ContactFieldTidyServices.js";
import { SqlBroadcastAudience } from "../../infrastructure/persistence/sql/SqlBroadcastAudience.js";
import { SqlContactFieldInsights } from "../../infrastructure/persistence/sql/SqlContactFieldInsights.js";
import { SqlContactFieldOperations } from "../../infrastructure/persistence/sql/SqlContactFieldOperations.js";
import { SqlContactFieldRepository, SqlContactFieldValues } from "../../infrastructure/persistence/sql/SqlContactFields.js";
import { SqlContactRepository } from "../../infrastructure/persistence/sql/SqlContactRepositories.js";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Herramientas del catálogo en PostgreSQL: ordenar valores y deshacer (sin
// pisar lo que cambió después), unir campos (gana el dato más reciente), lo
// que vende cada valor y los filtros por campo en el CRM y en Difusiones.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const q = async (text: string, params: unknown[] = []) => (await sql.query<{ id: string }>(text, params)).rows[0]!;
const fieldsOf = async (id: string) => (await sql.query<{ custom_fields: Record<string, unknown> }>("select custom_fields from contacts where id = $1", [id])).rows[0]!.custom_fields;

async function seed() {
  const tenant = (await q("insert into tenants (key, name) values ($1, 'herramientas') returning id", [TEST_KEY_PREFIX + "cft"])).id;
  const other = (await q("insert into tenants (key, name) values ($1, 'otra') returning id", [TEST_KEY_PREFIX + "cft-otra"])).id;
  await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values ($1, $2, 'Ventas', 'qr', 'connected') returning id", [CONNECTION, tenant]);
  const people: Record<string, string> = {};
  const add = async (owner: string, name: string, phone: string, fields: Record<string, unknown>) => {
    const id = (await q("insert into contacts (tenant_id, channel, external_key, name, phone, custom_fields) values ($1, 'whatsapp', $2, $3, $2, $4::jsonb) returning id", [owner, phone, name, JSON.stringify(fields)])).id;
    if (owner === tenant) {
      const chat = (await q("insert into conversations (id, tenant_id, connection_id, contact_id, phone) values (gen_random_uuid(), $1, $2, $3, $4) returning id", [owner, CONNECTION, id, phone])).id;
      await q("insert into conversation_messages (id, tenant_id, conversation_id, direction, author, kind, status) values (gen_random_uuid(), $1, $2, 'inbound', 'contact', 'text', 'received') returning id", [owner, chat]);
    }
    people[name] = id;
  };
  await add(tenant, "Laura", "573001110001", { ciudad: "Medellín", ya_compro: true, presupuesto: 1200000, respuesta: "Sí", resposta: "viejo" });
  await add(tenant, "Andrés", "573001110002", { ciudad: "medellin", ya_compro: false, presupuesto: 300000, resposta: "Quiero el video" });
  await add(tenant, "Marta", "573001110003", { ciudad: "MDE", presupuesto: "mucho" });
  await add(tenant, "Pedro", "573001110004", { ciudad: "Bogotá", respuesta_menu: "Canción" });
  await add(tenant, "Sin dato", "573001110005", {});
  await add(other, "Ajeno", "573001110009", { ciudad: "medellin" });
  return { tenant, other, people };
}

function module() {
  const repository = new SqlContactFieldRepository(sql);
  const values = new SqlContactFieldValues(sql);
  const operations = new SqlContactFieldOperations(sql);
  const insights = new SqlContactFieldInsights(sql);
  const flows = { drafts: async () => [] };
  const rewriter = { rename: async () => ({ changes: [], skipped: [] }), restore: async () => ({ skipped: 0 }) };
  return {
    fields: new ContactFieldServices(repository, values, flows, randomUUID, operations),
    tidy: new ContactFieldTidyServices(repository, insights, operations, randomUUID),
    merge: new ContactFieldMergeServices(repository, values, insights, operations, flows, rewriter, randomUUID)
  };
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("herramientas del catálogo", () => {
  it("ordenar valores: propone, aplica solo lo confirmado, lo sugiere deshacer, y deshacer no pisa lo que cambió después", async () => {
    const { tenant, other, people } = await seed();
    const { fields, tidy, merge } = module();
    const [ciudad] = await fields.adopt(tenant, { fields: [{ key: "ciudad", label: "Ciudad", type: "text" }] });

    // Una operación de hace dos meses (ya no se puede deshacer): se limpia sola con la siguiente.
    await sql.query("insert into contact_field_operations (id, tenant_id, kind, title, keys, created_at) values (gen_random_uuid(), $1, 'tidy', 'vieja', '{ciudad}', now() - interval '60 days')", [tenant]);
    const seen = await tidy.values(tenant, ciudad!.id);
    expect(seen).toMatchObject({ filled: 4, distinct: 4, truncated: false });
    const done = await tidy.tidy(tenant, ciudad!.id, { assignments: [{ values: ["Medellín", "medellin", "MDE"], to: "Medellín" }, { values: ["Bogotá"], to: "Bogotá" }] }, "u-ana");
    expect(done.operation).toMatchObject({ kind: "tidy", title: "Ordenaste «Ciudad»", contacts: 2 });
    expect([await fieldsOf(people["Andrés"]!), await fieldsOf(people["Marta"]!)].map((entry) => entry["ciudad"])).toEqual(["Medellín", "Medellín"]);
    expect((await fieldsOf(people["Ajeno"]!))["ciudad"]).toBe("medellin");
    const list = await fields.list(tenant, true);
    expect(list.fields[0]).toMatchObject({ type: "list", options: ["Medellín", "Bogotá"] });
    expect(list.suggestions?.operations).toEqual([expect.objectContaining({ id: done.operation.id, contacts: 2 })]);
    expect((await fields.list(other, true)).suggestions?.operations).toEqual([]);
    expect((await sql.query("select title from contact_field_operations where tenant_id = $1", [tenant])).rows).toEqual([{ title: "Ordenaste «Ciudad»" }]);

    // Marta cambia de ciudad después: al deshacer, su dato nuevo se respeta.
    await sql.query("update contacts set custom_fields = custom_fields || '{\"ciudad\": \"Bogotá\"}' where id = $1", [people["Marta"]]);
    await expect(merge.undo(other, done.operation.id)).rejects.toThrow("no existe");
    expect(await merge.undo(tenant, done.operation.id)).toEqual({ contacts: 1, blocksSkipped: 0 });
    expect([await fieldsOf(people["Andrés"]!), await fieldsOf(people["Marta"]!)].map((entry) => entry["ciudad"])).toEqual(["medellin", "Bogotá"]);
    expect((await fields.list(tenant, true)).fields[0]).toMatchObject({ type: "text", options: [] });
    await expect(merge.undo(tenant, done.operation.id)).rejects.toThrow("ya se deshizo");
  });

  it("unir campos: gana el dato más reciente, se borran las definiciones que sobran y deshacer devuelve todo", async () => {
    const { tenant, people } = await seed();
    const { fields, merge } = module();
    await fields.adopt(tenant, { fields: [{ key: "resposta", label: "Resposta", type: "text" }] });
    // El «viejo» de Laura en `resposta` se guardó DESPUÉS que su `respuesta`: gana por reciente.
    await sql.query("insert into contact_field_origins (tenant_id, contact_id, key, source, flow_key, updated_at) values ($1, $2, 'respuesta', 'flow', 'f', now() - interval '2 days'), ($1, $2, 'resposta', 'flow', 'f', now())", [tenant, people["Laura"]]);

    expect(await merge.preview(tenant, { keep: "respuesta", merge: ["resposta", "respuesta_menu"] })).toMatchObject({ conflicts: 1, keys: [{ key: "respuesta", label: null, filled: 1 }, { key: "resposta", label: "Resposta", filled: 2 }, { key: "respuesta_menu", filled: 1 }] });
    const done = await merge.merge(tenant, { keep: "respuesta", merge: ["resposta", "respuesta_menu"] }, "u-ana");
    expect(done).toMatchObject({ operation: { kind: "merge", title: "Uniste 3 campos en «Respuesta»", contacts: 3 }, flowsSkipped: [] });
    expect(await fieldsOf(people["Laura"]!)).toMatchObject({ respuesta: "viejo", ciudad: "Medellín" });
    expect(await fieldsOf(people["Laura"]!)).not.toHaveProperty("resposta");
    expect((await fieldsOf(people["Andrés"]!))["respuesta"]).toBe("Quiero el video");
    expect((await fieldsOf(people["Pedro"]!))["respuesta"]).toBe("Canción");
    expect((await fields.list(tenant, true)).fields.map((field) => [field.key, field.label, field.filled])).toEqual([["respuesta", "Respuesta", 3]]);

    await merge.undo(tenant, done.operation.id);
    expect(await fieldsOf(people["Laura"]!)).toMatchObject({ respuesta: "Sí", resposta: "viejo" });
    expect(await fieldsOf(people["Pedro"]!)).toMatchObject({ respuesta_menu: "Canción" });
    expect((await fields.list(tenant, true)).fields.map((field) => field.key)).toEqual(["resposta"]);
    await expect(merge.merge(tenant, { keep: "respuesta", merge: ["phone"] }, "u")).rejects.toThrow("lo llena Auream");
  });

  it("lo que vende cada valor: ventas aprobadas, por moneda, con «sin dato» aparte", async () => {
    const { tenant, people } = await seed();
    const { fields, tidy } = module();
    const [ciudad] = await fields.adopt(tenant, { fields: [{ key: "ciudad", label: "Ciudad", type: "text" }] });
    const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
    const sale = (who: string, amount: number, currency: string, status = "approved", daysAgo = 1) =>
      q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, contact_id, sold_at) values ($1, $2, 'manual', $3, 'Video', $4, $5, $6, now() - make_interval(days => $7)) returning id", [tenant, status, product, amount, currency, people[who], daysAgo]);
    await sale("Laura", 100000, "COP");
    await sale("Laura", 50000, "COP");
    await sale("Pedro", 80000, "COP");
    await sale("Sin dato", 20000, "COP");
    await sale("Pedro", 10, "USD");
    // Anotada a mano solo con el teléfono de Andrés (sin contacto): cuenta para su ciudad.
    await q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, customer_phone, sold_at) values ($1, 'approved', 'manual', $2, 'Video', 30000, 'COP', '573001110002', now()) returning id", [tenant, product]);
    await sale("Laura", 999999, "COP", "review");
    await sale("Laura", 999999, "COP", "approved", 60);

    expect(await tidy.sales(tenant, ciudad!.id, 30)).toEqual({
      days: 30,
      currencies: [
        { currency: "COP", total: 280000, values: [{ value: "Medellín", amount: 150000, sales: 2, clients: 1 }, { value: "Bogotá", amount: 80000, sales: 1, clients: 1 }, { value: "medellin", amount: 30000, sales: 1, clients: 1 }, { value: null, amount: 20000, sales: 1, clients: 1 }] },
        { currency: "USD", total: 10, values: [{ value: "Bogotá", amount: 10, sales: 1, clients: 1 }] }
      ]
    });
  });

  it("filtrar por campos: la misma regla en la lista del CRM y en la audiencia de una difusión", async () => {
    const { tenant } = await seed();
    const contacts = new SqlContactRepository(sql);
    const names = async (fields: unknown[]) => (await contacts.list(tenant, { fields: fields as never, page: 1, limit: 25 })).items.map((item) => item.contact.name).sort();
    expect(await names([{ key: "ciudad", op: "in", values: ["medellín", "mde"] }])).toEqual(["Laura", "Marta"]);
    expect(await names([{ key: "ya_compro", op: "yes" }])).toEqual(["Laura"]);
    expect(await names([{ key: "ya_compro", op: "no" }])).toEqual(["Andrés"]);
    expect(await names([{ key: "presupuesto", op: "between", min: "500.000" }])).toEqual(["Laura"]);
    expect(await names([{ key: "presupuesto", op: "between", max: "500.000" }])).toEqual(["Andrés"]);
    expect(await names([{ key: "ciudad", op: "empty" }])).toEqual(["Sin dato"]);
    expect(await names([{ key: "ciudad", op: "filled" }, { key: "ya_compro", op: "no" }])).toEqual(["Andrés"]);

    const audience = new SqlBroadcastAudience(sql);
    const reach = async (fields: unknown[]) => (await audience.resolve(tenant, { ...EMPTY_AUDIENCE, fields: fields as never }, [CONNECTION], 100)).candidates.map((candidate) => candidate.name).sort();
    expect(await reach([])).toHaveLength(5);
    expect(await reach([{ key: "ciudad", op: "in", values: ["Medellín"] }, { key: "ya_compro", op: "yes" }])).toEqual(["Laura"]);
    expect(await reach([{ key: "presupuesto", op: "between", min: "100000", max: "2000000" }])).toEqual(["Andrés", "Laura"]);
  });
});
