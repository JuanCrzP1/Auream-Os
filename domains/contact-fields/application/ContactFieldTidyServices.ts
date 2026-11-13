import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { FieldOperationResponse, FieldSalesResponse, FieldValuesResponse } from "../../../contracts/ContactFieldToolsContracts";
import { fieldValueText } from "../../../contracts/FieldValues";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { operationSummary } from "../domain/fieldSuggestions";
import { proposeTidy, requireTidy } from "../domain/fieldTidy";
import type { ContactFieldRepository } from "./ContactFieldPorts";
import type { FieldInsights, FieldOperations } from "./ContactFieldToolPorts";

// ---------------------------------------------------------------------------
// «Ordenar valores» y «lo que vende cada valor» de UN campo. Ordenar muestra
// los valores escritos con la propuesta de cómo agruparlos; aplicar cambia
// solo lo que la persona confirmó, deja el campo como lista y se puede
// deshacer. Lo que vende: las ventas aprobadas por valor, sin mezclar monedas.
// ---------------------------------------------------------------------------

/** Cuántos valores distintos se muestran para ordenar (los menos usados quedan como están). */
const MAX_VALUES = 200;
const TOP_SELLERS = 6;
const SALES_DAYS = [7, 30, 90];

export class ContactFieldTidyServices {
  public constructor(
    private readonly repository: Pick<ContactFieldRepository, "find">,
    private readonly insights: Pick<FieldInsights, "values" | "salesByValue">,
    private readonly operations: Pick<FieldOperations, "tidy">,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async values(tenantId: string, fieldId: string): Promise<FieldValuesResponse> {
    const field = await this.tidyable(tenantId, fieldId);
    const seen = await this.insights.values(tenantId, field.key, MAX_VALUES);
    return {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options,
      filled: seen.filled,
      distinct: seen.distinct,
      groups: proposeTidy(seen.top, field.type === "list" ? field.options : [], seen.filled),
      truncated: seen.distinct > seen.top.length
    };
  }

  public async tidy(tenantId: string, fieldId: string, input: unknown, actorId: string): Promise<FieldOperationResponse> {
    const field = await this.tidyable(tenantId, fieldId);
    const plan = requireTidy(field.type === "list" ? field.options : [], input);
    const operationId = this.newId();
    const title = `Ordenaste «${field.label}»`;
    const contacts = await this.operations.tidy(tenantId, {
      operationId,
      title,
      actorId,
      previous: field,
      next: { key: field.key, label: field.label, type: "list", options: plan.options },
      map: plan.map
    });
    return {
      operation: operationSummary({ id: operationId, kind: "tidy", title, contacts, keys: [field.key], definitions: { restore: [], remove: [] }, flows: [], createdAt: this.now().toISOString(), undoneAt: null }),
      flowsSkipped: []
    };
  }

  /** Lo que vendieron los clientes de cada valor en los últimos días (ventas aprobadas). */
  public async sales(tenantId: string, fieldId: string, days: unknown): Promise<FieldSalesResponse> {
    const field = await this.find(tenantId, fieldId);
    const window = SALES_DAYS.includes(Number(days)) ? Number(days) : 30;
    const rows = await this.insights.salesByValue(tenantId, field.key, new Date(this.now().getTime() - window * 86_400_000));
    const show = (value: string) => (field.type === "boolean" ? fieldValueText(value === "true") : fieldValueText(value));
    const byCurrency = new Map<string, typeof rows[number][]>();
    for (const row of rows) byCurrency.set(row.currency, [...(byCurrency.get(row.currency) ?? []), row]);
    const round = (amount: number) => Math.round(amount * 100) / 100;
    const currencies = [...byCurrency.entries()].map(([currency, entries]) => {
      const withValue = entries.filter((entry) => entry.value !== null).sort((a, b) => b.amount - a.amount);
      const rest = withValue.slice(TOP_SELLERS);
      const sum = (list: typeof entries, pick: (entry: typeof entries[number]) => number) => list.reduce((total, entry) => total + pick(entry), 0);
      const values = withValue.slice(0, TOP_SELLERS).map((entry) => ({ value: show(entry.value!) as string | null, amount: round(entry.amount), sales: entry.sales, clients: entry.clients }));
      if (rest.length > 0) values.push({ value: `Otros ${rest.length}`, amount: round(sum(rest, (entry) => entry.amount)), sales: sum(rest, (entry) => entry.sales), clients: sum(rest, (entry) => entry.clients) });
      const empty = entries.filter((entry) => entry.value === null);
      if (empty.length > 0) values.push({ value: null, amount: round(sum(empty, (entry) => entry.amount)), sales: sum(empty, (entry) => entry.sales), clients: sum(empty, (entry) => entry.clients) });
      return { currency, total: round(sum(entries, (entry) => entry.amount)), sales: sum(entries, (entry) => entry.sales), values };
    });
    return { days: window, currencies: currencies.sort((a, b) => b.sales - a.sales).map(({ sales: _sales, ...currency }) => currency) };
  }

  private async find(tenantId: string, fieldId: string): Promise<ContactFieldDefinition> {
    const field = await this.repository.find(tenantId, fieldId);
    if (!field) throw new NotFoundError("Ese campo ya no existe.");
    return field;
  }

  private async tidyable(tenantId: string, fieldId: string): Promise<ContactFieldDefinition> {
    const field = await this.find(tenantId, fieldId);
    if (field.type !== "text" && field.type !== "list") throw new ValidationError("Solo se ordenan los campos de texto o de lista.");
    return field;
  }
}
