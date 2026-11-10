import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlProductRepository } from "../../infrastructure/persistence/sql/SqlProductRepository.js";
import { SqlSaleRepository } from "../../infrastructure/persistence/sql/SqlSaleRepository.js";
import { ProductServices } from "../../domains/products/application/ProductServices.js";
import { FlowSaleRecorder } from "../../domains/sales/application/FlowSaleRecorder.js";
import { SaleServices } from "../../domains/sales/application/SaleServices.js";
import { SalesInsights } from "../../domains/sales/application/SalesInsights.js";
import { SqlSalesInsights } from "../../infrastructure/persistence/sql/SqlSalesInsights.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Ventas y Productos en PostgreSQL (rama `test`): precios por país que se
// reemplazan enteros, el mismo comprobante una sola vez (aunque lleguen dos a
// la vez), totales por moneda solo con aprobadas, y la base rechaza una venta
// «aprobada» incompleta aunque el código fallara.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

const services = () => {
  const products = new ProductServices(new SqlProductRepository(sql));
  const repository = new SqlSaleRepository(sql);
  return { products, sales: new SaleServices(repository, products, async () => "America/Bogota"), recorder: new FlowSaleRecorder(repository, products) };
};

const flowSale = (productId: string, over: Record<string, unknown> = {}) => ({
  productId,
  amountMode: "variable" as const,
  amount: "49.900",
  currency: "COP",
  customerName: "Laura",
  reference: "M-1",
  contactId: null,
  contactName: null,
  customerPhone: "573001112233",
  connectionId: null,
  flowKey: "flujo",
  adSourceId: "1202",
  soldAt: "2026-11-01T15:00:00.000Z",
  stepKey: "s:n:m",
  ...over
});

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

describe("Ventas y Productos en PostgreSQL", () => {
  it("guarda el producto con sus precios por país y al editarlo los reemplaza enteros", async () => {
    const tenantId = await insertTenant("ventas-a");
    const { products } = services();
    const created = await products.create(tenantId, {
      name: "Video",
      kind: "main",
      prices: [{ country: "CO", currency: "COP", amount: 10000 }, { country: "VE", currency: "USD", amount: 12.5 }]
    });
    expect(created.prices).toEqual([{ country: "CO", currency: "COP", amount: 10000 }, { country: "VE", currency: "USD", amount: 12.5 }]);
    const edited = await products.update(tenantId, created.id, { name: "Video HD", kind: "main", prices: [{ country: "MX", currency: "MXN", amount: 199 }] });
    expect(edited.prices).toEqual([{ country: "MX", currency: "MXN", amount: 199 }]);
    await expect(products.create(tenantId, { name: "video hd", kind: "upsell", prices: [{ country: "CO", currency: "COP", amount: 1 }] })).rejects.toThrow("Ya tienes");
  });

  it("el mismo comprobante se registra una sola vez, aunque lleguen dos a la vez", async () => {
    const tenantId = await insertTenant("ventas-b");
    const { products, recorder, sales } = services();
    const video = await products.create(tenantId, { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 49900 }] });
    const [a, b] = await Promise.all([recorder.record(tenantId, flowSale(video.id)), recorder.record(tenantId, flowSale(video.id, { stepKey: "otro" }))]);
    expect(a.id).toBe(b.id);
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
    const list = await sales.list({ tenantId, userId: "u", canRecord: true, canManage: true }, {});
    expect(list.sales).toHaveLength(1);
    expect(list.sales[0]).toMatchObject({ status: "approved", amount: 49900, currency: "COP", productName: "Video", adSourceId: "1202", receiptReference: "M-1" });
    expect((await products.list(tenantId, true)).products[0]?.salesCount).toBe(1);
  });

  it("totales por moneda solo con aprobadas; «Por revisar» se cuenta aparte", async () => {
    const tenantId = await insertTenant("ventas-c");
    const { products, recorder, sales } = services();
    const video = await products.create(tenantId, { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 1 }] });
    await recorder.record(tenantId, flowSale(video.id, { reference: "R1" }));
    await recorder.record(tenantId, flowSale(video.id, { reference: "R2", amount: "100.100" }));
    await recorder.record(tenantId, flowSale(video.id, { reference: "R3", amount: "12", currency: "USD" }));
    await recorder.record(tenantId, flowSale(video.id, { reference: "R4", amount: "" }));
    const list = await sales.list({ tenantId, userId: "u", canRecord: true, canManage: true }, { from: "2026-11-01", to: "2026-11-01" });
    expect(list.totals).toEqual([{ currency: "COP", amount: 150000, count: 2 }, { currency: "USD", amount: 12, count: 1 }]);
    expect(list.reviewCount).toBe(1);
  });

  it("la portada: curva por día en la hora de la empresa, lo que más vende y las semanas por producto", async () => {
    const tenantId = await insertTenant("ventas-e");
    const { products, recorder } = services();
    const video = await products.create(tenantId, { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 1 }] });
    // 11:30 p. m. del 7 en Bogotá = 04:30 UTC del 8: es venta del 7.
    await recorder.record(tenantId, flowSale(video.id, { reference: "D1", amount: "40", soldAt: "2026-10-08T04:30:00.000Z" }));
    await recorder.record(tenantId, flowSale(video.id, { reference: "D2", amount: "25", soldAt: "2026-10-09T15:00:00.000Z" }));
    const insights = new SalesInsights(new SqlSaleRepository(sql), new SqlSalesInsights(sql), async () => "America/Bogota", () => new Date("2026-10-10T12:00:00.000Z"));
    const overview = await insights.overview(tenantId, { from: "2026-10-07", to: "2026-10-09" });
    expect(overview.series[0]?.points).toEqual([
      { day: "2026-10-07", amount: 40 },
      { day: "2026-10-08", amount: 0 },
      { day: "2026-10-09", amount: 25 }
    ]);
    expect(overview.topProducts).toEqual([{ productId: video.id, name: "Video", kind: "main", count: 2, share: 100 }]);
    expect((await insights.productStats(tenantId)).products).toEqual([{ productId: video.id, weekly: [0, 0, 0, 0, 0, 0, 0, 2], recent: 2, change: null }]);
  });

  it("la base rechaza una venta aprobada sin producto, monto o moneda", async () => {
    const tenantId = await insertTenant("ventas-d");
    await expect(
      sql.query("insert into sales (tenant_id, status, source, amount, currency) values ($1, 'approved', 'manual', 10, 'COP')", [tenantId])
    ).rejects.toThrow(/sales_approved_complete_check/);
  });
});
