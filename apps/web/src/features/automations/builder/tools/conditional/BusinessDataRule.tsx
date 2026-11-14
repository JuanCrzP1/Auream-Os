import { operatorsForFieldType, type ConditionRule } from "@contracts/ConditionConfig";
import { businessValueText } from "@contracts/BusinessDataContracts";
import { InlineSelect } from "../_kit/fields";
import type { ToolResources } from "../ToolResources";
import { operatorsFor } from "./conditionConfig";
import { shapeOf, TypedValue } from "./CustomFieldRule";

// ---------------------------------------------------------------------------
// Una regla sobre un Dato del negocio: se elige de la
// lista de Configuración › Campos y datos › Datos del negocio y se compara con su tipo, igual
// que un campo del cliente (Sí / No, número entre, fecha…). Un flujo traído de
// Leona que nombra uno que aún no existe lo sigue mostrando, para crearlo.
// ---------------------------------------------------------------------------

export function BusinessDataRule({
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
  const data = resources?.businessData ?? [];
  const datum = data.find((item) => item.key === rule.field);
  const field = datum ? { type: datum.type, options: [] } : undefined;
  const offered = operatorsFor("globalVariable", datum?.type);
  const operators = offered.some((option) => option.value === rule.operator) ? offered : [...offered, { value: rule.operator, label: rule.operator }];
  const choices = [
    { value: "", label: data.length > 0 ? "Elige un dato del negocio" : "Aún no hay datos del negocio" },
    ...data.map((item) => ({ value: item.key, label: `${item.label} · {${item.key}}` })),
    ...(rule.field && !datum ? [{ value: rule.field, label: `{${rule.field}} · no existe en Datos del negocio` }] : [])
  ];

  // Otro dato del mismo tipo conserva la regla; si cambia el tipo, arranca con lo natural de ese tipo.
  const setField = (key: string) => {
    const nextType = data.find((item) => item.key === key)?.type;
    const allowed = operatorsForFieldType(nextType);
    onPatch(nextType === datum?.type && allowed.includes(rule.operator) ? { field: key } : { field: key, operator: allowed[0]!, value: "" });
  };

  return (
    <div className="cfr">
      <InlineSelect value={rule.field} options={choices} ariaLabel={`Dato del negocio de la regla ${index + 1}`} onChange={setField} />
      {datum ? <p className="kit-hint">Hoy vale «{businessValueText(datum)}». Se cambia en Configuración › Campos y datos › Datos del negocio.</p> : null}
      {rule.field && !datum ? <p className="kit-hint">Créalo en Configuración › Campos y datos › Datos del negocio con la clave {`{${rule.field}}`}: mientras no exista, la regla no se cumple.</p> : null}
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
