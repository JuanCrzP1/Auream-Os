import { describe, expect, it } from "vitest";
import { evaluateCondition, type ConditionFacts } from "../../flow-engine/nodes/condition/evaluateCondition.js";
import { ConditionNodeHandler } from "../../flow-engine/nodes/condition/ConditionNodeHandler.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import type { ConditionConfig, ConditionRule } from "../../contracts/ConditionConfig.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Condicional (C10): cada categoría de regla, «todas» / «cualquiera», la zona
// horaria del negocio y los datos que todavía no existen.
// ---------------------------------------------------------------------------

// Domingo 8 de noviembre de 2026, 14:30 en Bogotá (19:30 UTC); en Tokio ya es lunes.
const NOW = new Date("2026-11-08T19:30:00.000Z");

function facts(overrides: Partial<ConditionFacts> = {}, context: Record<string, unknown> = {}): ConditionFacts {
  return {
    now: NOW,
    timezone: "America/Bogota",
    lastInboundAt: NOW.toISOString(),
    contactField: (name) => ({ name: "Ana Pérez", phone: "573001234567", email: undefined } as Record<string, unknown>)[name],
    customField: (name) => context[name],
    ...overrides
  };
}

const rule = (category: ConditionRule["category"], operator: string, value = "", field = ""): ConditionRule => ({ id: `${category}-${operator}`, category, operator, field, value });
const all = (...rules: ConditionRule[]): ConditionConfig => ({ match: "all", rules });
const met = (config: ConditionConfig, f = facts()) => evaluateCondition(config, f).met;

describe("día, hora y fecha — en la zona del negocio", () => {
  it("día de la semana: hoy es domingo en Bogotá", () => {
    expect(met(all(rule("weekday", "equal", "sunday")))).toBe(true);
    expect(met(all(rule("weekday", "different", "sunday")))).toBe(false);
  });

  it("el mismo instante es otro día según la zona (en Tokio ya es lunes)", () => {
    expect(met(all(rule("weekday", "equal", "monday")), facts({ timezone: "Asia/Tokyo" }))).toBe(true);
  });

  it("hora: son las 14:30 en Bogotá, no las 19:30 del servidor", () => {
    expect(met(all(rule("time", "after", "14:00")))).toBe(true);
    expect(met(all(rule("time", "before", "15:00")))).toBe(true);
    expect(met(all(rule("time", "equal", "14:30")))).toBe(true);
    expect(met(all(rule("time", "after", "19:00")))).toBe(false);
  });

  it("fecha", () => {
    expect(met(all(rule("date", "equal", "2026-11-08")))).toBe(true);
    expect(met(all(rule("date", "before", "2026-12-24")))).toBe(true);
    expect(met(all(rule("date", "after", "2026-12-24")))).toBe(false);
  });
});

describe("ventana de 24 h de WhatsApp", () => {
  it("abierta si el cliente escribió hace menos de 24 h; cerrada si no", () => {
    expect(met(all(rule("messageWindow", "open")))).toBe(true);
    const old = facts({ lastInboundAt: "2026-11-06T19:30:00.000Z" });
    expect(met(all(rule("messageWindow", "open")), old)).toBe(false);
    expect(met(all(rule("messageWindow", "closed")), old)).toBe(true);
  });
});

describe("datos del contacto y campos personalizados", () => {
  it("compara sin mayúsculas ni tildes", () => {
    expect(met(all(rule("contactField", "equal", "ana perez", "name")))).toBe(true);
    expect(met(all(rule("contactField", "contains", "PÉREZ", "name")))).toBe(true);
    expect(met(all(rule("contactField", "starts_with", "57", "phone")))).toBe(true);
  });

  it("un dato vacío no «tiene valor», es «distinto» y «no contiene»", () => {
    expect(met(all(rule("contactField", "has_value", "", "email")))).toBe(false);
    expect(met(all(rule("contactField", "different", "x@y.com", "email")))).toBe(true);
    expect(met(all(rule("contactField", "equal", "x@y.com", "email")))).toBe(false);
  });

  it("números: mayor, menor, con coma decimal", () => {
    const f = facts({}, { presupuesto: "1500,5" });
    expect(met(all(rule("customField", "greater_than", "1000", "presupuesto")), f)).toBe(true);
    expect(met(all(rule("customField", "less_or_equal", "1500.5", "presupuesto")), f)).toBe(true);
    expect(met(all(rule("customField", "greater_than", "abc", "presupuesto")), f)).toBe(false);
  });
});

