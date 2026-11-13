import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ContactFieldServices } from "../../domains/contact-fields/application/ContactFieldServices.js";
import { ContactFieldSync } from "../../domains/contact-fields/application/ContactFieldSync.js";
import { SqlContactFieldRepository, SqlContactFieldValues } from "../../infrastructure/persistence/sql/SqlContactFields.js";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Campos del cliente en PostgreSQL: el catálogo por cuenta (sin claves
// repetidas, la base rechaza lo que el dominio no dejaría pasar), lo que ya
// se guarda en los clientes para el primer día, lo que un flujo guarda pasa
// al cliente sin pisar lo demás, y borrar se lleva el dato de todos.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function seed() {
  const q = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!.id;
  const tenant = await q("insert into tenants (key, name) values ($1, 'campos') returning id", [TEST_KEY_PREFIX + "campos"]);
  const other = await q("insert into tenants (key, name) values ($1, 'otra') returning id", [TEST_KEY_PREFIX + "campos-otra"]);
  const contact = async (owner: string, phone: string, fields: Record<string, unknown>) =>
    q("insert into contacts (tenant_id, channel, external_key, name, phone, custom_fields) values ($1, 'whatsapp', $2, $2, $2, $3::jsonb) returning id", [owner, phone, JSON.stringify(fields)]);
  const laura = await contact(tenant, "573001110001", { ciudad: "Medellín", presupuesto: "50000", nota: "" });
  await contact(tenant, "573001110002", { ciudad: "Medellín" });
  await contact(tenant, "573001110003", { ciudad: "Bogotá", resposta: "Sí" });
  await contact(other, "573001110004", { secreto: "de otra cuenta" });
  return { tenant, other, laura };
}

const customFields = async (id: string) => (await sql.query<{ custom_fields: Record<string, unknown> }>("select custom_fields from contacts where id = $1", [id])).rows[0]!.custom_fields;

function module() {
  const repository = new SqlContactFieldRepository(sql);
  const values = new SqlContactFieldValues(sql);
  return { repository, values, fields: new ContactFieldServices(repository, values, { drafts: async () => [] }), sync: new ContactFieldSync(repository, values) };
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlContactFields", () => {
  it("el primer día ve lo que ya tienen los clientes de la cuenta, con sus valores", async () => {
    const { tenant, other } = await seed();
    const { values, fields } = module();
    const seen = await values.observed(tenant);
    expect([...seen.keys()].sort()).toEqual(["ciudad", "presupuesto", "resposta"]);
    expect(seen.get("ciudad")).toEqual({ filled: 3, distinct: 2, top: [{ value: "Medellín", count: 2 }, { value: "Bogotá", count: 1 }] });
    expect(await values.totalContacts(tenant)).toBe(3);
    expect((await fields.discover(other)).suggestions.map((entry) => entry.key)).toEqual(["secreto"]);
  });

  it("crea, cuenta los llenos y edita; la clave no se repite y cada cuenta ve lo suyo", async () => {
    const { tenant, other } = await seed();
    const { fields } = module();
    const [ciudad] = await fields.adopt(tenant, { fields: [{ key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"] }] });
    await fields.create(tenant, { label: "Nota", type: "text" });
    await expect(fields.create(tenant, { label: "Ciudad", type: "text" })).rejects.toThrow("Ya hay un campo");

    const list = await fields.list(tenant, true);
    expect(list.fields.map((field) => [field.key, field.filled])).toEqual([["ciudad", 3], ["nota", 0]]);
    expect(list.fields[0]).toMatchObject({ type: "list", options: ["Medellín", "Bogotá"] });
    expect(list.undefinedKeys).toBe(2);
    expect(await fields.update(tenant, ciudad!.id, { label: "Ciudad de envío", options: ["Medellín", "Bogotá", "Cali"] })).toMatchObject({ key: "ciudad", label: "Ciudad de envío", options: ["Medellín", "Bogotá", "Cali"] });

    expect((await fields.list(other, true)).fields).toEqual([]);
    await expect(fields.update(other, ciudad!.id, { label: "X" })).rejects.toThrow("ya no existe");
  });

  it("lo que guarda un flujo pasa al cliente convertido, sin tocar sus otros datos", async () => {
    const { tenant, laura } = await seed();
    const { fields, sync } = module();
    await fields.adopt(tenant, { fields: [{ key: "presupuesto", label: "Presupuesto", type: "number" }, { key: "cumpleanos", label: "Cumpleaños", type: "date" }] });
    const saved = await sync.persist(tenant, async () => laura, { presupuesto: "1.200.000", cumpleanos: "13/11/1990", sin_campo: "x" });
    expect(saved).toEqual({ presupuesto: 1_200_000, cumpleanos: "1990-11-13" });
    expect(await customFields(laura)).toEqual({ ciudad: "Medellín", presupuesto: 1_200_000, cumpleanos: "1990-11-13", nota: "" });
  });

  it("borrar quita el campo y su dato de todos los clientes de la cuenta, nada más", async () => {
    const { tenant, other, laura } = await seed();
    const { fields } = module();
    const [ciudad] = await fields.adopt(tenant, { fields: [{ key: "ciudad", label: "Ciudad", type: "text" }] });
    await fields.adopt(other, { fields: [{ key: "ciudad", label: "Ciudad", type: "text" }] });
    await fields.remove(tenant, ciudad!.id, "ciudad");
    expect(await customFields(laura)).toEqual({ presupuesto: "50000", nota: "" });
    expect((await fields.list(tenant, true)).fields).toEqual([]);
    expect((await fields.list(other, true)).fields.map((field) => field.key)).toEqual(["ciudad"]);
  });

  it("la base rechaza una clave o un tipo inválidos aunque algo se salte el dominio", async () => {
    const { tenant } = await seed();
    const insert = (key: string, type: string) =>
      sql.query("insert into contact_field_definitions (id, tenant_id, key, label, type) values (gen_random_uuid(), $1, $2, 'X', $3)", [tenant, key, type]);
    await expect(insert("con espacio", "text")).rejects.toThrow();
    await expect(insert("ok", "color")).rejects.toThrow();
  });
});
