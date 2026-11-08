import type { ToolData } from "../ToolDefinition";
import { describeRule, readConditionConfig } from "./conditionConfig";

export function summarizeCondition(_content: ToolData, config: ToolData): string {
  const { match, rules } = readConditionConfig(config);
  if (rules.length === 0) return "Sin reglas";
  if (rules.length === 1) return describeRule(rules[0]);

  return `${match === "all" ? "Todas" : "Cualquiera"} de ${rules.length} reglas`;
}
