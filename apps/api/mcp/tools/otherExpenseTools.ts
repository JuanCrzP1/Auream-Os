import { EXPENSE_FREQUENCIES, EXPENSE_KINDS } from "../../../../contracts/OtherExpenseContracts";
import type { OtherExpenseServices } from "../../../../domains/expenses/application/OtherExpenseServices";
import type { McpInputSchema, McpTool } from "../McpTool";
import { defined, requiredText, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Otros gastos (lo que se paga fuera de Meta y se resta de la ganancia del
// Dashboard). Verlos: área «Dashboard y anuncios» (`ads.read`: con la
// ganancia se deducirían); crearlos, editarlos y borrarlos: «Ventas y
// productos: ver y editar» (`sales.manage`). Mismo servicio que la pantalla.
// ---------------------------------------------------------------------------

type Expenses = Pick<OtherExpenseServices, "list" | "create" | "update" | "remove">;

const fields: McpInputSchema["properties"] = {
  name: { type: "string", description: "Nombre (hasta 60): «Comisión de la pasarela», «Nómina», «Canva»." },
  kind: { type: "string", enum: EXPENSE_KINDS, description: "fixed = un monto que se repite · percent = un % de lo vendido." },
  amount: { type: "string", description: "El monto (fixed, p. ej. «1.200.000») o el porcentaje de 0 a 100 (percent, p. ej. «3,5»). Nunca lo inventes: pídelo." },
  currency: { type: "string", description: "Solo fixed: código ISO de la moneda (COP, USD, VES…)." },
  frequency: { type: "string", enum: EXPENSE_FREQUENCIES, description: "Solo fixed: once (una vez), daily, weekly (cada 7 días desde starts_on) o monthly (el día del mes de starts_on)." },
  starts_on: { type: "string", description: "Desde cuándo, YYYY-MM-DD (y el día en que se cobra)." },
  ends_on: { type: "string", description: "Hasta cuándo, YYYY-MM-DD (opcional; vacío = sin fin)." },
  line_id: { type: "string", description: "Línea de venta (de list_sales_lines). Vacío = todo el negocio." }
};

/** Un texto vacío borra el valor (p. ej. `ends_on: ""` quita la fecha final). */
const nullable = (args: ToolArgs, key: string) => (key in args ? textArg(args, key) || null : undefined);

const input = (args: ToolArgs) =>
  defined({
    name: textArg(args, "name"),
    kind: textArg(args, "kind") as (typeof EXPENSE_KINDS)[number] | undefined,
    amount: textArg(args, "amount") ?? (typeof args.amount === "number" ? args.amount : undefined),
    currency: nullable(args, "currency"),
    frequency: nullable(args, "frequency") as (typeof EXPENSE_FREQUENCIES)[number] | null | undefined,
    startsOn: textArg(args, "starts_on"),
    endsOn: nullable(args, "ends_on"),
    lineId: nullable(args, "line_id")
  });

const expenseId = { expense_id: { type: "string", description: "Id del gasto (de list_other_expenses)." } } as const;

export function otherExpenseTools(expenses: Expenses): McpTool[] {
  return [
    {
      name: "list_other_expenses",
      title: "Listar otros gastos",
      description: "Los gastos fuera de Meta de la cuenta (fijos o % de las ventas, de todo el negocio o de una línea). Cuánto costaron en un periodo lo dice dashboard_sales (`otherSpend`, `otherExpenses`).",
      scope: "ads.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => expenses.list(tenantId, false)
    },
    {
      name: "create_other_expense",
      title: "Crear un gasto",
      description: "Anota un gasto fuera de Meta para que la ganancia del Dashboard sea la real. Confirma con la persona el monto, la moneda, cada cuánto y desde cuándo.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: fields, required: ["name", "kind", "amount", "starts_on"] },
      run: async (args, { tenantId }) => expenses.create(tenantId, input(args))
    },
    {
      name: "update_other_expense",
      title: "Editar un gasto",
      description: "Cambia un gasto. Lo que no mandes queda como está.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { ...expenseId, ...fields }, required: ["expense_id"] },
      run: async (args, { tenantId }) => expenses.update(tenantId, requiredText(args, "expense_id"), input(args))
    },
    {
      name: "delete_other_expense",
      title: "Borrar un gasto",
      description: "Borra un gasto: deja de restarse de la ganancia (también en periodos pasados). No toca ventas ni anuncios. Confírmalo con la persona.",
      scope: "sales.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: expenseId, required: ["expense_id"] },
      run: async (args, { tenantId }) => {
        await expenses.remove(tenantId, requiredText(args, "expense_id"));
        return { removed: true };
      }
    }
  ];
}
