import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlFlowTurnJournal } from "../../infrastructure/persistence/sql/SqlFlowTurnJournal.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// Historial interno de los turnos en PostgreSQL (`023_flow_turn_log.sql`).

let sql: SqlClient;

beforeAll(() => {
  sql = createTestSqlClient();
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlFlowTurnJournal", () => {
  it("guarda el turno completo y se lee por chat, lo más reciente primero", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}historial`, "historial"])).rows[0]!.id;
    const journal = new SqlFlowTurnJournal(sql);
    const base = {
      tenantId: tenant, conversationId: null as unknown as string, conversationKey: "conv-1", flowKey: "reconstruye", trigger: "Hola",
      events: ["delay_node_scheduled:intervalo"], session: { nodeId: "intervalo", status: "delayed" }, sent: 2, failures: [] as string[], error: null
    };
    await journal.record({ ...base, origin: "message", startedAt: "2026-11-09T12:00:00.000Z", finishedAt: "2026-11-09T12:00:01.000Z", steps: [{ nodeId: "m1", type: "message", status: "success" }], wakeUp: { reason: "resume", at: "2026-11-09T12:03:00.000Z" } });
    await journal.record({ ...base, origin: "timer", trigger: "resume:intervalo", startedAt: "2026-11-09T12:03:00.010Z", finishedAt: "2026-11-09T12:03:00.900Z", steps: [], wakeUp: null, error: "uazapi caído" });

    const rows = await sql.query<{ origin: string; steps: unknown; wake_up: unknown; error: string | null }>(
      "select origin, steps, wake_up, error from flow_turn_log where tenant_id = $1 and conversation_key = $2 order by started_at desc",
      [tenant, "conv-1"]
    );
    expect(rows.rows).toEqual([
      { origin: "timer", steps: [], wake_up: null, error: "uazapi caído" },
      { origin: "message", steps: [{ nodeId: "m1", type: "message", status: "success" }], wake_up: { reason: "resume", at: "2026-11-09T12:03:00.000Z" }, error: null }
    ]);
  });
});
