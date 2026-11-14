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
const ID = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LOG = (actorId: string) => ({ actorId, changes: [] });

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
    expect(await repository.create(a, ID(1), pago, LOG("dev-user"))).toMatchObject({ key: "g_pago_movil", value: "0424-6461556", description: "", schedules: [] });
    expect(await repository.create(a, ID(2), pago, LOG("dev-user"))).toBeNull();
    // Otra cuenta puede tener la misma clave, y no ve ni toca la de esta.
    expect(await repository.create(b, ID(3), pago, LOG("user"))).not.toBeNull();
    expect(await repository.find(b, ID(1))).toBeNull();
    expect(await repository.update(b, ID(1), { ...pago, value: "robado" }, LOG("user"))).toBeNull();
    expect(await repository.remove(b, ID(1), LOG("user"))).toBe(false);

    const changed = await repository.update(a, ID(1), { ...pago, value: "0414-0000000", description: "Venezuela" }, LOG("dev-user"));
    expect(changed).toMatchObject({ value: "0414-0000000", description: "Venezuela" });
    await expect(sql.query("insert into business_data (id, tenant_id, key, label, type, value) values ($1, $2, 'horario', 'Horario', 'text', 'x')", [ID(4), a])).rejects.toThrow();

    const values = new SqlBusinessValues(repository);
    await repository.create(a, ID(5), requireNewDatum({ label: "Promo activa", type: "boolean", value: "Sí" }), LOG("dev-user"));
    expect(await values.values(a)).toEqual({ g_pago_movil: "0414-0000000", g_promo_activa: true });
    expect(await repository.remove(a, ID(1), LOG("dev-user"))).toBe(true);
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
    expect(await texts.broadcasts(a)).toEqual([{ id: ID(6), name: "Black Friday", sendAt: null, texts: ["Paga al {g_pago_movil}"] }]);
    expect(await texts.quickReplies(a)).toEqual([{ id: ID(8), shortcut: "pago", texts: ["Hola {nombre}", "{g_pago_movil}"] }]);
  });

  it("cambios programados e historial: el dato bloqueado no deja cruces, el valor rige a su hora, y quién lo hizo con su nombre", async () => {
    const a = await tenant("bd-tiempo");
    const repository = new SqlBusinessDataRepository(sql);
    const user = "bbbbbbbb-0000-4000-8000-000000000001";
    await sql.query(`insert into user_profiles (user_id, display_name) values ($1, 'Camilo') on conflict (user_id) do update set display_name = 'Camilo'`, [user]);
    try {
      const horario = requireNewDatum({ label: "Horario", type: "text", value: "8 a 6" });
      await repository.create(a, ID(10), horario, { actorId: user, changes: [{ kind: "created", value: "8 a 6" }] });
      const hour = 3_600_000;
      const navidad = { value: "Cerrado", startsAt: new Date(Date.now() + hour), endsAt: new Date(Date.now() + 3 * hour), note: "Navidad" };
      const snapshot = { value: "Cerrado", startsAt: navidad.startsAt.toISOString(), endsAt: navidad.endsAt.toISOString(), note: "Navidad" };
      expect(await repository.saveSchedule(a, ID(10), ID(11), navidad, { actorId: user, changes: [{ kind: "scheduled", schedule: snapshot }] })).toBe("saved");
      // Otro que se cruza, aunque llegue sin pasar por las reglas (dos personas a la vez), no entra.
      expect(await repository.saveSchedule(a, ID(10), ID(12), { ...navidad, startsAt: new Date(Date.now() + 2 * hour), endsAt: new Date(Date.now() + 4 * hour) }, LOG(user))).toBe("overlap");
      // Otra cuenta no programa en este dato.
      const b = await tenant("bd-tiempo-b");
      expect(await repository.saveSchedule(b, ID(10), ID(13), navidad, LOG(user))).toBe("missing");

      const listed = await repository.find(a, ID(10));
      expect(listed?.schedules).toEqual([{ id: ID(11), value: "Cerrado", startsAt: snapshot.startsAt, endsAt: snapshot.endsAt, note: "Navidad", createdBy: "Camilo", createdAt: expect.any(String) }]);
      const values = new SqlBusinessValues(repository, 15_000, () => navidad.startsAt.getTime() + 1);
      expect(await values.values(a)).toEqual({ g_horario: "Cerrado" });

      // Quitar uno que no ha empezado lo borra; el historial lo recuerda, del más nuevo al más viejo.
      expect(await repository.closeSchedule(a, ID(10), ID(11), "unscheduled", new Date(), { actorId: "dev-user", changes: [{ kind: "unscheduled", schedule: snapshot }] })).toBe(true);
      expect((await repository.find(a, ID(10)))?.schedules).toEqual([]);
      const history = await repository.history(a, "g_horario", 50);
      expect(history.map((change) => [change.kind, change.actorName])).toEqual([
        ["unscheduled", null],
        ["scheduled", "Camilo"],
        ["created", "Camilo"]
      ]);
      expect(history[1]).toMatchObject({ schedule: snapshot, valueType: "text" });
      // Al borrar el dato, su historial queda (por clave) con la línea del borrado.
      await repository.remove(a, ID(10), { actorId: user, changes: [{ kind: "deleted", value: "8 a 6" }] });
      expect((await repository.history(a, "g_horario", 50))[0]).toMatchObject({ kind: "deleted", value: "8 a 6" });
      expect(await repository.history(b, "g_horario", 50)).toEqual([]);
    } finally {
      await sql.query(`delete from user_profiles where user_id = $1`, [user]);
    }
  });

  it("el historial guarda los últimos 50 de cada dato", async () => {
    const a = await tenant("bd-50");
    const repository = new SqlBusinessDataRepository(sql);
    const datum = requireNewDatum({ label: "Cupos", type: "number", value: "1" });
    await repository.create(a, ID(20), datum, LOG("dev-user"));
    const changes = Array.from({ length: 55 }, (_, i) => ({ kind: "value" as const, before: String(i), after: String(i + 1) }));
    await repository.update(a, ID(20), { ...datum, value: "55" }, { actorId: "dev-user", changes });
    const history = await repository.history(a, "g_cupos", 100);
    expect(history).toHaveLength(50);
    expect(history[0]).toMatchObject({ before: "54", after: "55", valueType: "number" });
  });
});
