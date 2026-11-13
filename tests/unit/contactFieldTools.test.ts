import { describe, expect, it } from "vitest";
import { matchesFieldFilters, readFieldFilters } from "../../contracts/ContactFieldFilters.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";
import { renameFlowKeys, restoreFlowBlocks } from "../../domains/contact-fields/domain/fieldMerge.js";
import { fieldSuggestions } from "../../domains/contact-fields/domain/fieldSuggestions.js";
import { proposeTidy, requireTidy } from "../../domains/contact-fields/domain/fieldTidy.js";

// ---------------------------------------------------------------------------
// Herramientas del catálogo, reglas puras: cómo se proponen los grupos al
// ordenar valores, qué se valida al confirmar, cómo cambia una clave dentro de
// los bloques de un flujo (y cómo vuelve), qué se sugiere ordenar y los
// filtros por campo.
// ---------------------------------------------------------------------------

const counted = (entries: Array<[string, number]>) => entries.map(([value, count]) => ({ value, count }));

describe("ordenar valores", () => {
  it("agrupa lo escrito parecido en la opción que ya existe; lo nuevo que se repite se propone como opción; lo suelto queda como está", () => {
    const groups = proposeTidy(counted([["Medellín", 520], ["medellin", 37], ["Medelin", 6], ["mede", 2], ["Bogotá", 341], ["bogota.", 20], ["Cartagena", 41], ["ctg", 4], ["hola", 1]]), ["Medellín", "Bogotá"], 972);
    expect(groups.map((group) => [group.values.map((entry) => entry.value), group.count, group.proposal])).toEqual([
      [["Medellín", "medellin", "Medelin", "mede"], 565, { kind: "option", to: "Medellín" }],
      [["Bogotá", "bogota."], 361, { kind: "option", to: "Bogotá" }],
      [["Cartagena"], 41, { kind: "new", to: "Cartagena" }],
      [["ctg"], 4, { kind: "keep" }],
      [["hola"], 1, { kind: "keep" }]
    ]);
  });

  it("un campo de texto: las formas más usadas se proponen como opciones", () => {
    const groups = proposeTidy(counted([["Video", 30], ["video", 12], ["Canción", 25], ["otra cosa", 1]]), [], 68);
    expect(groups.map((group) => group.proposal)).toEqual([{ kind: "new", to: "Video" }, { kind: "new", to: "Canción" }, { kind: "keep" }]);
  });

  it("al confirmar: solo cambia lo que cambia, suma las opciones nuevas y respeta los límites", () => {
    const plan = requireTidy(["Medellín"], { assignments: [{ values: ["Medellín", "medellin", "MDE"], to: "medellín" }, { values: ["Cartagena", "ctg"], to: "Cartagena" }, { values: ["hola"], to: null }] });
    expect(plan).toEqual({ map: { medellin: "Medellín", MDE: "Medellín", ctg: "Cartagena", hola: null }, options: ["Medellín", "Cartagena"] });
    expect(() => requireTidy([], { assignments: [] })).toThrow("al menos un grupo");
    expect(() => requireTidy([], { assignments: [{ values: ["a"], to: "Solo una" }] })).toThrow("al menos 2 opciones");
    expect(() => requireTidy(["A", "B"], { assignments: [{ values: ["A"], to: "A" }] })).toThrow("No hay nada que cambiar");
    expect(() => requireTidy(["A", "B"], { assignments: [{ values: ["x"], to: "y".repeat(41) }] })).toThrow("hasta 40");
  });
});

const flow = {
  flow: { id: "f", key: "ventas", name: "Ventas" },
  nodes: {
    q: { id: "q", type: "question", name: "Pregunta", content: { text: "¿Qué quieres?" }, config: { targetKey: "context.resposta" }, metadata: {} },
    menu: { id: "menu", type: "menu", name: "Menú", content: {}, config: { saveToField: "respuesta_menu", options: [{ id: "o", title: "Video" }] }, metadata: {} },
    m: { id: "m", type: "message", name: "Mensaje", content: {}, config: { items: [{ kind: "text", text: "Recibí: {resposta} · {resposta|nada} · {{context.resposta}} · {otra}" }] }, metadata: {} },
    c: { id: "c", type: "condition", name: "¿Dijo sí?", content: {}, config: { rules: [{ id: "r", category: "customField", field: "resposta", operator: "equal", value: "resposta" }, { id: "t", category: "tag", field: "", operator: "equal", value: "resposta" }] }, metadata: {} },
    x: { id: "x", type: "message", name: "Sin cambios", content: {}, config: { items: [{ kind: "text", text: "Hola {first_name}, resposta sin llaves" }] }, metadata: {} }
  }
} as unknown as BuilderFlowSnapshot;

