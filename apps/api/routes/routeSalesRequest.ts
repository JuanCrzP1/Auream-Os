import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { RecordSaleRequest, SaleFilters, SaleSource, SaleStatus, SaveProductRequest, UpdateSaleRequest } from "../../../contracts/SalesContracts";
import type { ProductServices } from "../../../domains/products/application/ProductServices";
import type { SaleServices } from "../../../domains/sales/application/SaleServices";
import type { SalesInsights } from "../../../domains/sales/application/SalesInsights";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Ventas y Productos de la cuenta activa.
//
//   GET    /products          el catálogo                         (sales.read)
//   POST   /products          crear un producto                   (sales.manage)
//   PATCH  /products/:id      editar o archivar                   (sales.manage)
//   GET    /sales             ventas con filtros, totales y página (sales.read)
//   GET    /sales/insights    portada: tendencia, curva, lo que más vende (sales.read)
//   GET    /sales/product-stats  ventas de cada producto por semana  (sales.read)
//   POST   /sales             anotar una venta a mano             (sales.write; desde un chat, también conversations.read)
//   PATCH  /sales/:id         corregir, aprobar o anular          (sales.manage)
//
// Las ventas de los flujos entran por el bloque Registrar venta, no por aquí.
// La cuenta y quien actúa salen SIEMPRE del contexto verificado.
// ---------------------------------------------------------------------------

export interface SalesRoutes {
  readonly products: ProductServices;
  readonly sales: SaleServices;
  readonly insights: SalesInsights;
}

const PRODUCT = /^\/products\/([0-9a-f-]{36})$/i;
const SALE = /^\/sales\/([0-9a-f-]{36})$/i;

function filtersOf(url: URL): SaleFilters {
  const get = (key: string) => url.searchParams.get(key) ?? undefined;
  return {
    status: get("status") as SaleStatus | undefined,
    productId: get("productId"),
    currency: get("currency"),
    source: get("source") as SaleSource | undefined,
    from: get("from"),
    to: get("to"),
    search: get("search"),
    cursor: get("cursor")
  };
}

export async function routeSalesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  module: SalesRoutes | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  const isProducts = path === "/products" || path.startsWith("/products/");
  const isSales = path === "/sales" || path.startsWith("/sales/");
  if (!isProducts && !isSales) return false;
  const method = request.method ?? "GET";
  if (!module) {
    sendJson(response, 503, { message: "Ventas no está disponible en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const can = (scope: Scope) => context.scopes.includes(scope);
  const actor = { tenantId, userId: context.actorId, canRecord: can(SalesPermissions.write), canManage: can(SalesPermissions.manage) };

  if (path === "/products" && method === "GET") {
    requireScope(context, SalesPermissions.read, tenantId);
    sendJson(response, 200, await module.products.list(tenantId, actor.canManage, actor.canRecord));
    return true;
  }
  if (path === "/sales" && method === "GET") {
    requireScope(context, SalesPermissions.read, tenantId);
    sendJson(response, 200, await module.sales.list(actor, filtersOf(url)));
    return true;
  }
  if (path === "/sales/insights" && method === "GET") {
    requireScope(context, SalesPermissions.read, tenantId);
    const { from, to, productId } = filtersOf(url);
    sendJson(response, 200, await module.insights.overview(tenantId, { from, to, productId }));
    return true;
  }
  if (path === "/sales/product-stats" && method === "GET") {
    requireScope(context, SalesPermissions.read, tenantId);
    sendJson(response, 200, await module.insights.productStats(tenantId));
    return true;
  }
  if (path === "/sales" && method === "POST") {
    requireScope(context, SalesPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<RecordSaleRequest>>(request);
    // Desde un chat se leen su cliente y su anuncio: hace falta poder ver los chats.
    if (body.conversationId !== undefined) requireScope(context, ConversationPermissions.read, tenantId);
    sendJson(response, 201, await module.sales.record(actor, body));
    return true;
  }

  requireScope(context, SalesPermissions.manage, tenantId);

  if (path === "/products" && method === "POST") {
    sendJson(response, 201, await module.products.create(tenantId, await parseJsonBody<Partial<SaveProductRequest>>(request)));
    return true;
  }
  const product = PRODUCT.exec(path);
  if (product && method === "PATCH") {
    sendJson(response, 200, await module.products.update(tenantId, product[1]!, await parseJsonBody<Partial<SaveProductRequest>>(request)));
    return true;
  }
  const sale = SALE.exec(path);
  if (sale && method === "PATCH") {
    sendJson(response, 200, await module.sales.update(actor, sale[1]!, await parseJsonBody<Partial<UpdateSaleRequest>>(request)));
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
