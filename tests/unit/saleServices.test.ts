import { describe, expect, it } from "vitest";
import { ProductServices } from "../../domains/products/application/ProductServices.js";
import { SaleServices, type SaleActor } from "../../domains/sales/application/SaleServices.js";
import type { ChatSaleLinks } from "../../domains/sales/application/ChatSaleLinks.js";
import type { ApprovedSaleEvent } from "../../domains/sales/application/SaleEvents.js";
import { InMemoryProductRepository, InMemorySaleRepository, InMemorySalesStore } from "../../infrastructure/persistence/memory/InMemorySalesRepositories.js";

// ---------------------------------------------------------------------------
// Ventas por la API: anotar a mano (completa → aprobada; si falta algo →
// «Por revisar»), revisar, aprobar solo si está completa, anular con motivo,
// totales por moneda SOLO con aprobadas, y cada cuenta con lo suyo.
// ---------------------------------------------------------------------------

const ADMIN: SaleActor = { tenantId: "tenant-a", userId: "user-1", canRecord: true, canManage: true };

async function setup() {
  const store = new InMemorySalesStore();
  const products = new ProductServices(new InMemoryProductRepository(store));
  const sales = new SaleServices(new InMemorySaleRepository(store), products, async () => "America/Bogota");
  const video = await products.create("tenant-a", { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 10000 }] });
  return { products, sales, video };
}

