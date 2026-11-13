import { readEnum, readItems, readString } from "./ConfigReaders";
import type { ContactFieldType } from "./ContactFieldContracts";

// ---------------------------------------------------------------------------
// Condicional — contrato de configuración compartido por el builder (editor)
// y el motor (ConditionNodeHandler). Reglas sobre el contacto, la conversación
// y el momento, combinadas con «todas» (Y) o «cualquiera» (O).
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

/**
 * Operadores con tipo de un campo del cliente (Campos del cliente):
 *   is_one_of · is_none_of          lista: es / no es una de las opciones (`value`: una por línea)
 *   between                         número: entre dos valores (`value`: «desde\nhasta»)
 *   anniversary_today               fecha: hoy es el día y el mes (cumpleaños, aniversario)
 *   within_next_days                fecha: es en los próximos N días (`value`: N)
 *   at_least_days_ago               fecha: fue hace N días o más (`value`: N)
 *   before_date · after_date        fecha: antes o después de una fecha (`value`: AAAA-MM-DD)
 */
export const TYPED_FIELD_OPERATORS = [
  "is_one_of",
  "is_none_of",
  "between",
  "anniversary_today",
  "within_next_days",
  "at_least_days_ago",
  "before_date",
  "after_date"
] as const;

export const CUSTOM_FIELD_OPERATORS: ReadonlyArray<string> = [...FIELD_OPERATORS, ...TYPED_FIELD_OPERATORS];

/**
 * Los que se ofrecen según el tipo del campo (el primero es el inicial). Un
 * dato del flujo que no es un campo (sin tipo) ofrece los de texto y número.
 */
export function operatorsForFieldType(type: ContactFieldType | undefined): ReadonlyArray<string> {
  switch (type) {
    case "list":
      return ["is_one_of", "is_none_of", "has_value"];
    case "boolean":
      return ["equal", "has_value"];
    case "date":
      return ["anniversary_today", "within_next_days", "at_least_days_ago", "before_date", "after_date", "equal", "has_value"];
    case "number":
      return ["equal", "different", "greater_than", "less_than", "greater_or_equal", "less_or_equal", "between", "has_value"];
    case "text":
      return ["equal", "different", "contains", "not_contains", "starts_with", "has_value"];
    default:
      return FIELD_OPERATORS;
  }
}

/** Una regla con varios valores (una de las opciones, entre dos números) los guarda uno por línea. */
export function ruleValues(rule: Pick<ConditionRule, "value">): string[] {
  return rule.value.split("\n").map((value) => value.trim()).filter((value) => value.length > 0);
}

export function joinRuleValues(values: ReadonlyArray<string>): string {
  return values.map((value) => value.trim()).filter((value) => value.length > 0).join("\n");
}

/** Operadores válidos por categoría (el primero es el inicial). */
export function ruleOperators(category: RuleCategory): ReadonlyArray<string> {
  switch (category) {
    case "tag":
    case "weekday":
    case "attendance":
    case "attendant":
      return ["equal", "different"];
    case "time":
    case "date":
      return ["before", "equal", "after"];
    case "messageWindow":
      return ["open", "closed"];
    case "customField":
      return CUSTOM_FIELD_OPERATORS;
    default:
      return FIELD_OPERATORS;
  }
}

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

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

/** Salidas del bloque: el motor sale por una de ellas. */
export const CONDITION_OUTPUT = { met: "true", unmet: "false" } as const;

/** Regla nueva de una categoría, con su operador, campo y valor iniciales. */
export function createRule(id: string, category: RuleCategory = "tag"): ConditionRule {
  const operator = ruleOperators(category)[0]!;
  const field = category === "contactField" ? "name" : "";
  const value =
    category === "weekday" ? "monday" : category === "attendance" ? "waiting" : category === "time" ? "09:00" : "";

  return { id, category, operator, field, value };
}

/** ¿El operador necesita un valor? */
export function operatorNeedsValue(rule: Pick<ConditionRule, "category" | "operator">): boolean {
  return rule.category !== "messageWindow" && rule.operator !== "has_value" && rule.operator !== "anniversary_today";
}

/** ¿La categoría evalúa un campo con nombre? */
export function categoryHasField(category: RuleCategory): boolean {
  return category === "contactField" || category === "customField" || category === "globalVariable";
}

export function readConditionConfig(config: Readonly<Record<string, unknown>>): ConditionConfig {
  return {
    match: readEnum(config.match, ["all", "any"] as const, "all"),
    rules: readItems(config.rules, "rule", (record, id) => {
      const category = readEnum(record.category, RULE_CATEGORIES, "tag");
      const base = createRule(id, category);
      return {
        id,
        category,
        operator: readEnum(record.operator, ruleOperators(category), base.operator),
        field: readString(record.field, base.field),
        value: readString(record.value, base.value)
      };
    })
  };
}