describe("unir campos en los bloques de un flujo", () => {
  const rename = new Map([["resposta", "respuesta"], ["respuesta_menu", "respuesta"]]);

  it("cambia la clave donde se guarda, donde la lee un Condicional y dentro de los textos; nada más", () => {
    const { draft, changes } = renameFlowKeys(flow, rename);
    expect(changes.map((change) => change.blockId)).toEqual(["q", "menu", "m", "c"]);
    expect(draft.nodes["q"]!.config).toEqual({ targetKey: "respuesta" });
    expect(draft.nodes["menu"]!.config).toMatchObject({ saveToField: "respuesta", options: [{ id: "o", title: "Video" }] });
    expect((draft.nodes["m"]!.config as { items: Array<{ text: string }> }).items[0]!.text).toBe("Recibí: {respuesta} · {respuesta|nada} · {{context.respuesta}} · {otra}");
    expect((draft.nodes["c"]!.config as { rules: Array<{ field: string; value: string }> }).rules).toEqual([expect.objectContaining({ field: "respuesta", value: "resposta" }), expect.objectContaining({ field: "", value: "resposta" })]);
    expect(draft.nodes["x"]).toBe(flow.nodes["x"]);
    expect(renameFlowKeys(flow, new Map([["no_existe", "x"]])).draft).toBe(flow);
  });

  it("deshacer devuelve cada bloque, salvo el que alguien editó después (aunque la base reordene el JSON)", () => {
    const { draft, changes } = renameFlowKeys(flow, rename);
    const reordered = JSON.parse(JSON.stringify(changes)) as typeof changes;
    const edited = { ...draft, nodes: { ...draft.nodes, m: { ...draft.nodes["m"]!, config: { items: [{ kind: "text", text: "Lo cambié a mano" }] } } } } as BuilderFlowSnapshot;
    const result = restoreFlowBlocks(edited, reordered);
    expect([result.restored, result.skipped]).toEqual([3, 1]);
    expect(result.draft.nodes["q"]!.config).toEqual({ targetKey: "context.resposta" });
    expect((result.draft.nodes["m"]!.config as { items: Array<{ text: string }> }).items[0]!.text).toBe("Lo cambié a mano");
  });
});

describe("qué conviene ordenar", () => {
  const def = (key: string, type: "text" | "list", options: string[] = []) => ({ id: key, key, label: key, type, options, createdAt: "", updatedAt: "" });
  const seen = (entries: Array<[string, number]>) => ({ filled: entries.reduce((sum, [, n]) => sum + n, 0), distinct: entries.length, top: counted(entries) });

  it("listas con valores fuera de sus opciones, textos que son una lista y claves parecidas", () => {
    const suggestions = fieldSuggestions(
      [def("ciudad", "list", ["Medellín", "Bogotá"]), def("producto", "text"), def("nota", "text"), def("respuesta", "text")],
      new Map([["ciudad", seen([["Medellín", 40], ["medellin", 6], ["Cali", 3]])], ["producto", seen([["Video", 30], ["Canción", 25]])], ["nota", seen([["algo largo", 1], ["otra nota", 1]])]]),
      ["resposta", "respuesta_menu", "cedula"],
      []
    );
    expect(suggestions.toTidy).toEqual([
      { fieldId: "ciudad", label: "ciudad", kind: "stray", count: 2, examples: ["medellin", "Cali"] },
      { fieldId: "producto", label: "producto", kind: "asList", count: 2, examples: ["Video", "Canción"] }
    ]);
    expect(suggestions.toMerge).toEqual([{ keys: ["respuesta", "resposta", "respuesta_menu"] }]);
  });
});

describe("filtros por campo", () => {
  it("lee los filtros sin confiar en ellos", () => {
    expect(readFieldFilters(undefined)).toEqual({ ok: true, filters: [] });
    expect(readFieldFilters([{ key: "ciudad", op: "in", values: ["Medellín", "Medellín", " "] }, { key: "presupuesto", op: "between", min: "500.000" }, { key: "ya", op: "yes", values: ["x"] }])).toEqual({
      ok: true,
      filters: [{ key: "ciudad", op: "in", values: ["Medellín"] }, { key: "presupuesto", op: "between", min: "500.000" }, { key: "ya", op: "yes" }]
    });
    for (const bad of ["x", [{ key: "mi campo", op: "in" }], [{ key: "a", op: "like" }], [{ key: "a", op: "in", values: [] }], [{ key: "a", op: "between" }], [{ key: "a", op: "between", min: "ayer" }], Array.from({ length: 6 }, () => ({ key: "a", op: "filled" }))]) {
      expect(readFieldFilters(bad).ok).toBe(false);
    }
  });

  it("un cliente cumple todos o no entra", () => {
    const laura = { ciudad: "Medellín", ya_compro: true, presupuesto: 1200000, cumple: "1990-11-13", nota: "" };
    const ok = (filters: unknown) => matchesFieldFilters(laura, (readFieldFilters(filters) as { filters: never[] }).filters);
    expect(ok([{ key: "ciudad", op: "in", values: ["medellín", "Cali"] }, { key: "ya_compro", op: "yes" }])).toBe(true);
    expect(ok([{ key: "ciudad", op: "in", values: ["Cali"] }])).toBe(false);
    expect(ok([{ key: "presupuesto", op: "between", min: "1.000.000", max: "2.000.000" }])).toBe(true);
    expect(ok([{ key: "presupuesto", op: "between", max: "1.000.000" }])).toBe(false);
    expect(ok([{ key: "cumple", op: "between", min: "1990-01-01", max: "1990-12-31" }])).toBe(true);
    expect(ok([{ key: "nota", op: "empty" }, { key: "otra", op: "empty" }, { key: "ciudad", op: "filled" }])).toBe(true);
    expect(ok([{ key: "ya_compro", op: "no" }])).toBe(false);
  });
});
