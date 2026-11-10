import { describe, expect, it } from "vitest";
import { SqlTenantResolver } from "../../infrastructure/persistence/sql/SqlTenantResolver.js";
import type { SqlExecutor } from "../../infrastructure/persistence/sql/SqlClient.js";

// ---------------------------------------------------------------------------
// El motor usa la zona horaria que cada empresa eligió en Empresa (Programador,
// horarios, fechas). Sin elegir, o si la base falla, la de la plataforma: el
// motor nunca se detiene por esto.
// ---------------------------------------------------------------------------

function fakeSql(zones: Record<string, string | null>, fail = { now: false }) {
  const calls: string[] = [];
  const sql: SqlExecutor = {
    query: async <T>(_text: string, params?: ReadonlyArray<unknown>) => {
      if (fail.now) throw new Error("sin conexión");
      const id = String(params?.[0]);
      calls.push(id);
      const rows = id in zones ? [{ timezone: zones[id] ?? null }] : [];
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }
  };
  return { sql, calls };
}

describe("SqlTenantResolver", () => {
  it("cada empresa con su zona; sin zona propia, la de la plataforma", async () => {
    const { sql } = fakeSql({ mx: "America/Mexico_City", co: null });
    const resolver = new SqlTenantResolver(sql, "America/Bogota");
    expect((await resolver.resolve("mx")).timezone).toBe("America/Mexico_City");
    expect((await resolver.resolve("co")).timezone).toBe("America/Bogota");
    expect(await resolver.resolve("mx")).toMatchObject({ tenantId: "mx", limits: { maxActiveSessions: 10_000 } });
  });

  it("recuerda la zona un rato (sin una consulta por turno) y toma el cambio al vencer", async () => {
    const zones: Record<string, string | null> = { mx: "America/Mexico_City" };
    const { sql, calls } = fakeSql(zones);
    const clock = { ms: 0 };
    const resolver = new SqlTenantResolver(sql, "America/Bogota", 30_000, () => clock.ms);
    await resolver.resolve("mx");
    zones["mx"] = "Europe/Madrid";
    clock.ms = 10_000;
    expect((await resolver.resolve("mx")).timezone).toBe("America/Mexico_City");
    clock.ms = 31_000;
    expect((await resolver.resolve("mx")).timezone).toBe("Europe/Madrid");
    expect(calls).toEqual(["mx", "mx"]);
  });

  it("si la base no responde, sigue con la última conocida o la de la plataforma", async () => {
    const fail = { now: false };
    const { sql } = fakeSql({ mx: "America/Mexico_City" }, fail);
    const clock = { ms: 0 };
    const resolver = new SqlTenantResolver(sql, "America/Bogota", 1_000, () => clock.ms);
    await resolver.resolve("mx");
    fail.now = true;
    clock.ms = 5_000;
    expect((await resolver.resolve("mx")).timezone).toBe("America/Mexico_City");
    expect((await resolver.resolve("nueva")).timezone).toBe("America/Bogota");
  });
});
