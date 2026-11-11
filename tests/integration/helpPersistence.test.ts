import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlHelpTutorials } from "../../infrastructure/persistence/sql/SqlHelpTutorials.js";
import { SqlOnboardingProbe } from "../../infrastructure/persistence/sql/SqlOnboardingProbe.js";
import { SqlSupport } from "../../infrastructure/persistence/sql/SqlSupport.js";
import { requireTutorial } from "../../domains/help/domain/HelpRules.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// Ayuda en PostgreSQL (rama `test`): tutoriales (un solo destacado, vistas,
// orden), casos de soporte (cada cuenta los suyos; el equipo, todos), los
// datos de soporte y «Empieza aquí» leído de los datos de la cuenta.

let sql: SqlClient;
const IDS = ["99999999-0000-4000-8000-000000000001", "99999999-0000-4000-8000-000000000002"];
const USER = "99999999-0000-4000-8000-0000000000aa";

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(async () => {
  await cleanupTestData(sql);
  await sql.query("delete from help_tutorials where id = any($1::uuid[])", [IDS]);
});
afterAll(async () => {
  await sql.query("delete from help_tutorials where id = any($1::uuid[])", [IDS]);
  await cleanupTestData(sql);
  await sql.close();
});

describe("Ayuda en PostgreSQL", () => {
  it("tutoriales, soporte y «Empieza aquí»", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, 'ayuda') returning id", [TEST_KEY_PREFIX + "help"])).rows[0]!.id;
    const tutorials = new SqlHelpTutorials(sql);
    const input = (title: string, featured: boolean, published: boolean) => requireTutorial({ url: "https://youtu.be/dQw4w9WgXcQ", title, module: "conexiones", featured, published });
    await tutorials.save(IDS[0]!, input("Uno", true, true), 1);
    await tutorials.save(IDS[1]!, input("Dos", true, false), 2);
    const all = (await tutorials.list(true)).filter((t) => IDS.includes(t.id));
    expect(all.map((t) => [t.title, t.featured])).toEqual([["Uno", false], ["Dos", true]]);
    expect((await tutorials.list(false)).some((t) => t.id === IDS[1])).toBe(false);
    await tutorials.markSeen(tenant, USER, IDS[0]!);
    await tutorials.markSeen(tenant, USER, IDS[0]!);
    expect((await tutorials.seenBy(USER)).has(IDS[0]!)).toBe(true);
    expect((await tutorials.list(true)).find((t) => t.id === IDS[0])?.views).toBe(1);
    await tutorials.reorder([IDS[1]!, IDS[0]!]);
    expect((await tutorials.list(true)).filter((t) => IDS.includes(t.id)).map((t) => t.title)).toEqual(["Dos", "Uno"]);

    const support = new SqlSupport(sql);
    await support.createCase(tenant, USER, "99999999-0000-4000-8000-0000000000c1", { topic: "Flujos", message: "No responde", page: "/automations", screenshotUrl: null, articleSlug: null });
    expect((await support.casesOf(tenant, USER))[0]).toMatchObject({ topic: "Flujos", status: "open" });
    expect((await support.allCases("open", 50)).find((c) => c.id.endsWith("c1"))?.account?.tenantName).toBe("ayuda");
    expect(await support.reply("99999999-0000-4000-8000-0000000000c1", "Ya quedó", "answered", new Date())).toBe(true);
    expect((await support.casesOf(tenant, USER))[0]).toMatchObject({ reply: "Ya quedó", status: "answered" });
    await support.rate(tenant, USER, "conectar-whatsapp-qr", true, null);

    const steps = await new SqlOnboardingProbe(sql).steps(tenant);
    expect(steps.map((s) => [s.id, s.done])).toEqual([["number", false], ["flow", false], ["products", false], ["team", false], ["meta", false], ["broadcast", false]]);
  });
});
