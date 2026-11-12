import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlTaskRepository } from "../../infrastructure/persistence/sql/SqlTaskRepository.js";
import type { NewTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// La cola de tareas en PostgreSQL (rama `test`): sin duplicados, dos rondas a
// la vez se reparten las tareas (nunca la misma), una reserva caducada se
// retoma, reintentos y fallos, cancelar un grupo y limpiar las viejas.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
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

describe("SqlTaskRepository", () => {
  it("encola sin duplicar, reparte entre rondas simultáneas y retoma reservas caducadas", async () => {
    const tenant = await insertTenant("tasks-a");
    const repo = new SqlTaskRepository(sql);
    const now = new Date();
    const task = (key: string, dueAt = now): NewTask => ({ tenantId: tenant, kind: "flow.timer", groupKey: "conversation:c1", dedupeKey: `${tenant}:${key}`, payload: { n: key }, dueAt });

    for (let i = 0; i < 6; i++) expect(await repo.enqueue(randomUUID(), task(`k${i}`))).toBe(true);
    expect(await repo.enqueue(randomUUID(), task("k0"))).toBe(false);
    await repo.enqueue(randomUUID(), task("futura", new Date(now.getTime() + 3_600_000)));

    // Dos rondas a la vez: entre las dos toman las 6 vencidas, ninguna repetida.
    const [a, b] = await Promise.all([repo.claimDue(now, 4, 60_000), repo.claimDue(now, 4, 60_000)]);
    const claimed = [...a, ...b].map((t) => t.dedupeKey);
    expect(claimed).toHaveLength(6);
    expect(new Set(claimed).size).toBe(6);
    expect([...a, ...b].every((t) => t.status === "running" && t.attempts === 1)).toBe(true);

    // Nadie más las toma mientras dura la reserva; caducada, otra ronda la retoma.
    expect(await repo.claimDue(now, 10, 60_000)).toEqual([]);
    const later = new Date(now.getTime() + 61_000);
    expect((await repo.claimDue(later, 10, 60_000)).map((t) => t.attempts)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(await repo.peekNext()).toEqual({ dueAt: new Date(now.getTime() + 3_600_000), tenantId: tenant });
    // Un eslabón de la cadena de rondas no cuenta como trabajo pendiente.
    await repo.enqueue(randomUUID(), { tenantId: tenant, kind: "scheduling.chain", groupKey: "scheduling.chain", dedupeKey: `${tenant}:eslabon`, payload: {}, dueAt: now });
    expect((await repo.peekNext())!.dueAt.getTime()).toBe(now.getTime() + 3_600_000);
  });

  it("completa, reintenta, falla, cancela un grupo (salvo una) y limpia las terminadas", async () => {
    const tenant = await insertTenant("tasks-b");
    const repo = new SqlTaskRepository(sql);
    const now = new Date();
    const enqueue = (key: string, group = "g1") =>
      repo.enqueue(randomUUID(), { tenantId: tenant, kind: "demo", groupKey: group, dedupeKey: `${tenant}:${key}`, payload: {}, dueAt: now, maxAttempts: 3 });
    await enqueue("ok");
    await enqueue("retry");
    await enqueue("fail");
    const byKey = Object.fromEntries((await repo.claimDue(now, 10, 60_000)).map((t) => [t.dedupeKey.split(":")[1], t]));

    await repo.complete(byKey["ok"]!.id, now);
    await repo.retry(byKey["retry"]!.id, "uazapi caído", new Date(now.getTime() + 30_000));
    await repo.fail(byKey["fail"]!.id, "datos rotos", now);
    const rows = await sql.query<{ dedupe_key: string; status: string; last_error: string | null }>(
      "select dedupe_key, status, last_error from scheduled_tasks where tenant_id = $1 order by dedupe_key",
      [tenant]
    );
    expect(rows.rows.map((r) => [r.dedupe_key.split(":")[1], r.status, r.last_error])).toEqual([
      ["fail", "failed", "datos rotos"],
      ["ok", "done", null],
      ["retry", "pending", "uazapi caído"]
    ]);

    await enqueue("x", "chat");
    await enqueue("y", "chat");
    expect(await repo.cancelGroup(tenant, "chat", `${tenant}:y`)).toBe(1);
    expect(await repo.cancelGroup(tenant, "chat")).toBe(1);

    expect(await repo.purgeFinished(new Date(now.getTime() + 60_000), 100)).toBe(4);
    const left = await sql.query<{ dedupe_key: string }>("select dedupe_key from scheduled_tasks where tenant_id = $1", [tenant]);
    expect(left.rows.map((r) => r.dedupe_key.split(":")[1])).toEqual(["retry"]);
  });

  it("adelantar el tiempo: lo pendiente de un grupo vence ya y dice cuándo iba a vencer", async () => {
    const tenant = await insertTenant("tasks-c");
    const repo = new SqlTaskRepository(sql);
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 60_000);
    const enqueue = (key: string, group: string, dueAt: Date) => repo.enqueue(randomUUID(), { tenantId: tenant, kind: "flow.timer", groupKey: group, dedupeKey: `${tenant}:${key}`, payload: {}, dueAt });
    await enqueue("chat-a", "conversation:a", later);
    await enqueue("chat-b", "conversation:b", later);

    expect((await repo.advanceGroup(tenant, "conversation:a", now)).map((date) => date.getTime())).toEqual([later.getTime()]);
    expect(await repo.advanceGroup(tenant, "conversation:a", now)).toEqual([]);
    expect((await repo.claimDue(now, 10, 60_000)).map((t) => t.dedupeKey.split(":")[1])).toEqual(["chat-a"]);
  });
});
