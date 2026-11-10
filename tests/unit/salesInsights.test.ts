import { describe, expect, it } from "vitest";
import { ProductServices } from "../../domains/products/application/ProductServices.js";
import { SaleServices, type SaleActor } from "../../domains/sales/application/SaleServices.js";
import { SalesInsights, daysBetween, percentChange } from "../../domains/sales/application/SalesInsights.js";
import { InMemorySalesInsights } from "../../infrastructure/persistence/memory/InMemorySalesInsights.js";
import { InMemoryProductRepository, InMemorySaleRepository, InMemorySalesStore } from "../../infrastructure/persistence/memory/InMemorySalesRepositories.js";

// ---------------------------------------------------------------------------
// La portada de Ventas: por moneda frente al periodo anterior del mismo largo,
// la curva por día (los días sin ventas en 0, cortados en la hora de la
// empresa), el mejor día, lo que más vende y las semanas de cada producto.
// Solo cuentan las aprobadas.
// ---------------------------------------------------------------------------

const ADMIN: SaleActor = { tenantId: "t", userId: "u", canRecord: true, canManage: true };
const NOW = new Date("2026-10-31T12:00:00.000Z");

async function setup() {
  const store = new InMemorySalesStore();
  const products = new ProductServices(new InMemoryProductRepository(store));
  const repository = new InMemorySaleRepository(store);
  const sales = new SaleServices(repository, products, async () => "America/Bogota");
  const insights = new SalesInsights(repository, new InMemorySalesInsights(store), async () => "America/Bogota", () => NOW);
  const video = await products.create("t", { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 100 }] });
  const portada = await products.create("t", { name: "Portada", kind: "upsell", prices: [{ country: "CO", currency: "COP", amount: 50 }] });
  const sell = (productId: string | null, amount: number | null, currency: string, soldAt: string) => sales.record(ADMIN, { productId, amount, currency, soldAt });
  return { sell, insights, video, portada };
}

describe("ayudas", () => {
  it("cambio en porcentaje entero, sin comparar contra cero", () => {
    expect(percentChange(118, 100)).toBe(18);
    expect(percentChange(96, 100)).toBe(-4);
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(50, null)).toBeNull();
  });

  it("los días de un periodo, ambos incluidos", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("SalesInsights.overview", () => {
  it("por moneda, con el cambio frente al periodo anterior del mismo largo", async () => {
    const { sell, insights, video } = await setup();
    await sell(video.id, 100, "COP", "2026-10-03T15:00:00.000Z"); // periodo anterior (1–5 oct)
    await sell(video.id, 118, "COP", "2026-10-08T15:00:00.000Z"); // periodo (6–10 oct)
    await sell(video.id, 12, "USD", "2026-10-09T15:00:00.000Z");
    await sell(video.id, null, "COP", "2026-10-09T16:00:00.000Z"); // por revisar: no cuenta
    const result = await insights.overview("t", { from: "2026-10-06", to: "2026-10-10" });
    expect(result.currencies).toEqual([
      { currency: "COP", amount: 118, count: 1, average: 118, previousAmount: 100, change: 18 },
      { currency: "USD", amount: 12, count: 1, average: 12, previousAmount: 0, change: null }
    ]);
  });

  it("la curva tiene un punto por día (0 si no hubo), cortada en la hora de la empresa, y el mejor día", async () => {
    const { sell, insights, video } = await setup();
    // 11:30 p. m. del 7 en Bogotá (04:30 UTC del 8): es venta del 7.
    await sell(video.id, 40, "COP", "2026-10-08T04:30:00.000Z");
    await sell(video.id, 25, "COP", "2026-10-09T15:00:00.000Z");
    const result = await insights.overview("t", { from: "2026-10-06", to: "2026-10-10" });
    expect(result.series[0]).toEqual({
      currency: "COP",
      points: [
        { day: "2026-10-06", amount: 0 },
        { day: "2026-10-07", amount: 40 },
        { day: "2026-10-08", amount: 0 },
        { day: "2026-10-09", amount: 25 },
        { day: "2026-10-10", amount: 0 }
      ]
    });
    expect(result.bestDay).toEqual({ day: "2026-10-07", amount: 40, currency: "COP" });
  });

  it("lo que más vende, con su parte de las ventas; «Todo» no compara ni dibuja curva", async () => {
    const { sell, insights, video, portada } = await setup();
    await sell(video.id, 100, "COP", "2026-10-08T15:00:00.000Z");
    await sell(video.id, 100, "COP", "2026-10-08T16:00:00.000Z");
    await sell(video.id, 100, "COP", "2026-10-08T17:00:00.000Z");
    await sell(portada.id, 50, "COP", "2026-10-08T18:00:00.000Z");
    const result = await insights.overview("t", {});
    expect(result.topProducts).toEqual([
      { productId: video.id, name: "Video", kind: "main", count: 3, share: 75 },
      { productId: portada.id, name: "Portada", kind: "upsell", count: 1, share: 25 }
    ]);
    expect(result.series).toEqual([]);
    expect(result.currencies[0]?.change).toBeNull();
  });
});

describe("SalesInsights.productStats", () => {
  it("8 semanas por producto (la actual al final) y las 4 últimas frente a las 4 anteriores", async () => {
    const { sell, insights, video } = await setup();
    await sell(video.id, 1, "COP", "2026-10-30T12:00:00.000Z"); // esta semana
    await sell(video.id, 1, "COP", "2026-10-29T12:00:00.000Z"); // esta semana
    await sell(video.id, 1, "COP", "2026-10-20T12:00:00.000Z"); // hace 1 semana
    await sell(video.id, 1, "COP", "2026-09-20T12:00:00.000Z"); // hace 5 semanas
    const { products } = await insights.productStats("t");
    expect(products).toEqual([{ productId: video.id, weekly: [0, 0, 1, 0, 0, 0, 1, 2], recent: 3, change: 200 }]);
  });
});
