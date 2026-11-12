import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlContactRepository, SqlLabelRepository } from "../../infrastructure/persistence/sql/SqlContactRepositories.js";
import { ContactDirectoryService } from "../../domains/contacts/application/ContactDirectoryService.js";
import { CreateContactService, ListContactsService, SetContactLabelsService } from "../../domains/contacts/application/ContactServices.js";
import { CreateLabelService, DeleteLabelService, ListLabelsService } from "../../domains/contacts/application/LabelCatalogServices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Contactos y etiquetas en PostgreSQL, contra la rama `test` de Neon.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

function stack() {
  const contacts = new SqlContactRepository(sql);
  const labels = new SqlLabelRepository(sql);
  return {
    contacts,
    labels,
    createLabel: new CreateLabelService(labels),
    listLabels: new ListLabelsService(labels),
    deleteLabel: new DeleteLabelService(labels),
    createContact: new CreateContactService(contacts),
    listContacts: new ListContactsService(contacts),
    setLabels: new SetContactLabelsService(contacts, labels),
    directory: new ContactDirectoryService(contacts, labels)
  };
}

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

describe("catálogo y asignación", () => {
  it("nombre único sin distinguir mayúsculas (409) y conteo de contactos", async () => {
    const tenant = await insertTenant("labels");
    const s = stack();
    const vip = await s.createLabel.execute(tenant, { name: "VIP", color: "#ef4444" });
    await expect(s.createLabel.execute(tenant, { name: "vip" })).rejects.toMatchObject({ statusCode: 409 });

    const ana = await s.createContact.execute(tenant, { name: "Ana", phone: "573001111111" });
    await s.setLabels.execute(tenant, ana.contact.id, [vip.id]);

    expect((await s.listLabels.execute(tenant)).map((l) => [l.name, l.contactCount])).toEqual([["VIP", 1]]);
    expect((await s.contacts.findById(tenant, ana.contact.id))?.labels.map((l) => l.name)).toEqual(["VIP"]);
  });

  it("la BASE impide asignar una etiqueta de otra cuenta (FK compuesta)", async () => {
    const a = await insertTenant("cuenta-a");
    const b = await insertTenant("cuenta-b");
    const s = stack();
    const foreign = await s.createLabel.execute(b, { name: "De B" });
    const contact = await s.createContact.execute(a, { phone: "573002222222" });

    // Saltándose el caso de uso, directo al repositorio: la base lo rechaza.
    await expect(s.contacts.setLabels(a, contact.contact.id, [foreign.id])).rejects.toThrow();
    expect((await s.contacts.findById(a, contact.contact.id))?.labels).toEqual([]);
  });

  it("borrar una etiqueta la quita de todos sus contactos (cascada)", async () => {
    const tenant = await insertTenant("cascada");
    const s = stack();
    const tmp = await s.createLabel.execute(tenant, { name: "Temporal" });
    const contact = await s.createContact.execute(tenant, { phone: "573003333333" });
    await s.setLabels.execute(tenant, contact.contact.id, [tmp.id]);

    await s.deleteLabel.execute(tenant, tmp.id);
    expect((await s.contacts.findById(tenant, contact.contact.id))?.labels).toEqual([]);
  });
});

describe("contactos", () => {
  it("búsqueda (sin dejar que % o _ del usuario actúen de comodín), filtro y paginación", async () => {
    const tenant = await insertTenant("busqueda");
    const s = stack();
    const vip = await s.createLabel.execute(tenant, { name: "VIP" });
    const ana = await s.createContact.execute(tenant, { name: "Ana Pérez", phone: "573001111111", email: "ana@x.com" });
    await s.createContact.execute(tenant, { name: "Beto", phone: "573002222222" });
    await s.createContact.execute(tenant, { name: "Carla", phone: "573003333333" });
    await s.setLabels.execute(tenant, ana.contact.id, [vip.id]);

    expect((await s.listContacts.execute(tenant, { search: "ana@" })).items.map((i) => i.contact.name)).toEqual(["Ana Pérez"]);
    expect((await s.listContacts.execute(tenant, { search: "%" })).items).toEqual([]);
    expect((await s.listContacts.execute(tenant, { labelId: vip.id })).items.map((i) => i.contact.name)).toEqual(["Ana Pérez"]);

    const page1 = await s.listContacts.execute(tenant, { limit: 2, page: 1 });
    const page2 = await s.listContacts.execute(tenant, { limit: 2, page: 2 });
    expect([page1.items.length, page1.hasMore, page2.items.length, page2.hasMore]).toEqual([2, true, 1, false]);
  });

  it("el mismo teléfono no crea dos contactos, aunque lleguen a la vez", async () => {
    const tenant = await insertTenant("duplicados");
    const s = stack();
    const results = await Promise.all(Array.from({ length: 5 }, () => s.directory.resolve(tenant, { channel: "whatsapp", externalKey: "+57 300 444 5555" })));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });

  it("el directorio del motor: etiquetas por nombre (creando las que falten) y campos", async () => {
    const tenant = await insertTenant("directorio");
    const s = stack();
    const contact = await s.directory.resolve(tenant, { channel: "whatsapp", externalKey: "573005555555" });

    await s.directory.addTags(tenant, contact.id, ["Lead", "Campaña Navidad"]);
    const updated = await s.directory.setFields(tenant, contact.id, { ciudad: "Medellín", presupuesto: 1500 });

    expect([...updated.tags].sort()).toEqual(["Campaña Navidad", "Lead"]);
    expect(updated.fields).toEqual({ ciudad: "Medellín", presupuesto: 1500 });
    expect((await s.directory.removeTags(tenant, contact.id, ["lead"])).tags).toEqual(["Campaña Navidad"]);
  });

  it("el anuncio de clic a WhatsApp queda en la ficha y el último reemplaza al anterior (`021_contact_ad_origin.sql`)", async () => {
    const tenant = await insertTenant("anuncio");
    const s = stack();
    const identity = { channel: "whatsapp", externalKey: "584121112233" };
    const ad = { sourceId: "120244", sourceUrl: "https://fb.me/abc", mediaUrl: null, thumbnailUrl: null, ctwaClid: "Afiq" };
    await s.directory.identify(tenant, identity, "Laura", ad);
    // Con la fecha en que llegó por ese anuncio (la pone Auream al guardarlo).
    expect((await s.directory.resolve(tenant, identity)).ad).toEqual({ ...ad, receivedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    await s.directory.identify(tenant, identity, "Laura", { ...ad, sourceId: "999" });
    expect((await s.directory.resolve(tenant, identity)).ad?.sourceId).toBe("999");
  });
});
