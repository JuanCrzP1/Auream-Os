import { describe, expect, it, vi } from "vitest";
import { McpProtocol } from "../../apps/api/mcp/McpProtocol.js";
import type { McpTool, McpToolContext } from "../../apps/api/mcp/McpTool.js";
import { productTools } from "../../apps/api/mcp/tools/productTools.js";
import { saleTools } from "../../apps/api/mcp/tools/saleTools.js";
import { triggerTools } from "../../apps/api/mcp/tools/triggerTools.js";
import { crmTools } from "../../apps/api/mcp/tools/crmTools.js";
import { analyticsTools } from "../../apps/api/mcp/tools/analyticsTools.js";
import { requirePermissions, scopesOf } from "../../domains/mcp/domain/McpCredential.js";

// ---------------------------------------------------------------------------
// El MCP para toda la plataforma: productos, ventas, disparadores, CRM y
// Dashboard. Cada herramienta es un adaptador fino sobre el MISMO servicio de
// la pantalla: aquí se prueba que lo llame con lo que pidió el agente, a
// nombre de su credencial, sin pisar lo que no se pidió cambiar, y que solo
// aparezca con el permiso de su área.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const ctx: McpToolContext = { tenantId: T, credentialId: "22222222-2222-4222-8222-222222222222", credentialName: "Claude de ventas" };
const find = (tools: McpTool[], name: string) => tools.find((tool) => tool.name === name)!;
const PRODUCT = { id: "p1", name: "Mega Pack", description: "16 libros", kind: "main" as const, status: "active" as const, prices: [{ country: "VE", currency: "VES", amount: 450, cost: null }] };

function services() {
  const catalog = { list: vi.fn(async () => ({ products: [], canManage: false })), find: vi.fn(async () => ({ ...PRODUCT, tenantId: T, createdAt: "", updatedAt: "" })), create: vi.fn(async () => ({}) as never), update: vi.fn(async () => ({}) as never) };
  const sales = { list: vi.fn(async () => ({}) as never), record: vi.fn(async () => ({}) as never), update: vi.fn(async () => ({}) as never) };
  const insights = { overview: vi.fn(async () => ({}) as never) };
  const triggers = { list: vi.fn(async () => []), create: vi.fn(async () => ({}) as never), update: vi.fn(async () => ({}) as never), remove: vi.fn(async () => undefined) };
  const crm = {
    pipelines: { list: vi.fn(async () => ({}) as never) },
    board: { view: vi.fn(async () => ({}) as never), stageCards: vi.fn(async () => ({}) as never), move: vi.fn(async () => undefined) },
    deals: { update: vi.fn(async () => ({}) as never), contact: vi.fn(async () => ({}) as never) }
  };
  const dashboard = { sales: { overview: vi.fn(async () => ({}) as never) }, ads: { performance: vi.fn(async () => ({}) as never) }, attention: { overview: vi.fn(async () => ({}) as never) } };
  const tools = [...productTools(catalog), ...saleTools(sales, insights), ...triggerTools(triggers), ...crmTools(crm), ...analyticsTools(dashboard)];
  return { catalog, sales, insights, triggers, crm, dashboard, tools };
}

describe("productos", () => {
  it("editar cambia solo lo pedido: un nombre nuevo conserva descripción, tipo, estado y precios", async () => {
    const s = services();
    await find(s.tools, "update_product").run({ product_id: "p1", name: "Mega Pack Reconstruye tu vida" }, ctx);
    expect(s.catalog.update).toHaveBeenCalledWith(T, "p1", { name: "Mega Pack Reconstruye tu vida", description: "16 libros", kind: "main", status: "active", prices: PRODUCT.prices });
  });

  it("crear pasa los precios por país tal cual (el servicio los valida; nunca se inventan)", async () => {
    const s = services();
    await find(s.tools, "create_product").run({ name: "Mega Pack", prices: [{ country: "VE", amount: "450", currency: "VES" }] }, ctx);
    expect(s.catalog.create).toHaveBeenCalledWith(T, { name: "Mega Pack", description: "", kind: "main", prices: [{ country: "VE", amount: "450", currency: "VES" }] });
  });
});

