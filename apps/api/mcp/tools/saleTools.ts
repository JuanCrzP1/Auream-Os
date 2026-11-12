import { SALE_STATUSES, type SaleFilters, type SaleStatus } from "../../../../contracts/SalesContracts";
import type { SaleActor, SaleServices } from "../../../../domains/sales/application/SaleServices";
import type { SalesInsights } from "../../../../domains/sales/application/SalesInsights";
import type { McpTool, McpToolContext } from "../McpTool";
import { defined, requiredText, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Ventas (área «Ventas y productos»). Ver: `sales.read`. Anotar: `sales.write`.
// Corregir, aprobar o anular: `sales.manage`. Mismo servicio que la pantalla
// Ventas: sin producto, monto o moneda la venta queda «Por revisar» (nunca se
// inventa un precio) y anular exige un motivo. Lo que hace el agente queda a
// nombre de su credencial y en el registro de herramientas.
// ---------------------------------------------------------------------------

type Sales = Pick<SaleServices, "list" | "record" | "update">;
type Insights = Pick<SalesInsights, "overview">;

const DATE = "Fecha `YYYY-MM-DD` en la zona horaria de la empresa.";

/** El agente actúa como su credencial: puede lo que su área le da (la herramienta ya exigió el permiso). */
function actorOf(context: McpToolContext, canManage: boolean): SaleActor {
  return { tenantId: context.tenantId, userId: context.credentialId, canRecord: true, canManage };
}

function filtersOf(args: ToolArgs): SaleFilters {
  const status = textArg(args, "status");
  return defined({
    status: status && (SALE_STATUSES as ReadonlyArray<string>).includes(status) ? (status as SaleStatus) : undefined,
    productId: textArg(args, "product_id"),
    from: textArg(args, "from"),
    to: textArg(args, "to"),
    search: textArg(args, "search"),
    cursor: textArg(args, "cursor")
  });
}

export function saleTools(sales: Sales, insights: Insights): McpTool[] {
  return [
    {
      name: "list_sales",
      title: "Listar ventas",
      description:
        "Ventas de la cuenta, de la más reciente a la más vieja (por páginas: usa `cursor` con el `nextCursor` anterior). Cada una con producto, monto, moneda, país, cliente, origen (comprobante, a mano, webhook), anuncio, flujo y estado. Trae los totales aprobados por moneda y cuántas hay «Por revisar».",
      scope: "sales.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "approved (aprobadas), review (por revisar) o void (anuladas).", enum: SALE_STATUSES },
          product_id: { type: "string", description: "Solo de este producto (de list_products)." },
          from: { type: "string", description: `Desde. ${DATE}` },
          to: { type: "string", description: `Hasta. ${DATE}` },
          search: { type: "string", description: "Nombre o teléfono del cliente, referencia del comprobante o id del anuncio." },
          cursor: { type: "string", description: "Página siguiente (el `nextCursor` de la respuesta anterior)." }
        }
      },
      run: async (args, context) => sales.list(actorOf(context, false), filtersOf(args))
    },
    {
      name: "sales_summary",
      title: "Resumen de ventas",
      description: "Lo vendido en un periodo: totales por moneda, cantidad, ticket promedio, comparación con el periodo anterior, ventas por día y lo que más se vende. Sin fechas: todo el historial.",
      scope: "sales.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: `Desde. ${DATE}` },
          to: { type: "string", description: `Hasta. ${DATE}` },
          product_id: { type: "string", description: "Solo de este producto." }
        }
      },
      run: async (args, { tenantId }) => insights.overview(tenantId, defined({ from: textArg(args, "from"), to: textArg(args, "to"), productId: textArg(args, "product_id") }))
    },
    {
      name: "record_sale",
      title: "Anotar una venta",
      description:
        "Anota una venta a mano (como un asesor en Ventas › Anotar venta). Con producto, monto y moneda queda aprobada y suma en el Dashboard y el ROAS; si falta algo, queda «Por revisar». Confirma los datos con la persona antes de anotarla.",
      scope: "sales.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Producto (de list_products)." },
          amount: { type: "string", description: "Monto, como lo escribe la persona («49.900», «12,5»)." },
          currency: { type: "string", description: "Moneda ISO de 3 letras (COP, VES, USD…)." },
          country: { type: "string", description: "País ISO de 2 letras. Si falta, sale del teléfono del cliente." },
          customer_name: { type: "string", description: "Nombre del cliente." },
          customer_phone: { type: "string", description: "Teléfono del cliente con indicativo." },
          sold_at: { type: "string", description: "Cuándo fue (fecha y hora ISO). Por defecto, ahora." },
          note: { type: "string", description: "Nota interna (opcional)." }
        }
      },
      run: async (args, context) =>
        sales.record(
          actorOf(context, false),
          defined({
            productId: textArg(args, "product_id"),
            amount: textArg(args, "amount"),
            currency: textArg(args, "currency"),
            country: textArg(args, "country"),
            customerName: textArg(args, "customer_name"),
            customerPhone: textArg(args, "customer_phone"),
            soldAt: textArg(args, "sold_at"),
            note: textArg(args, "note") ?? `Anotada por el agente «${context.credentialName}».`
          })
        )
    },
    {
      name: "update_sale",
      title: "Corregir, aprobar o anular una venta",
      description:
        "Completa una venta «Por revisar» (producto, monto, moneda, país), la aprueba (`status: approved`, solo si está completa) o la anula (`status: void`, con `void_reason`: devolución, pago falso, duplicada…). Anular la saca de los totales. Confirma con la persona antes de aprobar o anular.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          sale_id: { type: "string", description: "Id de la venta (de list_sales)." },
          product_id: { type: "string", description: "Producto (de list_products)." },
          amount: { type: "string", description: "Monto." },
          currency: { type: "string", description: "Moneda ISO de 3 letras." },
          country: { type: "string", description: "País ISO de 2 letras." },
          customer_name: { type: "string", description: "Nombre del cliente." },
          note: { type: "string", description: "Nota interna." },
          status: { type: "string", description: "approved, review o void.", enum: SALE_STATUSES },
          void_reason: { type: "string", description: "Obligatorio al anular: por qué." }
        },
        required: ["sale_id"]
      },
      run: async (args, context) =>
        sales.update(
          actorOf(context, true),
          requiredText(args, "sale_id"),
          defined({
            productId: textArg(args, "product_id"),
            amount: textArg(args, "amount"),
            currency: textArg(args, "currency"),
            country: textArg(args, "country"),
            customerName: textArg(args, "customer_name"),
            note: textArg(args, "note"),
            status: textArg(args, "status") as SaleStatus | undefined,
            voidReason: textArg(args, "void_reason")
          })
        )
    }
  ];
}
