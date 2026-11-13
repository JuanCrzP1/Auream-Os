import "./custom-field-rule.css";
import { joinRuleValues, operatorNeedsValue, operatorsForFieldType, ruleValues, type ConditionRule } from "@contracts/ConditionConfig";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { foldAnswer } from "@contracts/FieldValues";
import { FieldPicker, findField } from "../_kit/FieldPicker";
import { InlineInput, InlineSelect } from "../_kit/fields";
import type { ToolResources } from "../ToolResources";
import { operatorsFor } from "./conditionConfig";

// ---------------------------------------------------------------------------
// Una regla sobre un Campo del cliente: se elige el campo y la regla ofrece
// lo de su tipo. Lista: las opciones como botones («es una de»). Sí o no: Sí
// / No. Número: «está entre». Fecha: «es hoy», «en los próximos N días»…
// Un dato que no es campo (sin tipo) se compara como texto, igual que siempre.
// ---------------------------------------------------------------------------

/** Qué forma tiene el valor de un operador: si cambia, el valor viejo no sirve. */
export const shapeOf = (operator: string) =>
  operator === "is_one_of" || operator === "is_none_of" ? "options" : operator === "between" ? "range" : operator.endsWith("_days") || operator === "at_least_days_ago" ? "days" : operator.endsWith("_date") ? "date" : "text";

/** El valor de una regla con tipo (campo del cliente o dato del negocio): opciones, rango, días, fecha o Sí / No. */
export function TypedValue({ rule, field, label, onChange }: { rule: ConditionRule; field: Pick<ContactFieldSummary, "type" | "options"> | undefined; label: string; onChange: (value: string) => void }) {
  if (!operatorNeedsValue(rule)) return null;
  const values = ruleValues(rule);
  const shape = shapeOf(rule.operator);

  if (shape === "options" && field?.type === "list") {
    const chosen = new Set(values.map(foldAnswer));
    const toggle = (option: string) =>
      onChange(joinRuleValues(chosen.has(foldAnswer(option)) ? values.filter((value) => foldAnswer(value) !== foldAnswer(option)) : [...values, option]));
    return (
      <div className="cfr-options" role="group" aria-label={label}>
        {field.options.map((option) => (
          <button key={option} type="button" className="cfr-option nodrag" aria-pressed={chosen.has(foldAnswer(option))} onClick={() => toggle(option)}>
            {option}
          </button>
        ))}
      </div>
    );
  }
  if (shape === "range") {
    const [from = "", to = ""] = rule.value.split("\n");
    const set = (next: [string, string]) => onChange(next.join("\n"));
    return (
      <span className="cfr-range">
        <input className="kit-input nodrag" inputMode="decimal" value={from} placeholder="500.000" aria-label={`${label}: desde`} onChange={(event) => set([event.target.value, to])} />
        <span>y</span>
        <input className="kit-input nodrag" inputMode="decimal" value={to} placeholder="2.000.000" aria-label={`${label}: hasta`} onChange={(event) => set([from, event.target.value])} />
      </span>
    );
  }
  if (shape === "days") {
    return (
      <span className="cfr-range">
        <input className="kit-input nodrag" inputMode="numeric" value={rule.value} placeholder="3" aria-label={label} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} />
        <span>{rule.operator === "at_least_days_ago" ? "días o más" : "días"}</span>
      </span>
    );
  }
  if (shape === "date" || (field?.type === "date" && rule.operator === "equal")) {
    return <input type="date" className="kit-input nodrag" value={rule.value} aria-label={label} onChange={(event) => onChange(event.target.value)} />;
  }
  if (field?.type === "boolean") {
    return (
      <span className="cfr-segment" role="group" aria-label={label}>
        {["Sí", "No"].map((answer) => (
          <button key={answer} type="button" className="nodrag" aria-pressed={foldAnswer(rule.value) === foldAnswer(answer)} onClick={() => onChange(answer)}>
            {answer}
          </button>
        ))}
      </span>
    );
  }
  return <InlineInput value={rule.value} ariaLabel={label} placeholder="Valor o {variable}" onChange={onChange} />;
}

export function CustomFieldRule({
  rule,
  index,
  resources,
  onPatch
}: {
  readonly rule: ConditionRule;
  readonly index: number;
  readonly resources: ToolResources | undefined;
  readonly onPatch: (patch: Partial<ConditionRule>) => void;
}) {
  const field = findField(resources?.contactFields, rule.field);
  const offered = operatorsFor("customField", field?.type);
  // Una regla guardada con un operador que este tipo ya no ofrece se sigue viendo (y se puede cambiar).
  const operators = offered.some((option) => option.value === rule.operator) ? offered : [...offered, { value: rule.operator, label: rule.operator }];

  // Otro campo del mismo tipo conserva la regla; si cambia el tipo, arranca con lo natural de ese tipo.
  const setField = (key: string) => {
    const nextType = findField(resources?.contactFields, key)?.type;
    const allowed = operatorsForFieldType(nextType);
    const keep = nextType === field?.type && allowed.includes(rule.operator);
    onPatch(keep ? { field: key } : { field: key, operator: allowed[0]!, value: "" });
  };

  return (
    <div className="cfr">
      <FieldPicker
        label="Campo"
        value={rule.field}
        contactFields={resources?.contactFields}
        {...(resources?.createContactField ? { createField: resources.createContactField } : {})}
        onChange={setField}
      />
      <div className="kit-row">
        <InlineSelect
          value={rule.operator}
          options={operators}
          ariaLabel={`Operador de la regla ${index + 1}`}
          onChange={(operator) => onPatch(shapeOf(operator) === shapeOf(rule.operator) ? { operator } : { operator, value: "" })}
        />
        <TypedValue rule={rule} field={field} label={`Valor de la regla ${index + 1}`} onChange={(value) => onPatch({ value })} />
      </div>
    </div>
  );
}
