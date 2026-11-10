import { describe, expect, it } from "vitest";
import { validateRecordSale } from "../../contracts/blocks/validation/recordSale.js";
import { readRecordSaleConfig } from "../../contracts/RecordSaleConfig.js";
import { ProductServices } from "../../domains/products/application/ProductServices.js";
import { FlowSaleRecorder, type FlowSaleInput } from "../../domains/sales/application/FlowSaleRecorder.js";
import { InMemoryProductRepository, InMemorySaleRepository, InMemorySalesStore } from "../../infrastructure/persistence/memory/InMemorySalesRepositories.js";

// ---------------------------------------------------------------------------
// El bloque «Registrar venta»: su configuración, y cómo Ventas decide la venta
// de un flujo — monto y moneda de las variables o precio del producto en el
// país del cliente; «Por revisar» si falta algo (NUNCA un precio inventado);
// el mismo comprobante no se registra dos veces; la simulación no guarda.
// ---------------------------------------------------------------------------

const TENANT = "tenant-a";

async function setup() {
  const store = new InMemorySalesStore();
  const products = new ProductServices(new InMemoryProductRepository(store));
  const video = await products.create(TENANT, {
    name: "Video",
    kind: "main",
    prices: [{ country: "CO", currency: "COP", amount: 10000 }, { country: "VE", currency: "USD", amount: 12 }]
  });
  return { store, recorder: new FlowSaleRecorder(new InMemorySaleRepository(store), products), video };
}

const input = (over: Partial<FlowSaleInput> = {}): FlowSaleInput => ({
  productId: "",
  amountMode: "variable",
  amount: "10000",
  currency: "COP",
  customerName: "",
  reference: "REF-1",
  contactId: null,
  contactName: "Ana Pérez",
  customerPhone: "573001234567",
  connectionId: null,
  flowKey: "flujo-ventas",
  adSourceId: "120244134508330395",
  soldAt: "2026-11-10T15:00:00.000Z",
  stepKey: "s1:n1:m1",
  ...over
});

describe("configuración del bloque", () => {
  it("nace leyendo el comprobante y exige el producto", () => {
    const config = readRecordSaleConfig({});
    expect(config).toMatchObject({ amountMode: "variable", amount: "{comprobante.valor}", currency: "{comprobante.moneda}", reference: "{comprobante.referencia}", resultVariable: "venta" });
    expect(validateRecordSale({}, {}).reason).toContain("producto");
    expect(validateRecordSale({}, { productId: "p", amount: "" }).reason).toContain("monto");
    expect(validateRecordSale({}, { productId: "p", amountMode: "product", amount: "" }).valid).toBe(true);
  });
});

describe("FlowSaleRecorder", () => {
  it("con el monto y la moneda del comprobante: aprobada, con el anuncio y el nombre del contacto", async () => {
    const { recorder, video } = await setup();
    const sale = await recorder.record(TENANT, input({ productId: video.id, amount: "$ 10.000", currency: "cop" }));
    expect(sale).toMatchObject({ status: "approved", productName: "Video", amount: 10000, currency: "COP", country: "CO", saved: true, duplicate: false });
  });

  it("con el precio del producto: el del país del cliente, por su teléfono", async () => {
    const { recorder, video } = await setup();
    const sale = await recorder.record(TENANT, input({ productId: video.id, amountMode: "product", customerPhone: "584120750409", reference: "R-VE" }));
    expect(sale).toMatchObject({ status: "approved", amount: 12, currency: "USD", country: "VE" });
  });

  it("sin precio en el país del cliente: «Por revisar» con el motivo, sin inventar un monto", async () => {
    const { recorder, video } = await setup();
    const sale = await recorder.record(TENANT, input({ productId: video.id, amountMode: "product", customerPhone: "5215512345678", reference: "R-MX" }));
    expect(sale).toMatchObject({ status: "review", amount: null, currency: null, reviewReason: "«Video» no tiene precio en México." });
  });

  it("monto ilegible, moneda desconocida o producto archivado: «Por revisar»", async () => {
    const { recorder, video } = await setup();
    expect((await recorder.record(TENANT, input({ productId: video.id, amount: "", reference: "A" }))).reviewReason).toBe("El comprobante no trajo el monto.");
    expect((await recorder.record(TENANT, input({ productId: video.id, currency: "PESOS", reference: "B" }))).reviewReason).toContain("no es una moneda");
    expect((await recorder.record(TENANT, input({ productId: "00000000-0000-4000-8000-000000000000", reference: "C" }))).reviewReason).toContain("ya no existe");
  });

  it("el mismo comprobante no se registra dos veces; sin referencia, el mismo paso tampoco", async () => {
    const { recorder, store, video } = await setup();
    const first = await recorder.record(TENANT, input({ productId: video.id }));
    const again = await recorder.record(TENANT, input({ productId: video.id, stepKey: "otro-paso" }));
    expect(again).toMatchObject({ id: first.id, duplicate: true });
    await recorder.record(TENANT, input({ productId: video.id, reference: "", stepKey: "s9" }));
    await recorder.record(TENANT, input({ productId: video.id, reference: "", stepKey: "s9" }));
    expect(store.sales.size).toBe(2);
  });

  it("la simulación calcula la venta igual, pero no la guarda", async () => {
    const { recorder, store, video } = await setup();
    const preview = await recorder.preview(TENANT, input({ productId: video.id }));
    expect(preview).toMatchObject({ id: null, status: "approved", amount: 10000, saved: false });
    expect(store.sales.size).toBe(0);
  });
});