describe("SaleServices", () => {
  it("una venta completa anotada a mano queda aprobada y cuenta; el país sale del teléfono", async () => {
    const { sales, video } = await setup();
    const sale = await sales.record(ADMIN, { productId: video.id, amount: 10000, currency: "cop", customerName: "Ana", customerPhone: "+57 300 123 4567" });
    expect(sale).toMatchObject({ status: "approved", source: "manual", productName: "Video", amount: 10000, currency: "COP", country: "CO", customerPhone: "573001234567" });
    const list = await sales.list(ADMIN, {});
    expect(list.totals).toEqual([{ currency: "COP", amount: 10000, count: 1 }]);
  });

  it("sin monto queda «Por revisar», no suma, y se cuenta en la pestaña", async () => {
    const { sales, video } = await setup();
    const sale = await sales.record(ADMIN, { productId: video.id, currency: "COP", customerName: "Luis" });
    expect(sale.status).toBe("review");
    expect(sale.reviewReason).toBe("Falta el monto.");
    const list = await sales.list(ADMIN, {});
    expect(list.totals).toEqual([]);
    expect(list.reviewCount).toBe(1);
  });

  it("al revisar: aprobar exige que esté completa; completa, se aprueba y empieza a contar", async () => {
    const { sales, video } = await setup();
    const sale = await sales.record(ADMIN, { productId: video.id, currency: "COP" });
    await expect(sales.update(ADMIN, sale.id, { status: "approved" })).rejects.toThrow("falta el monto");
    const approved = await sales.update(ADMIN, sale.id, { amount: 9500, status: "approved" });
    expect(approved).toMatchObject({ status: "approved", amount: 9500, reviewReason: null });
    expect((await sales.list(ADMIN, {})).reviewCount).toBe(0);
  });

  it("anular exige un motivo; anulada se conserva pero ya no suma", async () => {
    const { sales, video } = await setup();
    const sale = await sales.record(ADMIN, { productId: video.id, amount: 10000, currency: "COP" });
    await expect(sales.update(ADMIN, sale.id, { status: "void" })).rejects.toThrow("por qué");
    const voided = await sales.update(ADMIN, sale.id, { status: "void", voidReason: "Pago falso" });
    expect(voided).toMatchObject({ status: "void", reviewReason: "Pago falso" });
    expect((await sales.list(ADMIN, {})).totals).toEqual([]);
  });

  it("los totales nunca mezclan monedas", async () => {
    const { sales, video } = await setup();
    await sales.record(ADMIN, { productId: video.id, amount: 10000, currency: "COP" });
    await sales.record(ADMIN, { productId: video.id, amount: 5000, currency: "COP" });
    await sales.record(ADMIN, { productId: video.id, amount: 12.5, currency: "USD" });
    expect((await sales.list(ADMIN, {})).totals).toEqual([
      { currency: "COP", amount: 15000, count: 2 },
      { currency: "USD", amount: 12.5, count: 1 }
    ]);
  });

  it("filtra por periodo en la hora de la empresa y por búsqueda", async () => {
    const { sales, video } = await setup();
    // 11:30 p. m. del 10 en Bogotá = 04:30 UTC del 11: es venta del 10.
    await sales.record(ADMIN, { productId: video.id, amount: 100, currency: "COP", customerName: "Noche", soldAt: "2026-10-11T04:30:00.000Z" });
    await sales.record(ADMIN, { productId: video.id, amount: 200, currency: "COP", customerName: "Mañana", soldAt: "2026-10-09T15:00:00.000Z" });
    expect((await sales.list(ADMIN, { from: "2026-10-10", to: "2026-10-10" })).sales.map((s) => s.customerName)).toEqual(["Noche"]);
    expect((await sales.list(ADMIN, { search: "mañ" })).sales.map((s) => s.customerName)).toEqual(["Mañana"]);
  });

  it("no acepta un producto archivado ni de otra cuenta, ni una venta de otra cuenta", async () => {
    const { sales, products, video } = await setup();
    await products.update("tenant-a", video.id, { name: "Video", kind: "main", status: "archived", prices: video.prices });
    await expect(sales.record(ADMIN, { productId: video.id, amount: 1, currency: "COP" })).rejects.toThrow("archivado");
    const sale = await sales.record(ADMIN, { amount: 1, currency: "COP" });
    await expect(sales.update({ ...ADMIN, tenantId: "tenant-b" }, sale.id, { note: "x" })).rejects.toThrow("no existe");
  });

  it("pagina de 50 en 50, la más reciente primero", async () => {
    const { sales, video } = await setup();
    for (let i = 0; i < 52; i += 1) {
      await sales.record(ADMIN, { productId: video.id, amount: 1, currency: "COP", soldAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() });
    }
    const first = await sales.list(ADMIN, {});
    expect(first.sales).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await sales.list(ADMIN, { cursor: first.nextCursor! });
    expect(second.sales).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  describe("desde un chat", () => {
    const CHAT = "c0c0c0c0-0000-4000-8000-000000000001";
    const CONTACT = "c0c0c0c0-0000-4000-8000-0000000000aa";
    const CONNECTION = "c0c0c0c0-0000-4000-8000-0000000000bb";
    const chats: ChatSaleLinks = {
      find: async (tenantId, id) => (tenantId === "tenant-a" && id === CHAT
        ? { contactId: CONTACT, connectionId: CONNECTION, customerName: "Laura", customerPhone: "584121234567", adSourceId: "ad-9" }
        : null)
    };
    async function chatSetup() {
      const store = new InMemorySalesStore();
      const products = new ProductServices(new InMemoryProductRepository(store));
      const approved: ApprovedSaleEvent[] = [];
      const sales = new SaleServices(new InMemorySaleRepository(store), products, async () => "America/Bogota", { saleApproved: async (_t, sale) => void approved.push(sale) }, chats);
      const video = await products.create("tenant-a", { name: "Video", kind: "main", prices: [{ country: "VE", currency: "USD", amount: 12 }] });
      return { sales, video, approved };
    }

    it("queda amarrada al cliente, al número y al anuncio por el que llegó (cuenta para su ROAS y mueve el CRM)", async () => {
      const { sales, video, approved } = await chatSetup();
      const sale = await sales.record(ADMIN, { conversationId: CHAT, productId: video.id, amount: "12", currency: "USD" });
      expect(sale).toMatchObject({ status: "approved", source: "manual", contactId: CONTACT, adSourceId: "ad-9", customerName: "Laura", customerPhone: "584121234567", country: "VE" });
      expect(approved).toEqual([expect.objectContaining({ id: sale.id, contactId: CONTACT, amount: 12 })]);
    });

    it("lo escrito a mano gana al nombre y al teléfono del chat; el anuncio siempre sale del chat", async () => {
      const { sales, video } = await chatSetup();
      const sale = await sales.record(ADMIN, { conversationId: CHAT, productId: video.id, amount: 12, currency: "USD", customerName: "Laura Pérez", customerPhone: "+57 300 123 4567", adSourceId: "otro" } as never);
      expect(sale).toMatchObject({ customerName: "Laura Pérez", customerPhone: "573001234567", country: "CO", adSourceId: "ad-9" });
    });

    it("un chat de otra cuenta, inexistente o mal escrito no se puede usar", async () => {
      const { sales } = await chatSetup();
      await expect(sales.record({ ...ADMIN, tenantId: "tenant-b" }, { conversationId: CHAT })).rejects.toThrow("Ese chat no existe.");
      await expect(sales.record(ADMIN, { conversationId: "no-es-uuid" })).rejects.toThrow("Ese chat no existe.");
      const without = new SaleServices(new InMemorySaleRepository(new InMemorySalesStore()), new ProductServices(new InMemoryProductRepository(new InMemorySalesStore())), async () => "America/Bogota");
      await expect(without.record(ADMIN, { conversationId: CHAT })).rejects.toThrow("Ese chat no existe.");
    });
  });
});
