import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlFxRates } from "../../infrastructure/persistence/sql/SqlFxRates.js";
import type { FxSource } from "../../infrastructure/fx/FxSources.js";
import { createTestSqlClient } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Las tasas de cambio en PostgreSQL: el bolívar del BCV gana sobre la otra
// fuente, cada tasa guarda de dónde vino, si faltan monedas se reintenta (a la
// hora), y si pasa más de un día sin tasas queda el aviso. Usa días de 2030
// para no tocar las tasas reales de la base de pruebas.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const clean = () => sql.query("delete from fx_rates where day >= '2030-01-01'");

const source = (name: string, quotes: Record<string, number> | Error): FxSource => ({
  name,
  fetch: vi.fn(async () => {
    if (quotes instanceof Error) throw quotes;
    return Object.fromEntries(Object.entries(quotes).map(([code, perUsd]) => [code, { perUsd }]));
  })
});

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.close();
});

describe("SqlFxRates", () => {
  it("el bolívar del BCV, las demás de la otra fuente, cada una con su origen; incompletas se reintentan a la hora", async () => {
    const clock = { ms: Date.parse("2030-01-10T11:00:00Z") };
    const bcv = source("bcv", { VES: 904.4485 });
    const other = source("open-er-api", { VES: 905, COP: 3301.6, MXN: 18.2 });
    const rates = new SqlFxRates(sql, undefined, () => new Date(clock.ms), { sources: [bcv, other] });

    await rates.refresh();
    const latest = await rates.latest();
    expect(latest.day).toBe("2030-01-10");
    expect(latest.rates).toEqual([
      { currency: "COP", perUsd: 3301.6, source: "open-er-api" },
      { currency: "MXN", perUsd: 18.2, source: "open-er-api" },
      { currency: "VES", perUsd: 904.4485, source: "bcv" }
    ]);
    expect((await rates.table("2030-01-10", "2030-01-10")).get("2030-01-10")?.get("VES")).toBe(904.4485);

    // Faltan monedas que tenía el día anterior: dentro de la hora no insiste; después, sí.
    await rates.refresh();
    expect(bcv.fetch).toHaveBeenCalledTimes(1);
    clock.ms += 3_600_001;
    await rates.refresh();
    expect(bcv.fetch).toHaveBeenCalledTimes(2);
  });

  it("si las fuentes no responden, no inventa nada y avisa cuando pasa más de un día sin tasas", async () => {
    await sql.query("insert into fx_rates (day, currency, per_usd, source) values ('2030-01-10', 'COP', 3300, 'open-er-api')");
    const stale = vi.fn();
    const rates = new SqlFxRates(sql, undefined, () => new Date("2030-01-13T12:00:00Z"), {
      sources: [source("bcv", new Error("sin red")), source("open-er-api", new Error("caída"))],
      onStale: stale
    });
    await rates.refresh();
    expect((await rates.latest()).day).toBe("2030-01-10");
    expect(stale).toHaveBeenCalledWith({ lastDay: "2030-01-10", errors: ["bcv: sin red", "open-er-api: caída"] });
  });
});
