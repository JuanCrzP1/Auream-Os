import { describe, expect, it, vi } from "vitest";
import { businessKeyFromLabel, businessValuesOf, businessValueText, fillBusinessData } from "../../contracts/BusinessDataContracts.js";
import { quickReplyParts } from "../../contracts/QuickReplyContracts.js";
import type { RuntimeInput } from "../../contracts/RuntimeContracts.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";
import { requireDatumChanges, requireNewDatum } from "../../domains/business-data/domain/BusinessDatum.js";
import { businessDataUsage } from "../../domains/business-data/domain/businessDataUses.js";
import { BusinessDataServices } from "../../domains/business-data/application/BusinessDataServices.js";
import { InMemoryBusinessDataRepository } from "../../infrastructure/persistence/memory/InMemoryBusinessData.js";
import { requireNewField } from "../../domains/contact-fields/domain/ContactField.js";
import { personalize } from "../../domains/broadcasts/domain/Personalize.js";
import { evaluateCondition, type ConditionFacts } from "../../flow-engine/nodes/condition/evaluateCondition.js";
import { templateResolver } from "../../flow-engine/templates/templateResolver.js";
import { renderTemplate } from "../../contracts/TemplateVariables.js";

// ---------------------------------------------------------------------------
// Datos del negocio: lo que se repite en los mensajes (Pago Móvil, horario,
// enlace del grupo) escrito una vez y usado como `{g_clave}` en flujos,
// difusiones, respuestas rápidas y el Condicional. Los flujos lo leen y nunca
// lo cambian. Un cambio en Configuración se ve en el siguiente mensaje.
// ---------------------------------------------------------------------------

const PAGO = "Pago Móvil 0424-6461556, C.I. 20.862.003";

describe("las reglas de un dato", () => {
  it("la clave sale del nombre con el prefijo g_ de Leona; una que ya llega se respeta", () => {
    expect(businessKeyFromLabel("Pago Móvil")).toBe("g_pago_movil");
    expect(businessKeyFromLabel("G Horario")).toBe("g_horario");
    expect(requireNewDatum({ label: "Grupo VIP", key: "g_link_grupo", type: "text", value: "https://chat.whatsapp.com/x" }).key).toBe("g_link_grupo");
    expect(requireNewDatum({ label: "Horario", key: "horario", type: "text", value: "8 a 6" }).key).toBe("g_horario");
    expect(() => requireNewDatum({ label: "Raro", key: "g_Con-Guion", type: "text", value: "x" })).toThrow("La clave empieza por «g_»");
  });

  it("el valor se guarda según su tipo y se lee como persona", () => {
    const cupos = requireNewDatum({ label: "Cupos", type: "number", value: "1.200" });
    expect(cupos.value).toBe("1200");
    expect(businessValueText(cupos)).toBe("1.200");
    const promo = requireNewDatum({ label: "Promo activa", type: "boolean", value: "Sí" });
    expect([promo.value, businessValueText(promo)]).toEqual(["true", "Sí"]);
    const evento = requireNewDatum({ label: "Evento", type: "date", value: "24/12/2026" });
    expect([evento.value, businessValueText(evento)]).toEqual(["2026-12-24", "24/12/2026"]);
    expect(() => requireNewDatum({ label: "Cupos", type: "number", value: "muchos" })).toThrow("solo con números");
    expect(() => requireNewDatum({ label: "Horario", type: "text", value: "   " })).toThrow("Escribe el valor");
  });

  it("al cambiar, la clave no cambia y el valor debe encajar en el tipo nuevo", () => {
    const horario = requireNewDatum({ label: "Horario", type: "text", value: "8 a 6" });
    expect(requireDatumChanges(horario, { label: "Horario de atención", value: "9 a 5" })).toMatchObject({ key: "g_horario", label: "Horario de atención", value: "9 a 5" });
    expect(() => requireDatumChanges(horario, { type: "number" })).toThrow("solo con números");
  });

  it("un campo del cliente no puede llamarse g_… (quedaría tapado por el dato del negocio)", () => {
    expect(() => requireNewField({ label: "G promo", type: "text" })).toThrow("Datos del negocio");
  });
});

