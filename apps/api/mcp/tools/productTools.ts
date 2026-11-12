import type { ProductPriceInput, SaveProductRequest } from "../../../../contracts/SalesContracts";
import { PRODUCT_KINDS } from "../../../../contracts/SalesContracts";
import type { ProductServices } from "../../../../domains/products/application/ProductServices";
import type { McpTool } from "../McpTool";
import { defined, requiredText, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// El catálogo de productos (área «Ventas y productos»): verlo con `sales.read`;
// crear, editar y archivar con `sales.manage`. Mismo servicio y mismas reglas
// que Ventas › Productos: nombre único, precio en al menos un país, un
// producto con ventas no se borra (se archiva).
// ---------------------------------------------------------------------------

type Catalog = Pick<ProductServices, "list" | "find" | "create" | "update">;

const PRICES_HELP =
  "Precios por país: lista de objetos { country (ISO de 2 letras: CO, VE, MX…), amount (número), currency (opcional: ISO de 3 letras; por defecto la del país, p. ej. USD en Venezuela), cost (opcional: lo que te cuesta) }. Al menos un país. NUNCA inventes un precio: pídeselo a la persona.";

/** Los precios tal como los manda el agente (el servicio los valida). */
function pricesArg(args: ToolArgs): ProductPriceInput[] | undefined {
  const raw = args["prices"];
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      country: String(item["country"] ?? ""),
      amount: typeof item["amount"] === "number" || typeof item["amount"] === "string" ? item["amount"] : "",
      ...(typeof item["currency"] === "string" ? { currency: item["currency"] } : {}),
      ...(item["cost"] !== undefined ? { cost: item["cost"] as number | string | null } : {})
    }));
}

export function productTools(catalog: Catalog): McpTool[] {
  return [
    {
      name: "list_products",
      title: "Listar productos",
      description: "El catálogo: cada producto con su id, tipo (principal, upsell, downsell), estado (activo o archivado), precios por país y cuántas ventas tiene. Úsalo para elegir el producto de Registrar venta o de una venta.",
      scope: "sales.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => {
        const { products } = await catalog.list(tenantId, false);
        return { products };
      }
    },
    {
      name: "create_product",
      title: "Crear un producto",
      description: "Crea un producto activo en Ventas › Productos. Confirma el nombre y los precios con la persona antes de crearlo.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre (hasta 80 caracteres, único en la cuenta)." },
          description: { type: "string", description: "Descripción corta (opcional, hasta 500)." },
          kind: { type: "string", description: "main (principal), upsell o downsell. Por defecto main.", enum: PRODUCT_KINDS },
          prices: { type: "array", description: PRICES_HELP }
        },
        required: ["name", "prices"]
      },
      run: async (args, { tenantId }) =>
        catalog.create(tenantId, {
          name: requiredText(args, "name"),
          description: textArg(args, "description") ?? "",
          kind: (textArg(args, "kind") as SaveProductRequest["kind"] | undefined) ?? "main",
          prices: pricesArg(args) ?? []
        })
    },
    {
      name: "update_product",
      title: "Editar un producto",
      description:
        "Cambia el nombre, la descripción, el tipo o los precios de un producto, o lo archiva (`status: archived`) o reactiva (`active`). Lo que no mandes queda como está. Si mandas `prices`, reemplaza TODA la lista de precios.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Id del producto (de list_products)." },
          name: { type: "string", description: "Nombre nuevo." },
          description: { type: "string", description: "Descripción nueva." },
          kind: { type: "string", description: "main, upsell o downsell.", enum: PRODUCT_KINDS },
          status: { type: "string", description: "active o archived (archivar no borra sus ventas).", enum: ["active", "archived"] },
          prices: { type: "array", description: PRICES_HELP }
        },
        required: ["product_id"]
      },
      run: async (args, { tenantId }) => {
        const productId = requiredText(args, "product_id");
        const current = await catalog.find(tenantId, productId);
        const changes = defined({
          name: textArg(args, "name"),
          description: typeof args["description"] === "string" ? args["description"] : undefined,
          kind: textArg(args, "kind") as SaveProductRequest["kind"] | undefined,
          status: textArg(args, "status") as SaveProductRequest["status"] | undefined,
          prices: pricesArg(args)
        });
        return catalog.update(tenantId, productId, {
          name: current.name,
          description: current.description,
          kind: current.kind,
          status: current.status,
          prices: current.prices.map((price) => ({ country: price.country, currency: price.currency, amount: price.amount, cost: price.cost ?? null })),
          ...changes
        });
      }
    }
  ];
}