describe("combinación y datos no disponibles", () => {
  it("«todas» exige todas; «cualquiera» basta con una", () => {
    const rules = [rule("weekday", "equal", "sunday"), rule("weekday", "equal", "monday")];
    expect(met({ match: "all", rules })).toBe(false);
    expect(met({ match: "any", rules })).toBe(true);
  });

  it("sin reglas no se cumple", () => {
    expect(met(all())).toBe(false);
  });

  it("atención, asesor y variables globales: no se inventan (regla no cumplida, marcada)", () => {
    const evaluation = evaluateCondition(all(rule("attendance", "different", "waiting")), facts());
    expect(evaluation.met).toBe(false);
    expect(evaluation.rules[0]).toMatchObject({ met: false, unavailable: true });
  });

  it("etiquetas del contacto: tiene / no tiene, sin mayúsculas ni tildes", () => {
    const withTags = facts({ tags: ["Cliente VIP", "Esperando pago"] });
    expect(met(all(rule("tag", "equal", "cliente vip")), withTags)).toBe(true);
    expect(met(all(rule("tag", "different", "Esperando pago")), withTags)).toBe(false);
    expect(met(all(rule("tag", "different", "Baneo")), withTags)).toBe(true);
  });

  it("si las etiquetas no se pudieron leer, la regla no se inventa", () => {
    expect(evaluateCondition(all(rule("tag", "different", "vip")), facts()).rules[0]).toMatchObject({ unavailable: true });
  });
});

describe("ConditionNodeHandler", () => {
  const node = (config: ConditionConfig): FlowNode =>
    ({ id: "cond", tenantId: "t", flowVersionId: "v", type: "condition", name: "C", content: {}, config: config as unknown as Record<string, unknown>, metadata: {} });
  const input = (text = "hola"): RuntimeInput => ({
    envelope: { tenantId: "t", flowKey: "f", channel: "web", conversationKey: "c", userKey: "573001234567", messageId: "m", payload: { text }, receivedAt: NOW.toISOString() },
    sessionContext: { full_name: "Ana Pérez" },
    isWaitingInput: false,
    now: NOW.toISOString(),
    timezone: "America/Bogota"
  });

  it("sale por «true» si se cumple y por «false» si no", async () => {
    const handler = new ConditionNodeHandler(simulationDependencies().contacts);
    expect((await handler.execute(node(all(rule("weekday", "equal", "sunday"))), input(), { tenantId: "t" } as Session)).output).toBe("true");
    expect((await handler.execute(node(all(rule("weekday", "equal", "monday"))), input(), { tenantId: "t" } as Session)).output).toBe("false");
  });

  it("registra las reglas cuyo dato no está disponible", async () => {
    const result = await new ConditionNodeHandler(simulationDependencies().contacts).execute(
      node(all(rule("attendant", "equal", "ana"))), input(), { tenantId: "t" } as Session
    );
    expect(result.domainEvents).toContain("condition_fact_unavailable:cond:attendant-equal");
  });

  it("lee las etiquetas reales del contacto de la conversación", async () => {
    const { contacts } = simulationDependencies();
    const profile = await contacts.resolve("t", { channel: "web", externalKey: "573001234567" });
    await contacts.addTags("t", profile.id, ["VIP"]);

    const result = await new ConditionNodeHandler(contacts).execute(node(all(rule("tag", "equal", "vip"))), input(), { tenantId: "t" } as Session);
    expect(result.output).toBe("true");
  });
});
