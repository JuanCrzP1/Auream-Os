import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlBusinessDataRepository, SqlBusinessValues } from "../../infrastructure/persistence/sql/SqlBusinessData.js";
import { SqlBusinessDataTexts } from "../../infrastructure/persistence/sql/SqlBusinessDataTexts.js";
import { requireNewDatum } from "../../domains/business-data/domain/BusinessDatum.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Datos del negocio en PostgreSQL (rama `test`): la tabla con sus reglas (la
// clave es única por cuenta y empieza por g_), los valores con su tipo para el
// motor y los textos de difusiones por enviar y respuestas rápidas.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const ID = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;

async function tenant(name: string): Promise<string> {
  return (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + name, name])).rows[0]!.id;
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("Datos del negocio en PostgreSQL", () => {
  it("crea, cambia y borra por cuenta; la clave no se repite y la base rechaza una que no empieza por g_", async () => {
    const a = await tenant("bd-a");
    const b = await tenant("bd-b");
    const repository = new SqlBusinessDataRepository(sql);
    const pago = requireNewDatum({ label: "Pago Móvil", type: "text", value: "0424-6461556" });
    expect(await repository.create(a, ID(1), pago, "dev-user")).toMatchObject({ key: "g_pago_movil", value: "0424-6461556", description: "" });
    expect(await repository.create(a, ID(2), pago, "dev-user")).toBeNull();
    // Otra cuenta puede tener la misma clave, y no ve ni toca la de esta.
    expect(await repository.create(b, ID(3), pago, "user")).not.toBeNull();
    expect(await repository.find(b, ID(1))).toBeNull();
    expect(await repository.update(b, ID(1), { ...pago, value: "robado" }, "user")).toBeNull();
    expect(await repository.remove(b, ID(1))).toBe(false);

    const changed = await repository.update(a, ID(1), { ...pago, value: "0414-0000000", description: "Venezuela" }, "dev-user");
    expect(changed).toMatchObject({ value: "0414-0000000", description: "Venezuela" });
    await expect(sql.query("insert into business_data (id, tenant_id, key, label, type, value) values ($1, $2, 'horario', 'Horario', 'text', 'x')", [ID(4), a])).rejects.toThrow();

    const values = new SqlBusinessValues(repository);
    await repository.create(a, ID(5), requireNewDatum({ label: "Promo activa", type: "boolean", value: "Sí" }), "dev-user");
    expect(await values.values(a)).toEqual({ g_pago_movil: "0414-0000000", g_promo_activa: true });
    expect(await repository.remove(a, ID(1))).toBe(true);
    values.forget(a);
    expect(await values.values(a)).toEqual({ g_promo_activa: true });
  });

  it("los textos de las difusiones que aún se van a enviar y de las respuestas rápidas", async () => {
    const a = await tenant("bd-textos");
    const broadcast = (id: string, name: string, status: string, text: string) =>
      sql.query(
        `insert into broadcasts (id, tenant_id, name, status, variants, audience, connection_ids, settings) values ($1, $2, $3, $4, $5::jsonb, '{}'::jsonb, array[gen_random_uuid()], '{}'::jsonb)`,
        [id, a, name, status, JSON.stringify([{ kind: "message", text, media: null }])]
      );
    await broadcast(ID(6), "Black Friday", "scheduled", "Paga al {g_pago_movil}");
    await broadcast(ID(7), "Ya enviada", "done", "Paga al {g_pago_movil}");
    await sql.query(`insert into quick_replies (id, tenant_id, shortcut, pieces) values ($1, $2, 'pago', $3::jsonb)`, [
      ID(8),
      a,
      JSON.stringify([{ kind: "text", text: "Hola {nombre}" }, { kind: "media", media: { type: "image", url: "https://x/qr.png" }, caption: "{g_pago_movil}" }])
    ]);
    const texts = new SqlBusinessDataTexts(sql);
    expect(await texts.broadcasts(a)).toEqual([{ id: ID(6), name: "Black Friday", texts: ["Paga al {g_pago_movil}"] }]);
    expect(await texts.quickReplies(a)).toEqual([{ id: ID(8), shortcut: "pago", texts: ["Hola {nombre}", "{g_pago_movil}"] }]);
  });
});
