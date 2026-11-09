import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlRateLimiter } from "../../infrastructure/persistence/sql/SqlRateLimiter.js";
import { createTestSqlClient } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Límite de peticiones en PostgreSQL (`022_rate_limits.sql`), contra la rama
// `test` de Neon: la cuenta es una sola para todas las instancias y contar es
// atómico (peticiones a la vez nunca se cuentan como una).
// ---------------------------------------------------------------------------

let sql: SqlClient;
const prefix = `test-rl-${randomUUID()}`;

beforeAll(() => {
  sql = createTestSqlClient();
});

afterAll(async () => {
  await sql.query("delete from rate_limit_counters where key like $1", [`${prefix}%`]);
  await sql.close();
});

describe("SqlRateLimiter", () => {
  it("con 12 peticiones a la vez y límite 5, entran exactamente 5; las demás saben cuándo reintentar", async () => {
    const policy = { windowMs: 60_000, maxRequests: 5 };
    // Dos «instancias» con la misma base: comparten la cuenta.
    const instances = [new SqlRateLimiter(sql), new SqlRateLimiter(sql)];
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => instances[i % 2]!.check(`${prefix}:a`, policy)));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    const denied = results.find((result) => !result.allowed);
    expect(denied && !denied.allowed && denied.retryAfterMs > 0 && denied.retryAfterMs <= 60_000).toBe(true);
  });

  it("cada clave y cada ventana cuentan aparte", async () => {
    const policy = { windowMs: 1_000, maxRequests: 1 };
    let now = Date.parse("2026-11-09T12:00:00.000Z");
    const limiter = new SqlRateLimiter(sql, () => now);
    expect((await limiter.check(`${prefix}:b`, policy)).allowed).toBe(true);
    expect((await limiter.check(`${prefix}:b`, policy)).allowed).toBe(false);
    expect((await limiter.check(`${prefix}:c`, policy)).allowed).toBe(true);
    now += 1_000;
    expect((await limiter.check(`${prefix}:b`, policy)).allowed).toBe(true);
  });
});
