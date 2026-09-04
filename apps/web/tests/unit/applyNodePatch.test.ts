import { describe, expect, it } from "vitest";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Mutador genérico de nodo.
//
// Es el canal por el que una herramienta escribirá su configuración, así que lo
// que estos tests fijan no es «cambia un campo» sino las tres garantías de las
// que depende todo lo que venga después:
//
//   1. lo que no se parchea NO se toca —ni la identidad, ni la colocación, ni
//      la otra mitad de la configuración—;
//   2. lo que se parchea REEMPLAZA, para que una herramienta pueda borrar una
//      clave y no solo añadirla;
//   3. nada queda compartido por referencia con quien llamó.
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<CanvasNode["data"]> = {}): CanvasNode {
  return {
    id: "n-1",
    type: "flowNode",
    position: { x: 240, y: 120 },
    deletable: true,
    data: {
      nodeType: "question",
      title: "Pregunta",
      preview: "¿Cómo te llamas?",
      configSummary: "Sin configuración adicional",
      isEntry: false,
      isTerminal: false,
      content: { text: "¿Cómo te llamas?" },
      config: {},
      metadata: { ui: { x: 240, y: 120 }, creadoPor: "test" },
      ...overrides
    }
  };
}

describe("applyNodePatch — qué cambia", () => {
  it("cambia el nombre", () => {
    const result = applyNodePatch(makeNode(), { name: "Preguntar nombre" });

    expect(result.data.title).toBe("Preguntar nombre");
  });

  it("cambia el contenido", () => {
    const result = applyNodePatch(makeNode(), { content: { text: "¿Tu nombre?" } });

    expect(result.data.content).toEqual({ text: "¿Tu nombre?" });
  });

  it("cambia la configuración", () => {
    const result = applyNodePatch(makeNode(), { config: { targetKey: "nombre" } });

    expect(result.data.config).toEqual({ targetKey: "nombre" });
  });

  it("acepta configuración anidada", () => {
    const config = { settings: { enabled: true, options: ["a", "b"] } };

    const result = applyNodePatch(makeNode(), { config });

    expect(result.data.config).toEqual(config);
  });

  it("reemplaza el valor entero en vez de fusionarlo: una herramienta puede borrar una clave", () => {
    const node = makeNode({ config: { targetKey: "nombre", obsoleta: true } });

    const result = applyNodePatch(node, { config: { targetKey: "nombre" } });

    expect(result.data.config).toEqual({ targetKey: "nombre" });
    expect(result.data.config).not.toHaveProperty("obsoleta");
  });
});

describe("applyNodePatch — qué NO cambia", () => {
  it("cambiar la configuración no borra el contenido", () => {
    const result = applyNodePatch(makeNode(), { config: { targetKey: "nombre" } });

    expect(result.data.content).toEqual({ text: "¿Cómo te llamas?" });
  });

  it("cambiar el contenido no borra la configuración", () => {
    const node = makeNode({ config: { targetKey: "nombre" } });

    const result = applyNodePatch(node, { content: { text: "otra cosa" } });

    expect(result.data.config).toEqual({ targetKey: "nombre" });
  });

  it("cambiar el nombre no toca ni contenido ni configuración", () => {
    const node = makeNode({ config: { targetKey: "nombre" } });

    const result = applyNodePatch(node, { name: "Otro nombre" });

    expect(result.data.content).toEqual({ text: "¿Cómo te llamas?" });
    expect(result.data.config).toEqual({ targetKey: "nombre" });
  });

  it("conserva id, tipo, metadatos y posición", () => {
    const node = makeNode();

    const result = applyNodePatch(node, { config: { targetKey: "nombre" } });

    expect(result.id).toBe("n-1");
    expect(result.data.nodeType).toBe("question");
    expect(result.data.metadata).toEqual({ ui: { x: 240, y: 120 }, creadoPor: "test" });
    expect(result.position).toEqual({ x: 240, y: 120 });
  });

  it("conserva las banderas del lienzo, incluida la protección de la entrada", () => {
    const node = makeNode({ isEntry: true, isTerminal: false });
    const entrada: CanvasNode = { ...node, deletable: false };

    const result = applyNodePatch(entrada, { name: "Arranque" });

    expect(result.data.isEntry).toBe(true);
    expect(result.deletable).toBe(false);
  });

  it("no muta el nodo original", () => {
    const node = makeNode();

    applyNodePatch(node, { name: "Otro", config: { targetKey: "nombre" } });

    expect(node.data.title).toBe("Pregunta");
    expect(node.data.config).toEqual({});
  });
});

describe("applyNodePatch — sin referencias compartidas", () => {
  it("no comparte el objeto de configuración con quien llamó", () => {
    const config: Record<string, unknown> = { targetKey: "nombre" };

    const result = applyNodePatch(makeNode(), { config });
    config.targetKey = "otro";

    expect(result.data.config).toEqual({ targetKey: "nombre" });
  });

  it("no comparte tampoco los objetos anidados", () => {
    const config = { settings: { enabled: true, options: ["a", "b"] } };

    const result = applyNodePatch(makeNode(), { config });
    config.settings.enabled = false;
    config.settings.options.push("c");

    expect(result.data.config).toEqual({
      settings: { enabled: true, options: ["a", "b"] }
    });
  });

  it("no comparte el contenido con quien llamó", () => {
    const content: Record<string, unknown> = { text: "hola", extras: { tono: "formal" } };

    const result = applyNodePatch(makeNode(), { content });
    (content.extras as Record<string, unknown>).tono = "informal";

    expect(result.data.content).toEqual({ text: "hola", extras: { tono: "formal" } });
  });

  it("dos nodos parcheados con el mismo objeto no comparten estado", () => {
    const config = { settings: { options: ["a"] } };

    const primero = applyNodePatch(makeNode(), { config });
    const segundo = applyNodePatch(makeNode(), { config });

    expect(primero.data.config).not.toBe(segundo.data.config);
    expect(primero.data.config).toEqual(segundo.data.config);
  });
});

describe("applyNodePatch — presentación derivada", () => {
  it("recalcula el resumen de configuración en vez de dejarlo obsoleto", () => {
    const result = applyNodePatch(makeNode(), { config: { targetKey: "nombre" } });

    expect(result.data.configSummary).toContain("targetKey");
    expect(result.data.configSummary).not.toBe("Sin configuración adicional");
  });

  it("mantiene el preview coherente con el contenido", () => {
    const result = applyNodePatch(makeNode(), { content: { text: "¿Tu nombre?" } });

    expect(result.data.preview).toBe("¿Tu nombre?");
  });
});
