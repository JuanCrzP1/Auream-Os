import type { Option } from "../_kit/fields";
import {
  categoryHasField,
  operatorNeedsValue,
  operatorsForFieldType,
  ruleOperators,
  ruleValues,
  type ConditionConfig,
  type ConditionRule,
  type RuleCategory
} from "@contracts/ConditionConfig";
import type { ContactFieldType } from "@contracts/ContactFieldContracts";
import { fieldValueText, joinOptions } from "@contracts/FieldValues";

// La forma de los datos (reglas, operadores válidos, lectura, salidas) es el
// contrato compartido con el motor. Aquí vive solo lo visual: rótulos y frases.
export {
  CONDITION_DEFAULT_CONFIG,
  CONDITION_OUTPUT,
  FIELD_OPERATORS,
  RULE_CATEGORIES,
  categoryHasField,
  createRule,
  operatorNeedsValue,
  readConditionConfig,
  type ConditionConfig,
  type ConditionRule,
  type MatchMode,
  type RuleCategory
} from "@contracts/ConditionConfig";

// ---------------------------------------------------------------------------
// Condicional: reglas sobre el contacto, la conversación y el momento, que se
// combinan con «todas» (Y) o «cualquiera» (O) y deciden la salida.
// ---------------------------------------------------------------------------

export const RULE_CATEGORY_OPTIONS: ReadonlyArray<Option<RuleCategory>> = [
  { value: "tag", label: "Etiqueta del contacto" },
  { value: "weekday", label: "Día de la semana" },
  { value: "time", label: "Hora del día" },
  { value: "date", label: "Fecha" },
  { value: "messageWindow", label: "Ventana de 24 h de WhatsApp" },
  { value: "attendance", label: "Estado de la atención" },
  { value: "attendant", label: "Asesor asignado" },
  { value: "contactField", label: "Dato del contacto" },
  { value: "customField", label: "Campo del cliente" },
  { value: "globalVariable", label: "Dato del negocio (variable global)" }
];

const OPERATOR_LABELS: Readonly<Record<string, string>> = {
  equal: "es igual a",
  different: "es distinto de",
  contains: "contiene",
  not_contains: "no contiene",
  starts_with: "empieza por",
  has_value: "tiene un valor",
  greater_than: "es mayor que",
  less_than: "es menor que",
  greater_or_equal: "es mayor o igual que",
  less_or_equal: "es menor o igual que",
  before: "antes de",
  after: "después de",
  open: "está abierta",
  closed: "está cerrada",
  is_one_of: "es una de",
  is_none_of: "no es ninguna de",
  between: "está entre",
  anniversary_today: "es hoy (día y mes)",
  within_next_days: "es en los próximos",
  at_least_days_ago: "fue hace",
  before_date: "es antes del",
  after_date: "es después del"
};

/** Rótulos propios de algunas categorías, donde la frase lo pide. */
const CATEGORY_OPERATOR_LABELS: Partial<Record<RuleCategory, Readonly<Record<string, string>>>> = {
  tag: { equal: "tiene", different: "no tiene" },
  weekday: { equal: "es", different: "no es" },
  attendance: { equal: "es", different: "no es" },
  attendant: { equal: "es", different: "no es" },
  time: { equal: "igual a" },
  date: { equal: "igual a" }
};

/**
 * Operadores por categoría (los del contrato), con su rótulo. Un campo del
 * cliente ofrece los de su tipo (una lista: «es una de»; una fecha: «es hoy»…).
 */
export function operatorsFor(category: RuleCategory, fieldType?: ContactFieldType): ReadonlyArray<Option<string>> {
  // Un campo del cliente y un dato del negocio se comparan igual: con su tipo.
  const typed = category === "customField" || category === "globalVariable";
  const labels = typed && fieldType === "boolean" ? { equal: "es" } : (CATEGORY_OPERATOR_LABELS[category] ?? {});
  const values = typed ? operatorsForFieldType(fieldType) : ruleOperators(category);
  return values.map((value) => ({ value, label: labels[value] ?? OPERATOR_LABELS[value] ?? value }));
}

/** El valor de una regla con tipo, como se lee: «Medellín o Bogotá», «500.000 y 2.000.000», «3 días». */
function typedValueText(rule: ConditionRule): string | null {
  const values = ruleValues(rule);
  switch (rule.operator) {
    case "is_one_of":
      return joinOptions(values);
    case "is_none_of":
      return values.length > 1 ? `${values.slice(0, -1).join(", ")} ni ${values[values.length - 1]}` : (values[0] ?? "");
    case "between":
      return values.join(" y ");
    case "within_next_days":
      return `${rule.value} días`;
    case "at_least_days_ago":
      return `${rule.value} días o más`;
    case "before_date":
    case "after_date":
      return fieldValueText(rule.value);
    default:
      return null;
  }
}

export const WEEKDAY_OPTIONS: ReadonlyArray<Option<string>> = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" }
];

export const ATTENDANCE_OPTIONS: ReadonlyArray<Option<string>> = [
  { value: "waiting", label: "En espera" },
  { value: "in_progress", label: "En atención" },
  { value: "resolved", label: "Resuelta" }
];

export const CONTACT_FIELD_OPTIONS: ReadonlyArray<Option<string>> = [
  { value: "name", label: "Nombre" },
  { value: "phone", label: "Teléfono" },
  { value: "email", label: "Correo" }
];

export { conditionOutputs } from "@contracts/blocks/outputs";

function optionLabel(options: ReadonlyArray<Option<string>>, value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Frase corta de una regla: «Etiqueta tiene vip», «Ciudad es una de Medellín o Bogotá». `fieldLabel`: el nombre del campo del cliente, si se conoce. */
export function describeRule(rule: ConditionRule, fieldLabel?: string): string {
  const subject = optionLabel(RULE_CATEGORY_OPTIONS, rule.category);
  const typed = rule.category === "customField" || rule.category === "globalVariable";
  const operator = OPERATOR_LABELS[rule.operator] && typed ? OPERATOR_LABELS[rule.operator]! : optionLabel(operatorsFor(rule.category), rule.operator);
  const field = rule.category === "contactField" ? optionLabel(CONTACT_FIELD_OPTIONS, rule.field) : typed && fieldLabel ? fieldLabel : rule.field;
  const value =
    rule.category === "weekday"
      ? optionLabel(WEEKDAY_OPTIONS, rule.value)
      : rule.category === "attendance"
        ? optionLabel(ATTENDANCE_OPTIONS, rule.value)
        : typed
          ? (typedValueText(rule) ?? rule.value)
          : rule.value;

  const head = categoryHasField(rule.category) ? `${field || subject}` : subject;
  return operatorNeedsValue(rule) ? `${head} ${operator} ${value}` : `${head} ${operator}`;
}

/** Las reglas en una frase: «Se cumple si Ciudad es una de Medellín o Bogotá y Ya compró es Sí». */
export function conditionInWords(config: ConditionConfig, labelOf: (key: string) => string | undefined = () => undefined): string {
  if (config.rules.length === 0) return "";
  const phrases = config.rules.map((rule) => describeRule(rule, rule.category === "customField" || rule.category === "globalVariable" ? labelOf(rule.field) : undefined));
  return `Se cumple si ${phrases.join(config.match === "all" ? " y " : " o ")}.`;
}