const values = businessValuesOf([
  { key: "g_pago_movil", type: "text", value: PAGO },
  { key: "g_promo_activa", type: "boolean", value: "true" },
  { key: "g_cupos", type: "number", value: "12" }
]);

describe("en los mensajes", () => {
  const input = (business?: Record<string, unknown>, context: Record<string, unknown> = {}) =>
    ({
      envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m", payload: {}, receivedAt: "2026-11-13T19:35:00.000Z" },
      sessionContext: context,
      isWaitingInput: false,
      now: "2026-11-13T19:35:00.000Z",
      timezone: "America/Bogota",
      ...(business ? { business } : {})
    }) as RuntimeInput;

  it("un flujo pone el valor de Configuración, nunca uno que guardó la conversación o la ficha", () => {
    const resolve = templateResolver(input(values, { g_pago_movil: "otro número" }), { id: "c", name: "Laura", phone: "1", email: null, tags: [], customFields: { g_cupos: 99 } } as never);
    expect(renderTemplate("Paga al {g_pago_movil}. Quedan {g_cupos} cupos. ¿Promo? {g_promo_activa}", resolve).text).toBe(`Paga al ${PAGO}. Quedan 12 cupos. ¿Promo? Sí`);
    // Uno que no existe queda con su valor por defecto, o vacío.
    expect(renderTemplate("Horario: {g_horario|consúltanos}", resolve).text).toBe("Horario: consúltanos");
    expect(renderTemplate("Horario: {g_horario}", templateResolver(input(), null)).text).toBe("Horario: ");
  });

  it("difusiones: el nombre de cada uno y los datos del negocio", () => {
    expect(personalize("Hola {first_name}, paga al {g_pago_movil}", { name: "Laura Gómez", phone: "57300" }, false, values)).toBe(`Hola Laura, paga al ${PAGO}`);
    expect(personalize("Paga al {g_pago_movil}", { name: null, phone: "57300" }, false)).toBe("Paga al");
  });

  it("respuestas rápidas: {nombre} y los datos del negocio, en el texto y en el pie de foto", () => {
    const parts = quickReplyParts(
      { pieces: [{ kind: "text", text: "Hola {nombre}, paga al {g_pago_movil}" }, { kind: "media", media: { type: "image", url: "https://x/qr.png" }, caption: "Cupos: {g_cupos}" }] } as never,
      "Laura Gómez",
      values
    );
    expect(parts).toEqual([{ kind: "text", text: `Hola Laura, paga al ${PAGO}` }, { kind: "media", media: { type: "image", url: "https://x/qr.png" }, caption: "Cupos: 12" }]);
    expect(fillBusinessData("{nombre}: {g_x|sin dato}", values)).toBe("{nombre}: sin dato");
  });
});

describe("en el Condicional", () => {
  const facts = (business?: Record<string, unknown>): ConditionFacts => ({
    now: new Date("2026-11-13T19:35:00.000Z"),
    timezone: "America/Bogota",
    lastInboundAt: null,
    contactField: () => undefined,
    customField: () => undefined,
    ...(business ? { business } : {})
  });
  const rule = (field: string, operator: string, value = "") => ({ match: "all" as const, rules: [{ id: "r", category: "globalVariable" as const, field, operator, value }] });

  it("«Variable global» ya funciona, con su tipo: Sí es sí y 12 está entre 10 y 20", () => {
    expect(evaluateCondition(rule("g_promo_activa", "equal", "Sí"), facts(values)).met).toBe(true);
    expect(evaluateCondition(rule("g_cupos", "between", "10\n20"), facts(values)).met).toBe(true);
    expect(evaluateCondition(rule("g_cupos", "greater_than", "20"), facts(values)).met).toBe(false);
    expect(evaluateCondition(rule("g_horario", "has_value"), facts(values)).met).toBe(false);
  });

  it("si el motor no conoce los datos del negocio, la regla no se cumple y queda anotado (no se inventa)", () => {
    expect(evaluateCondition(rule("g_promo_activa", "equal", "Sí"), facts()).rules[0]).toEqual({ ruleId: "r", met: false, unavailable: true });
  });
});

