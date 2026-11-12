import { SALES_LINE_COLORS } from "../../../../contracts/SalesLineContracts";
import type { SalesLineServices } from "../../../../domains/sales-lines/application/SalesLineServices";
import type { McpInputSchema, McpTool } from "../McpTool";
import { defined, requiredText, stringListArg, textArg } from "./toolArgs";

// ---------------------------------------------------------------------------
// Líneas de venta (partes del negocio que el Dashboard mide aparte). Verlas:
// área «Dashboard y anuncios» (`analytics.read`); crearlas, editarlas y
// borrarlas: «Ventas y productos: ver y editar» (`sales.manage`). Mismo
// servicio que el Dashboard. Usa el `id` en `line_id` de dashboard_sales.
// ---------------------------------------------------------------------------

type Lines = Pick<SalesLineServices, "list" | "create" | "update" | "remove">;

const fields: McpInputSchema["properties"] = {
  name: { type: "string", description: "Nombre (hasta 40, único en la cuenta): «Venezuela», «Dilo cantando Colombia»." },
  color: { type: "string", description: `Color: ${SALES_LINE_COLORS.join(", ")}.`, enum: SALES_LINE_COLORS },
  product_ids: { type: "array", items: { type: "string" }, description: "Productos de la línea (ids de list_products): sus ventas cuentan en la línea." },
  connection_ids: { type: "array", items: { type: "string" }, description: "Números de la línea (ids de list_connections). Vacío = todos." },
  campaign_ids: { type: "array", items: { type: "string" }, description: "Campañas de Meta que la promocionan (ids de dashboard_ads): su gasto es el de la línea." }
};

const input = (args: Readonly<Record<string, unknown>>) =>
  defined({
    name: textArg(args, "name"),
    color: textArg(args, "color"),
    productIds: stringListArg(args, "product_ids"),
    connectionIds: stringListArg(args, "connection_ids"),
    campaignIds: stringListArg(args, "campaign_ids")
  });

export function salesLineTools(lines: Lines): McpTool[] {
  return [
    {
      name: "list_sales_lines",
      title: "Listar líneas de venta",
      description: "Las líneas de venta de la cuenta: id, nombre, color y lo que junta (productos, números y campañas). Para ver cómo va una, usa dashboard_sales con su `line_id`.",
      scope: "analytics.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => lines.list(tenantId, false)
    },
    {
      name: "create_sales_line",
      title: "Crear una línea de venta",
      description: "Crea una línea para medir aparte una parte del negocio. Necesita al menos un producto o una campaña. Confirma el nombre y lo que junta con la persona.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: fields, required: ["name"] },
      run: async (args, { tenantId }) => lines.create(tenantId, input(args))
    },
    {
      name: "update_sales_line",
      title: "Editar una línea de venta",
      description: "Cambia el nombre, el color o lo que junta una línea. Lo que no mandes queda como está; una lista que mandes reemplaza la anterior.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { line_id: { type: "string", description: "Id de la línea (de list_sales_lines)." }, ...fields }, required: ["line_id"] },
      run: async (args, { tenantId }) => lines.update(tenantId, requiredText(args, "line_id"), input(args))
    },
    {
      name: "delete_sales_line",
      title: "Borrar una línea de venta",
      description: "Borra una línea. No toca ventas, productos ni campañas: solo deja de existir esa forma de mirarlas. Confírmalo con la persona.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { line_id: { type: "string", description: "Id de la línea (de list_sales_lines)." } }, required: ["line_id"] },
      run: async (args, { tenantId }) => {
        await lines.remove(tenantId, requiredText(args, "line_id"));
        return { removed: true };
      }
    }
  ];
}
