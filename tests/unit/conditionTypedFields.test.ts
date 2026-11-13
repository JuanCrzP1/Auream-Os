import { describe, expect, it } from "vitest";
import { evaluateCondition, type ConditionFacts } from "../../flow-engine/nodes/condition/evaluateCondition.js";
import { joinRuleValues, operatorsForFieldType, readConditionConfig, type ConditionConfig } from "../../contracts/ConditionConfig.js";
import { validateCondition } from "../../contracts/blocks/validation/condition.js";

// ---------------------------------------------------------------------------
// Condicional sobre un campo del cliente con tipo: «una de» las opciones de
// una lista, «entre» dos números y las reglas de fecha («cumple años hoy», «en
// los próximos N días»…) con la fecha DEL NEGOCIO. Y lo que valida el editor.
// ---------------------------------------------------------------------------

// Viernes 13 de noviembre de 2026, 23:30 en Bogotá (ya es 14 en UTC).
const NOW = new Date("2026-11-14T04:30:00.000Z");

const facts = (fields: Record<string, unknown>): ConditionFacts => ({
  now: NOW,
  timezone: "America/Bogota",
  lastInboundAt: null,
  contactField: () => undefined,
  customField: (name) => fields[name]
});
const rule = (field: string, operator: string, value = ""): ConditionConfig => ({ match: "all", rules: [{ id: "r", category: "customField", field, operator, value }] });
const met = (config: ConditionConfig, fields: Record<string, unknown>) => evaluateCondition(config, facts(fields)).met;

describe("lista: una de las opciones", () => {
  it("con lo que dijo el cliente o lo de la ficha, sin tildes ni mayúsculas", () => {
    const una = rule("ciudad", "is_one_of", joinRuleValues(["Medellín", "Bogotá"]));
    expect(met(una, { ciudad: "medellin" })).toBe(true);
    expect(met(una, { ciudad: "Cali" })).toBe(false);
    expect(met(una, {})).toBe(false);
    const ninguna = rule("ciudad", "is_none_of", joinRuleValues(["Medellín", "Bogotá"]));
    expect(met(ninguna, { ciudad: "Cali" })).toBe(true);
    expect(met(ninguna, { ciudad: "Bogotá" })).toBe(false);
  });
});

describe("número: entre", () => {
  it("incluye los bordes, en cualquier orden y como lo escribe la gente", () => {
    const entre = rule("presupuesto", "between", joinRuleValues(["500.000", "2.000.000"]));
    expect(met(entre, { presupuesto: 1200000 })).toBe(true);
    expect(met(entre, { presupuesto: "1.200.000" })).toBe(true);
    expect(met(entre, { presupuesto: 500000 })).toBe(true);
    expect(met(entre, { presupuesto: 2500000 })).toBe(false);
    expect(met(rule("presupuesto", "between", joinRuleValues(["2.000.000", "500.000"])), { presupuesto: 600000 })).toBe(true);
    expect(met(entre, { presupuesto: "no sé" })).toBe(false);
  });
});

describe("fechas, con el día del negocio", () => {
  it("cumpleaños hoy: día y mes, en la zona del negocio (en UTC ya sería mañana)", () => {
    expect(met(rule("cumple", "anniversary_today"), { cumple: "1990-11-13" })).toBe(true);
    expect(met(rule("cumple", "anniversary_today"), { cumple: "13/11/1985" })).toBe(true);
    expect(met(rule("cumple", "anniversary_today"), { cumple: "1990-11-14" })).toBe(false);
    expect(met(rule("cumple", "anniversary_today"), {})).toBe(false);
  });

  it("en los próximos N días y hace N días o más", () => {
    expect(met(rule("vence", "within_next_days", "3"), { vence: "2026-11-16" })).toBe(true);
    expect(met(rule("vence", "within_next_days", "3"), { vence: "2026-11-13" })).toBe(true);
    expect(met(rule("vence", "within_next_days", "3"), { vence: "2026-11-17" })).toBe(false);
    expect(met(rule("vence", "within_next_days", "3"), { vence: "2026-11-12" })).toBe(false);
    expect(met(rule("pago", "at_least_days_ago", "30"), { pago: "2026-10-14" })).toBe(true);
    expect(met(rule("pago", "at_least_days_ago", "30"), { pago: "2026-10-20" })).toBe(false);
  });

  it("antes y después de una fecha", () => {
    expect(met(rule("pago", "before_date", "2026-11-01"), { pago: "15/10/2026" })).toBe(true);
    expect(met(rule("pago", "after_date", "2026-11-01"), { pago: "2026-10-15" })).toBe(false);
  });
});

describe("el contrato y la validación", () => {
  it("cada tipo ofrece sus operadores; uno guardado que no existe cae al inicial", () => {
    expect(operatorsForFieldType("list")[0]).toBe("is_one_of");
    expect(operatorsForFieldType("date")).toContain("anniversary_today");
    expect(operatorsForFieldType(undefined)).not.toContain("is_one_of");
    expect(readConditionConfig({ rules: [{ category: "customField", field: "x", operator: "inventado" }] }).rules[0]!.operator).toBe("equal");
    expect(readConditionConfig({ rules: [{ category: "customField", field: "x", operator: "between", value: "1\n2" }] }).rules[0]!.operator).toBe("between");
  });

  it("valida lo que cada regla necesita", () => {
    const check = (config: ConditionConfig) => validateCondition({}, config as unknown as Record<string, unknown>);
    expect(check(rule("ciudad", "is_one_of", "")).valid).toBe(false);
    expect(check(rule("presupuesto", "between", "100")).valid).toBe(false);
    expect(check(rule("presupuesto", "between", joinRuleValues(["100", "200"]))).valid).toBe(true);
    expect(check(rule("vence", "within_next_days", "tres")).valid).toBe(false);
    expect(check(rule("cumple", "anniversary_today")).valid).toBe(true);
    expect(check(rule("pago", "before_date", "13/11/2026")).valid).toBe(false);
  });
});
