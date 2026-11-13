import { describe, expect, it } from "vitest";
import { coerceFieldValue, keyFromLabel, labelFromKey, requireFieldChanges, requireNewField } from "../../domains/contact-fields/domain/ContactField.js";
import { looksAlike, suggestType } from "../../domains/contact-fields/domain/fieldDiscovery.js";
import { flowKeys, isTechnicalKey } from "../../domains/contact-fields/domain/fieldUses.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";

// ---------------------------------------------------------------------------
// Campos del cliente, reglas puras: la clave sale del nombre y nunca pisa una
// del sistema; cada valor se convierte a su tipo (o no se guarda); quién
// llena y quién lee cada dato en un flujo; y qué tipo proponemos el primer día.
// ---------------------------------------------------------------------------

const list = { key: "ciudad", label: "Ciudad", type: "list" as const, options: ["Medellín", "Bogotá", "Cali"] };
const of = (type: "text" | "number" | "date" | "boolean") => ({ key: "x", label: "X", type, options: [] });

describe("un campo", () => {
  it("la clave sale del nombre, sin tildes ni espacios; un nombre legible sale de una clave", () => {
    expect(keyFromLabel("Producto de interés")).toBe("producto_de_interes");
    expect(keyFromLabel("¿Cumpleaños?")).toBe("cumpleanos");
    expect(keyFromLabel("2do teléfono")).toBe("c_2do_telefono");
    expect(labelFromKey("fecha_ultimo_pago")).toBe("Fecha ultimo pago");
    expect(labelFromKey("resposta-lead")).toBe("Resposta lead");
  });

  it("valida nombre, tipo y opciones; nunca toma una clave del sistema", () => {
    expect(requireNewField({ label: "Ciudad", type: "list", options: ["Medellín", "medellin", "Bogotá"] })).toEqual({ key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"] });
    expect(requireNewField({ label: "Respuesta", key: "resposta-lead", type: "text" })).toMatchObject({ key: "resposta-lead", options: [] });
    expect(() => requireNewField({ label: "", type: "text" })).toThrow("nombre");
    expect(() => requireNewField({ label: "Nombre", key: "first_name", type: "text" })).toThrow("ya lo llena Auream");
    expect(() => requireNewField({ label: "Ciudad", type: "list", options: ["Solo una"] })).toThrow("al menos 2");
    expect(() => requireNewField({ label: "Ciudad", type: "otro" })).toThrow("tipo");
  });

  it("al editar, la clave no cambia y las opciones se conservan si no se mandan", () => {
    expect(requireFieldChanges(list, { label: "Ciudad de envío" })).toEqual({ ...list, label: "Ciudad de envío" });
    expect(requireFieldChanges(list, { type: "text" })).toEqual({ ...list, type: "text", options: [] });
  });
});

describe("convertir lo que guarda un bloque", () => {
  it("cada tipo, y lo que no encaja no se guarda", () => {
    expect(coerceFieldValue(of("number"), "1.200,50")).toBe(1200.5);
    expect(coerceFieldValue(of("number"), "$ 49.900")).toBe(49900);
    expect(coerceFieldValue(of("number"), "12,5")).toBe(12.5);
    expect(coerceFieldValue(of("number"), "no sé")).toBeUndefined();
    expect(coerceFieldValue(of("date"), "13/11/2026")).toBe("2026-11-13");
    expect(coerceFieldValue(of("date"), "2026-02-30")).toBeUndefined();
    expect(coerceFieldValue(of("boolean"), "Sí")).toBe(true);
    expect(coerceFieldValue(of("boolean"), "no")).toBe(false);
    expect(coerceFieldValue(of("boolean"), "tal vez")).toBeUndefined();
    expect(coerceFieldValue(list, "  medellin ")).toBe("Medellín");
    expect(coerceFieldValue(list, "Cartagena")).toBeUndefined();
    expect(coerceFieldValue(of("text"), "  Hola  ")).toBe("Hola");
    expect(coerceFieldValue(of("text"), "")).toBeUndefined();
  });
});

const flow: BuilderFlowSnapshot = {
  flow: { id: "f1", key: "ventas", name: "Ventas" },
  version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "a" },
  nodes: {
    a: { id: "a", type: "question", name: "¿Ciudad?", content: {}, config: { targetKey: "ciudad" }, metadata: {} },
    b: { id: "b", type: "message", name: "Envío", content: {}, config: { items: [{ kind: "text", text: "Enviamos a {ciudad} y a {first_name|amigo}" }] }, metadata: {} },
    c: { id: "c", type: "condition", name: "¿Medellín?", content: {}, config: { rules: [{ category: "customField", field: "ciudad", operator: "equals", value: "Medellín" }] }, metadata: {} },
    d: { id: "d", type: "payment-proof", name: "Comprobante", content: {}, config: { resultVariable: "comprobante", errorVariable: "comprobante.error" }, metadata: {} },
    e: { id: "e", type: "integration", name: "CRM externo", content: {}, config: { responseMappings: [{ field: "cliente_id" }] }, metadata: {} }
  },
  edgesBySource: {}
} as unknown as BuilderFlowSnapshot;

describe("quién llena y quién lee", () => {
  it("lee la configuración de cada bloque, y separa lo técnico", () => {
    const { uses, technical } = flowKeys(flow);
    const of = (key: string) => uses.filter((entry) => entry.key === key).map((entry) => [entry.use.blockName, entry.use.role]);
    expect(of("ciudad")).toEqual([["¿Ciudad?", "fills"], ["Envío", "reads"], ["¿Medellín?", "reads"]]);
    expect(of("first_name")).toEqual([["Envío", "reads"]]);
    expect(of("cliente_id")).toEqual([["CRM externo", "fills"]]);
    expect([...technical].sort()).toEqual(["comprobante", "comprobante.error"]);
    expect(isTechnicalKey("comprobante.valor", technical)).toBe(true);
    expect(isTechnicalKey("cliente_id", technical)).toBe(true);
    expect(isTechnicalKey("shotstack_url", technical)).toBe(true);
    expect(isTechnicalKey("ciudad", technical)).toBe(false);
  });
});

describe("el primer día", () => {
  it("propone el tipo por los valores reales: lista solo si pocas opciones se repiten", () => {
    const top = (values: Array<[string, number]>) => ({ filled: values.reduce((sum, [, count]) => sum + count, 0), distinct: values.length, top: values.map(([value, count]) => ({ value, count })) });
    expect(suggestType(top([["Medellín", 40], ["medellin", 6], ["Bogotá", 20], ["Cali", 9]]))).toEqual({ type: "list", options: ["Medellín", "Bogotá", "Cali"] });
    expect(suggestType(top([["13/11/2026", 3], ["2026-10-01", 2]]))).toEqual({ type: "date", options: [] });
    expect(suggestType(top([["sí", 30], ["no", 12]]))).toEqual({ type: "boolean", options: [] });
    expect(suggestType(top([["49900", 3], ["1.200", 1]]))).toEqual({ type: "number", options: [] });
    expect(suggestType(top([["Quiero el video para mi mamá", 1], ["¿Tienen envío?", 1]]))).toEqual({ type: "text", options: [] });
    expect(suggestType({ filled: 0, distinct: 0, top: [] })).toEqual({ type: "text", options: [] });
  });

  it("avisa de los que parecen el mismo dato con otro nombre", () => {
    expect(looksAlike("resposta", "respuesta")).toBe(true);
    expect(looksAlike("respuesta_menu", "respuesta")).toBe(true);
    expect(looksAlike("resposta-lead", "respuesta")).toBe(true);
    expect(looksAlike("ciudad", "cedula")).toBe(false);
    expect(looksAlike("cancion_1", "cancion_2")).toBe(true);
  });
});
