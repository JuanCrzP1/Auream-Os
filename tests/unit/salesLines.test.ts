import { describe, expect, it } from "vitest";
import { salesLineDraft } from "../../domains/sales-lines/domain/SalesLine.js";
import { SalesLineServices } from "../../domains/sales-lines/application/SalesLineServices.js";
import { DashboardScopeResolver, scopeOf } from "../../domains/analytics/application/DashboardScopeResolver.js";
import { InMemorySalesLineRepository } from "../../infrastructure/persistence/memory/InMemorySalesLineRepository.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";

// ---------------------------------------------------------------------------
// Líneas de venta: sus reglas (nombre, color, qué junta), crear y editar sin
// perder lo que no se tocó, y cómo el Dashboard combina la línea con lo que se
// filtre a mano (lo filtrado a mano gana; lo inválido se ignora).
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const P2 = "33333333-3333-4333-8333-333333333333";
const C1 = "44444444-4444-4444-8444-444444444444";

describe("una línea de venta", () => {
  it("limpia el nombre, usa el color de la marca por defecto y no repite ids", () => {
    expect(salesLineDraft({ name: "  Venezuela   VIP ", productIds: [P1, P1.toUpperCase()], campaignIds: ["120244"] })).toEqual({
      name: "Venezuela VIP", color: "#6c4fe0", productIds: [P1], connectionIds: [], campaignIds: ["120244"]
    });
  });

  it("pide nombre, un color de la paleta, ids válidos y al menos un producto o una campaña", () => {
    expect(() => salesLineDraft({ name: "", productIds: [P1] })).toThrow(/nombre/);
    expect(() => salesLineDraft({ name: "A", color: "#123456", productIds: [P1] })).toThrow(/colores/);
    expect(() => salesLineDraft({ name: "A", productIds: ["x"] })).toThrow(/productos que no existen/);
    expect(() => salesLineDraft({ name: "A", campaignIds: ["camp 1"] })).toThrow(/campañas que no existen/);
    // Los ids de campaña se respetan tal cual (con letras y mayúsculas).
    expect(salesLineDraft({ name: "A", campaignIds: ["Camp-1", "120244"] }).campaignIds).toEqual(["Camp-1", "120244"]);
    expect(() => salesLineDraft({ name: "A", connectionIds: [C1] })).toThrow(/todo el negocio/);
  });
});

describe("SalesLineServices", () => {
  it("crea, no repite nombres (sin importar mayúsculas) y editar solo el color conserva lo demás", async () => {
    let n = 0;
    const services = new SalesLineServices(new InMemorySalesLineRepository(), () => `${String(++n).padStart(8, "0")}-0000-4000-8000-000000000000`);
    const line = await services.create(T, { name: "Venezuela", productIds: [P1, P2], campaignIds: ["120244"] });
    await expect(services.create(T, { name: "venezuela", productIds: [P1] })).rejects.toBeInstanceOf(ConflictError);
    const edited = await services.update(T, line.id, { color: "#e0a400" });
    expect(edited).toMatchObject({ name: "Venezuela", color: "#e0a400", productIds: [P1, P2], campaignIds: ["120244"] });
    expect((await services.list("99999999-9999-4999-8999-999999999999", true)).lines).toEqual([]);
    await services.remove(T, line.id);
    expect((await services.list(T, true)).lines).toEqual([]);
  });
});

describe("la parte del negocio que mira el Dashboard", () => {
  const lookup = { scopeOf: async (_t: string, id: string) => (id === "55555555-5555-4555-8555-555555555555" ? { productIds: [P1], connectionIds: [], campaignIds: ["120244"] } : null) };
  const resolver = new DashboardScopeResolver(lookup);
  const line = "55555555-5555-4555-8555-555555555555";

  it("la línea pone sus productos y campañas; lo filtrado a mano gana sobre la línea", async () => {
    expect(await resolver.resolve(T, { lineId: line })).toEqual({ productIds: [P1], campaignIds: ["120244"] });
    expect(await resolver.resolve(T, { lineId: line, productIds: [P2] })).toEqual({ productIds: [P2], campaignIds: ["120244"] });
  });

  it("una línea SIN campañas no se lee como «todas»: queda marcada (su gasto no se conoce); elegir campañas a mano lo resuelve", async () => {
    const noCampaigns = new DashboardScopeResolver({ scopeOf: async () => ({ productIds: [P1], connectionIds: [], campaignIds: [] }) });
    expect(await noCampaigns.resolve(T, { lineId: line })).toEqual({ productIds: [P1], withoutCampaigns: true });
    expect(await noCampaigns.resolve(T, { lineId: line, campaignIds: ["120244"] })).toEqual({ productIds: [P1], campaignIds: ["120244"] });
    expect(await noCampaigns.resolve(T, {})).toEqual({});
  });

  it("los filtros de antes (uno solo) siguen sirviendo; ids inválidos y líneas que no existen se ignoran", async () => {
    expect(scopeOf({ connectionId: C1, productId: "no" })).toEqual({ connectionIds: [C1] });
    expect(await resolver.resolve(T, { lineId: "66666666-6666-4666-8666-666666666666", campaignIds: ["12", "*", "con espacio"] })).toEqual({ campaignIds: ["12"] });
  });
});
