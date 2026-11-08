import type { ToolOutput } from "../ToolDefinition";
import type { Option } from "../_kit/fields";
import {
  CONDITION_OUTPUT,
  categoryHasField,
  operatorNeedsValue,
  ruleOperators,
  type ConditionRule,
  type RuleCategory
} from "@contracts/ConditionConfig";

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
  { value: "customField", label: "Campo personalizado" },
  { value: "globalVariable", label: "Variable global" }
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
  closed: "está cerrada"
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

/** Operadores por categoría (los del contrato), con su rótulo. */
export function operatorsFor(category: RuleCategory): ReadonlyArray<Option<string>> {
  const labels = CATEGORY_OPERATOR_LABELS[category] ?? {};
  return ruleOperators(category).map((value) => ({ value, label: labels[value] ?? OPERATOR_LABELS[value] ?? value }));
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

export function conditionOutputs(): ReadonlyArray<ToolOutput> {
  return [
    { id: CONDITION_OUTPUT.met, label: "Se cumple" },
    { id: CONDITION_OUTPUT.unmet, label: "No se cumple" }
  ];
}

function optionLabel(options: ReadonlyArray<Option<string>>, value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Frase corta de una regla: «Etiqueta tiene vip». */
export function describeRule(rule: ConditionRule): string {
  const subject = optionLabel(RULE_CATEGORY_OPTIONS, rule.category);
  const operator = optionLabel(operatorsFor(rule.category), rule.operator);
  const field = rule.category === "contactField" ? optionLabel(CONTACT_FIELD_OPTIONS, rule.field) : rule.field;
  const value =
    rule.category === "weekday"
      ? optionLabel(WEEKDAY_OPTIONS, rule.value)
      : rule.category === "attendance"
        ? optionLabel(ATTENDANCE_OPTIONS, rule.value)
        : rule.value;

  const head = categoryHasField(rule.category) ? `${field || subject}` : subject;
  return operatorNeedsValue(rule) ? `${head} ${operator} ${value}` : `${head} ${operator}`;
}
