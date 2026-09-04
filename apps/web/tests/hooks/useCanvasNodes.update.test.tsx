import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasNodes } from "@features/automations/builder/hooks/canvas/useCanvasNodes";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// El canal de escritura, de extremo a extremo.
//
// `applyNodePatch` ya está cubierto por su propio test. Aquí se prueba lo que
// un test de función no ve: que ese mutador esté CONECTADO al dueño del estado
// y que lo escrito sobreviva hasta el snapshot que viaja al backend.
//
// Ese último tramo es el que importa: una configuración que se escribe en el
// lienzo pero se pierde al serializar es indistinguible, para el usuario, de
// una que nunca se guardó.
// ---------------------------------------------------------------------------

function makeNode(id: string, isEntry = false): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 100, y: 200 },
    deletable: !isEntry,
    data: {
      nodeType: "question",
      title: "Esperar respuesta",
      preview: "¿Cómo te llamas?",
      configSummary: "Sin configuración adicional",
      isEntry,
      isTerminal: false,
      content: { text: "¿Cómo te llamas?" },
      config: {},
      metadata: { ui: { x: 100, y: 200 } }
    }
  };
}

const edges: CanvasEdge[] = [
  {
    id: "e-1",
    source: "n-pregunta",
    target: "n-fin",
    data: {
      priority: 10,
      isFallback: false,
      label: "Priority 10",
      condition: { operator: "always" }
    }
  }
];

function makeBaseSnapshot(): BuilderFlowSnapshot {
  return {
    flow: { id: "flow-1", key: "flow-1", name: "Flow" },
    version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "n-inicio" },
    nodes: {},
    edgesBySource: {}
  };
}

function renderCanvasNodes() {
  const initial = [makeNode("n-inicio", true), makeNode("n-pregunta"), makeNode("n-fin")];
  return renderHook(() => useCanvasNodes(initial, null));
}

describe("useCanvasNodes — updateNode", () => {
  it("escribe la configuración del nodo indicado", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });

    const nodo = result.current.nodes.find((n) => n.id === "n-pregunta");
    expect(nodo?.data.config).toEqual({ targetKey: "nombre" });
  });

  it("no toca a los demás nodos", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });

    const otros = result.current.nodes.filter((n) => n.id !== "n-pregunta");
    expect(otros.every((n) => Object.keys(n.data.config).length === 0)).toBe(true);
  });

  it("ignora un id que no está en el lienzo, sin romper el estado", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("fantasma", { config: { targetKey: "nombre" } });
    });

    expect(result.current.nodes.map((n) => n.id)).toEqual(["n-inicio", "n-pregunta", "n-fin"]);
  });

  it("permite configurar también el nodo de entrada: protegerlo del borrado no es congelarlo", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-inicio", { name: "Arranque" });
    });

    const entrada = result.current.nodes.find((n) => n.id === "n-inicio");
    expect(entrada?.data.title).toBe("Arranque");
    expect(entrada?.deletable).toBe(false);
  });
});

describe("updateNode → mapCanvasToSnapshot", () => {
  it("una configuración real llega intacta al snapshot", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);

    expect(snapshot.nodes["n-pregunta"].config).toEqual({ targetKey: "nombre" });
  });

  it("una configuración anidada llega intacta al snapshot", () => {
    const { result } = renderCanvasNodes();
    const config = { settings: { enabled: true, options: ["a", "b"] } };

    act(() => {
      result.current.updateNode("n-pregunta", { config });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);

    expect(snapshot.nodes["n-pregunta"].config).toEqual({
      settings: { enabled: true, options: ["a", "b"] }
    });
  });

  it("el nombre y el contenido llegan al snapshot con el vocabulario del modelo", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", {
        name: "Preguntar nombre",
        content: { text: "¿Tu nombre?" }
      });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);

    expect(snapshot.nodes["n-pregunta"].name).toBe("Preguntar nombre");
    expect(snapshot.nodes["n-pregunta"].content).toEqual({ text: "¿Tu nombre?" });
  });

  it("configurar un nodo no altera identidad, posición ni metadatos en el snapshot", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);
    const nodo = snapshot.nodes["n-pregunta"];

    expect(nodo.id).toBe("n-pregunta");
    expect(nodo.type).toBe("question");
    expect(nodo.metadata.ui).toEqual({ x: 100, y: 200 });
  });

  it("configurar un nodo no altera las conexiones ni el entryNodeId", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);

    expect(snapshot.version.entryNodeId).toBe("n-inicio");
    expect(snapshot.edgesBySource["n-pregunta"]).toEqual([
      {
        id: "e-1",
        fromNodeId: "n-pregunta",
        toNodeId: "n-fin",
        priority: 10,
        isFallback: false,
        condition: { operator: "always" }
      }
    ]);
  });

  it("dos escrituras seguidas se acumulan en vez de pisarse", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.updateNode("n-pregunta", { config: { targetKey: "nombre" } });
    });
    act(() => {
      result.current.updateNode("n-pregunta", { name: "Preguntar nombre" });
    });

    const snapshot = mapCanvasToSnapshot(makeBaseSnapshot(), result.current.nodes, edges);

    expect(snapshot.nodes["n-pregunta"].config).toEqual({ targetKey: "nombre" });
    expect(snapshot.nodes["n-pregunta"].name).toBe("Preguntar nombre");
  });
});
