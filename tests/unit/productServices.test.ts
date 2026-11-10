import { describe, expect, it } from "vitest";
import { ProductServices } from "../../domains/products/application/ProductServices.js";
import { InMemoryProductRepository } from "../../infrastructure/persistence/memory/InMemorySalesRepositories.js";

// ---------------------------------------------------------------------------
// El catálogo: un precio por país (moneda del país por defecto, o la que el
// negocio cobre allí), nombres únicos por cuenta, archivar en vez de borrar y
// cada cuenta con lo suyo.
// ---------------------------------------------------------------------------

const TENANT = "tenant-a";
const services = () => new ProductServices(new InMemoryProductRepository());

describe("ProductServices", () => {
  it("crea un producto con precio por país; la moneda sale del país si no se indica", async () => {
    const s = services();
    const product = await s.create(TENANT, {
      name: "  Video   Dilo cantando ",
      kind: "main",
      prices: [{ country: "co", currency: "", amount: 10000, cost: "3.500" }, { country: "VE", currency: "USD", amount: 12.5 }]
    });
    expect(product.name).toBe("Video Dilo cantando");
    expect(product.status).toBe("active");
    // El costo es opcional («3.500» = 3500); sin él queda `null` (no se sabe, no es cero).
    expect(product.prices).toEqual([
      { country: "CO", currency: "COP", amount: 10000, cost: 3500 },
      { country: "VE", currency: "USD", amount: 12.5, cost: null }
    ]);
  });

  it("rechaza sin nombre, sin precios, con un país repetido o un monto inválido", async () => {
    const s = services();
    await expect(s.create(TENANT, { name: "", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 1 }] })).rejects.toThrow("nombre");
    await expect(s.create(TENANT, { name: "A", kind: "main", prices: [] })).rejects.toThrow("al menos un país");
    await expect(
      s.create(TENANT, { name: "A", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 1 }, { country: "CO", currency: "USD", amount: 2 }] })
    ).rejects.toThrow("Colombia tiene dos precios");
    await expect(s.create(TENANT, { name: "A", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 0 }] })).rejects.toThrow("mayor que cero");
    await expect(s.create(TENANT, { name: "A", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 1, cost: "-5" }] })).rejects.toThrow("El costo en Colombia debe ser cero o más.");
    await expect(s.create(TENANT, { name: "A", kind: "main", prices: [{ country: "XX", currency: "COP", amount: 5 }] })).rejects.toThrow("país");
  });

  it("dos productos de la cuenta no se llaman igual (sin importar mayúsculas); en otra cuenta sí", async () => {
    const s = services();
    await s.create(TENANT, { name: "Restauración", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 100 }] });
    await expect(s.create(TENANT, { name: "restauración", kind: "upsell", prices: [{ country: "CO", currency: "COP", amount: 100 }] })).rejects.toThrow("Ya tienes");
    await expect(s.create("tenant-b", { name: "Restauración", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 100 }] })).resolves.toBeTruthy();
  });

  it("se edita y se archiva; un archivado ya no se puede elegir para vender", async () => {
    const s = services();
    const created = await s.create(TENANT, { name: "Portada", kind: "upsell", prices: [{ country: "CO", currency: "COP", amount: 5000 }] });
    const archived = await s.update(TENANT, created.id, { name: "Portada", kind: "upsell", status: "archived", prices: created.prices });
    expect(archived.status).toBe("archived");
    expect(await s.findActive(TENANT, created.id)).toBeNull();
    const back = await s.update(TENANT, created.id, { name: "Portada HD", kind: "upsell", status: "active", prices: created.prices });
    expect((await s.findActive(TENANT, back.id))?.name).toBe("Portada HD");
  });

  it("el producto de otra cuenta no existe para esta", async () => {
    const s = services();
    const created = await s.create(TENANT, { name: "Video", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 100 }] });
    expect(await s.findActive("tenant-b", created.id)).toBeNull();
    await expect(s.update("tenant-b", created.id, { name: "X", kind: "main", prices: created.prices })).rejects.toThrow("no existe");
  });
});
