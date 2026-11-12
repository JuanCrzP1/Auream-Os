import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { composeOtherExpenseServices } from "../../apps/api/composition/composeOtherExpenseServices.js";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Otros gastos en PostgreSQL: guardar y leer sin perder decimales ni fechas,
// todo por cuenta, la base rechaza un % fuera de rango aunque algo se salte
// el dominio, y si se borra la línea el gasto pasa a todo el negocio.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function seed() {
  const q = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!.id;
  const tenant = await q("insert into tenants (key, name) values ($1, 'gastos') returning id", [TEST_KEY_PREFIX + "gastos"]);
  const other = await q("insert into tenants (key, name) values ($1, 'otra') returning id", [TEST_KEY_PREFIX + "gastos-otra"]);
  const line = await q("insert into sales_lines (id, tenant_id, name, color, campaign_ids) values ($1, $2, 'Venezuela', '#6c4fe0', '{111}') returning id", [randomUUID(), tenant]);
  return { tenant, other, line };
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlOtherExpenseRepository", () => {
  it("guarda y lee fijos y %, edita, y cada cuenta ve solo los suyos", async () => {
    const { tenant, other, line } = await seed();
    const { expenses, reader } = composeOtherExpenseServices(sql);
    const nomina = await expenses.create(tenant, { name: "Nómina", kind: "fixed", amount: "1.200.000,50", currency: "COP", frequency: "monthly", startsOn: "2026-10-31", lineId: line });
    await expenses.create(tenant, { name: "Pasarela", kind: "percent", amount: "3,5", startsOn: "2026-11-01", endsOn: "2026-12-31" });

    expect(nomina).toMatchObject({ amount: 1_200_000.5, currency: "COP", frequency: "monthly", startsOn: "2026-10-31", endsOn: null, lineId: line });
    expect(await reader.list(tenant)).toEqual([
      { id: nomina.id, name: "Nómina", kind: "fixed", amount: 1_200_000.5, currency: "COP", frequency: "monthly", startsOn: "2026-10-31", endsOn: null, lineId: line },
      expect.objectContaining({ name: "Pasarela", kind: "percent", amount: 3.5, currency: null, frequency: null, endsOn: "2026-12-31" })
    ]);
    expect((await expenses.update(tenant, nomina.id, { amount: 900_000, endsOn: "2027-01-31" }))).toMatchObject({ amount: 900_000, endsOn: "2027-01-31", name: "Nómina" });

    expect((await expenses.list(other, true)).expenses).toEqual([]);
    await expect(expenses.remove(other, nomina.id)).rejects.toThrow(/no existe/);
    // La línea de otra cuenta no sirve.
    await expect(expenses.create(other, { name: "X", kind: "percent", amount: 1, startsOn: "2026-11-01", lineId: line })).rejects.toThrow(/línea/);
  });

  it("si se borra la línea, el gasto queda para todo el negocio; la base no acepta un % mayor a 100", async () => {
    const { tenant, line } = await seed();
    const { expenses } = composeOtherExpenseServices(sql);
    const flyers = await expenses.create(tenant, { name: "Flyers", kind: "fixed", amount: 50_000, currency: "COP", frequency: "once", startsOn: "2026-11-05", lineId: line });
    await sql.query("delete from sales_lines where id = $1", [line]);
    expect((await expenses.list(tenant, true)).expenses[0]).toMatchObject({ id: flyers.id, lineId: null });

    await expect(
      sql.query("insert into other_expenses (id, tenant_id, name, kind, amount, starts_on) values ($1, $2, 'Mal', 'percent', 150, '2026-11-01')", [randomUUID(), tenant])
    ).rejects.toThrow(/other_expenses_amount_check/);
  });
});
