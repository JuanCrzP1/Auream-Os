import type { ToolData, ToolOutput } from "../ToolDefinition";
import type { Option } from "../_kit/fields";
import { readEnum, readItems, readString } from "../_kit/read";

// ---------------------------------------------------------------------------
// Condicional: reglas sobre el contacto, la conversación y el momento, que se
// combinan con «todas» (Y) o «cualquiera» (O) y deciden la salida.
// ---------------------------------------------------------------------------

export const RULE_CATEGORIES = [
  "tag",
  "weekday",
  "time",
  "date",
  "messageWindow",
  "attendance",
  "attendant",
  "contactField",
  "customField",
  "globalVariable"
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

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

export const FIELD_OPERATORS = [
  "equal",
  "different",
  "contains",
  "not_contains",
  "starts_with",
  "has_value",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal"
] as const;

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

/** Operadores por categoría, con rótulos propios donde la frase lo pide. */
export function operatorsFor(category: RuleCategory): ReadonlyArray<Option<string>> {
  switch (category) {
    case "tag":
      return [
        { value: "equal", label: "tiene" },
        { value: "different", label: "no tiene" }
      ];
    case "weekday":
      return [
        { value: "equal", label: "es" },
        { value: "different", label: "no es" }
      ];
    case "time":
    case "date":
      return [
        { value: "before", label: "antes de" },
        { value: "equal", label: "igual a" },
        { value: "after", label: "después de" }
      ];
    case "messageWindow":
      return [
        { value: "open", label: "está abierta" },
        { value: "closed", label: "está cerrada" }
      ];
    case "attendance":
    case "attendant":
      return [
        { value: "equal", label: "es" },
        { value: "different", label: "no es" }
      ];
    default:
      return FIELD_OPERATORS.map((value) => ({ value, label: OPERATOR_LABELS[value] }));
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

export interface ConditionRule {
  readonly id: string;
  readonly category: RuleCategory;
  readonly operator: string;
  /** Campo evaluado (dato, campo personalizado o variable global). */
  readonly field: string;
  readonly value: string;
}

export type MatchMode = "all" | "any";

export interface ConditionConfig {
  readonly match: MatchMode;
  readonly rules: ReadonlyArray<ConditionRule>;
}

export const CONDITION_DEFAULT_CONFIG: ConditionConfig = { match: "all", rules: [] };

/** Regla nueva de una categoría, con su operador, campo y valor iniciales. */
export function createRule(id: string, category: RuleCategory = "tag"): ConditionRule {
  const operator = operatorsFor(category)[0].value;
  const field = category === "contactField" ? "name" : "";
  const value =
    category === "weekday" ? "monday" : category === "attendance" ? "waiting" : category === "time" ? "09:00" : "";

  return { id, category, operator, field, value };
}

/** ¿El operador necesita un valor? */
export function operatorNeedsValue(rule: ConditionRule): boolean {
  return rule.category !== "messageWindow" && rule.operator !== "has_value";
}

/** ¿La categoría evalúa un campo con nombre? */
export function categoryHasField(category: RuleCategory): boolean {
  return category === "contactField" || category === "customField" || category === "globalVariable";
}

export function readConditionConfig(config: ToolData): ConditionConfig {
  return {
    match: readEnum(config.match, ["all", "any"] as const, "all"),
    rules: readItems(config.rules, "rule", (record, id) => {
      const category = readEnum(record.category, RULE_CATEGORIES, "tag");
      const operators = operatorsFor(category).map((option) => option.value);
      const base = createRule(id, category);
      return {
        id,
        category,
        operator: readEnum(record.operator, operators, base.operator),
        field: readString(record.field, base.field),
        value: readString(record.value, base.value)
      };
    })
  };
}

export const CONDITION_OUTPUT = { met: "true", unmet: "false" } as const;

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
