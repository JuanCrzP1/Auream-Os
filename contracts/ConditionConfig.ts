import { readEnum, readItems, readString } from "./ConfigReaders";

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
export function operatorNeedsValue(rule: ConditionRule): boolean {
  return rule.category !== "messageWindow" && rule.operator !== "has_value";
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