const flow = (texts: string[], rules: unknown[] = []): BuilderFlowSnapshot =>
  ({
    flow: { key: "ventas", name: "Ventas" },
    nodes: {
      pago: { id: "pago", name: "Pago", type: "message", content: {}, config: { items: texts.map((text, i) => ({ id: `t${i}`, kind: "text", text })) } },
      promo: { id: "promo", name: "¿Promo?", type: "condition", content: {}, config: { rules } }
    }
  }) as never;

describe("dónde se usa", () => {
  it("bloques que lo escriben o lo preguntan, difusiones por enviar y respuestas rápidas; y un mensaje real", () => {
    const usage = businessDataUsage(
      [flow([`Paga al {g_pago_movil}`], [{ category: "globalVariable", field: "g_promo_activa" }])],
      [{ id: "b1", name: "Black Friday", texts: ["Hoy {g_pago_movil}"] }],
      [{ id: "q1", shortcut: "pago", texts: ["{g_pago_movil}"] }]
    );
    expect(usage.uses.get("g_pago_movil")?.map((use) => use.kind)).toEqual(["flow", "broadcast", "quickReply"]);
    expect(usage.uses.get("g_promo_activa")).toEqual([{ kind: "flow", flowKey: "ventas", flowName: "Ventas", blockId: "promo", blockName: "¿Promo?", blockType: "condition" }]);
    expect(usage.examples.get("g_pago_movil")).toEqual({ template: "Paga al {g_pago_movil}", source: "Flujo «Ventas» · Pago" });
  });
});

describe("el servicio", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const setup = (flows: BuilderFlowSnapshot[] = []) => {
    const repository = new InMemoryBusinessDataRepository();
    const cache = { forget: vi.fn() };
    const services = new BusinessDataServices(repository, { flows: async () => flows, broadcasts: async () => [], quickReplies: async () => [] }, cache, { newId: () => ID });
    return { repository, cache, services };
  };

  it("crea, no repite la clave y avisa al motor de cada cambio", async () => {
    const { services, cache } = setup();
    await services.create("t", { label: "Pago Móvil", type: "text", value: PAGO }, "u1");
    await expect(services.create("t", { label: "Pago movil", type: "text", value: "x" }, "u1")).rejects.toThrow("Ya hay un dato con la clave {g_pago_movil}");
    await services.update("t", ID, { value: "Nuevo Pago Móvil" }, "u1");
    expect(cache.forget).toHaveBeenCalledTimes(2);
    expect(await services.values("t")).toEqual({ values: { g_pago_movil: "Nuevo Pago Móvil" } });
  });

  it("uno que se usa solo se borra escribiendo su clave; uno que nadie usa se borra directo", async () => {
    const { services } = setup([flow(["Paga al {g_pago_movil}"])]);
    await services.create("t", { label: "Pago Móvil", type: "text", value: PAGO }, "u1");
    expect((await services.list("t", true)).data[0]).toMatchObject({ key: "g_pago_movil", uses: [{ kind: "flow", blockName: "Pago" }], example: { template: "Paga al {g_pago_movil}" } });
    await expect(services.remove("t", ID, null, "u1")).rejects.toThrow("Para borrarlo escribe «g_pago_movil»: 1 mensaje lo usa");
    await services.remove("t", ID, "g_pago_movil", "u1");
    expect((await services.list("t", true)).data).toEqual([]);
    const unused = setup();
    await unused.services.create("t", { label: "Horario", type: "text", value: "8 a 6" }, "u1");
    await unused.services.remove("t", ID, null, "u1");
    expect(await unused.repository.list("t")).toEqual([]);
  });
});