describe("ventas", () => {
  it("anotar una venta queda a nombre de la credencial, con nota que lo dice", async () => {
    const s = services();
    await find(s.tools, "record_sale").run({ product_id: "p1", amount: "450", currency: "VES", customer_phone: "584121112233" }, ctx);
    expect(s.sales.record).toHaveBeenCalledWith(
      { tenantId: T, userId: ctx.credentialId, canRecord: true, canManage: false },
      { productId: "p1", amount: "450", currency: "VES", customerPhone: "584121112233", note: "Anotada por el agente «Claude de ventas»." }
    );
  });

  it("anular pasa el motivo; el servicio exige uno", async () => {
    const s = services();
    await find(s.tools, "update_sale").run({ sale_id: "s1", status: "void", void_reason: "Pago falso" }, ctx);
    expect(s.sales.update).toHaveBeenCalledWith(expect.objectContaining({ canManage: true }), "s1", { status: "void", voidReason: "Pago falso" });
  });
});

describe("disparadores, CRM y Dashboard", () => {
  it("crear un disparador: el flujo va como automationId; editar manda solo lo pedido", async () => {
    const s = services();
    await find(s.tools, "create_trigger").run({ connection_id: "c1", type: "keyword", keywords: ["Hola"], flow_id: "f1" }, ctx);
    expect(s.triggers.create).toHaveBeenCalledWith(T, "c1", { type: "keyword", keywords: ["Hola"], automationId: "f1" });
    await find(s.tools, "update_trigger").run({ connection_id: "c1", trigger_id: "t1", enabled: false }, ctx);
    expect(s.triggers.update).toHaveBeenCalledWith(T, "c1", "t1", { enabled: false });
  });

  it("mover de etapa actúa como la credencial (puede escribir, no configurar embudos)", async () => {
    const s = services();
    await find(s.tools, "move_contact_stage").run({ pipeline_id: "p", contact_id: "k", stage_id: "e" }, ctx);
    expect(s.crm.board.move).toHaveBeenCalledWith({ tenantId: T, userId: ctx.credentialId, canWrite: true, canManage: false }, "p", "k", { stageId: "e" });
  });

  it("el Dashboard de ventas incluye el gasto (el área da `ads.read`) y respeta el periodo", async () => {
    const s = services();
    await find(s.tools, "dashboard_sales").run({ from: "2026-11-01", to: "2026-11-12" }, ctx);
    expect(s.dashboard.sales.overview).toHaveBeenCalledWith({ tenantId: T, canSeeAds: true }, { from: "2026-11-01", to: "2026-11-12" });
  });
});

describe("cada herramienta, solo con el permiso de su área", () => {
  const listed = async (permissions: Parameters<typeof requirePermissions>[0]) => {
    const access = { tenantId: T, credentialId: "c", credentialName: "x", scopes: scopesOf(requirePermissions(permissions)) };
    const result = (await new McpProtocol(services().tools, { name: "auream", version: "1" }).handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, access))?.result as { tools: Array<{ name: string }> };
    return result.tools.map((tool) => tool.name).sort();
  };

  it("ver ventas no deja anotar ni editar; editar ventas sí; Dashboard solo lee", async () => {
    expect(await listed({ sales: "read" })).toEqual(["list_products", "list_sales", "sales_summary"]);
    expect(await listed({ sales: "write" })).toEqual(["create_product", "list_products", "list_sales", "record_sale", "sales_summary", "update_product", "update_sale"]);
    expect(await listed({ analytics: "read" })).toEqual(["dashboard_ads", "dashboard_attention", "dashboard_sales"]);
    expect(await listed({ connections: "read" })).toEqual(["list_triggers"]);
    expect(await listed({ crm: "read" })).toEqual(["get_contact_crm", "get_pipeline_board", "list_pipelines"]);
  });
});
