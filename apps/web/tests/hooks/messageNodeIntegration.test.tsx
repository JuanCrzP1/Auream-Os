import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasNodes } from "@features/automations/builder/hooks/canvas/useCanvasNodes";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import { mapSnapshotToCanvas } from "@features/automations/builder/adapters/mapSnapshotToCanvas";
import { findExpandedNodeId } from "@features/automations/builder/services/nodeExpansion";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Mensaje, de extremo a extremo dentro del builder.
//
// Las piezas ya están cubiertas por separado. Lo que se prueba aquí es la
// COSTURA: que abrir el nodo, configurarlo, moverlo y cerrarlo deje la
// configuración intacta y llegue al snapshot que viaja al backend.
//
// Es el tramo donde un fallo es invisible para el usuario hasta que recarga y
// descubre que su trabajo no estaba.
// ---------------------------------------------------------------------------

function makeMessageNode(id: string, isEntry = false): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 120, y: 240 },
    deletable: !isEntry,
    data: {
      nodeType: "message",
      title: "Mensaje",
      preview: "",
      configSummary: "",
      isEntry,
      isTerminal: false,
      content: {},
      config: {},
      metadata: { ui: { x: 120, y: 240 } }
    }
  };
}

const edges: CanvasEdge[] = [
  {
    id: "e-1",
    source: "m1",
    target: "m2",
    data: { priority: 10, isFallback: false, label: "Priority 10", condition: { operator: "always" } }
  }
];

const base: BuilderFlowSnapshot = {
  flow: { id: "f", key: "f", name: "Flow" },
  version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" },
  nodes: {},
  edgesBySource: {}
};

function renderCanvas() {
  const initial = [makeMessageNode("inicio", true), makeMessageNode("m1"), makeMessageNode("m2")];
  return renderHook(() => useCanvasNodes(initial, null));
}

/** Escribe una secuencia como lo haría el editor. */
const secuencia = (...textos: string[]) => ({
  items: textos.map((text, i) => ({ id: `i${i}`, kind: "text", text }))
});

describe("abrir y cerrar el nodo", () => {
  it("abre el nodo dentro del lienzo", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));

    expect(findExpandedNodeId(result.current.nodes)).toBe("m1");
  });

  it("lo cierra", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));
    act(() => result.current.collapseNodes());

    expect(findExpandedNodeId(result.current.nodes)).toBeNull();
  });

  it("abrir otro cierra el anterior", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));
    act(() => result.current.toggleNodeExpanded("m2"));

    expect(findExpandedNodeId(result.current.nodes)).toBe("m2");
  });
});

describe("la configuración sobrevive al recorrido completo", () => {
  it("se guarda en el config del nodo", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("Hola", "Adiós") }));

    const nodo = result.current.nodes.find((n) => n.id === "m1")!;
    expect(readMessageItems(nodo.data.config, nodo.data.content)).toHaveLength(2);
  });

  it("conserva el orden de los contenidos", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("uno", "dos", "tres") }));

    const nodo = result.current.nodes.find((n) => n.id === "m1")!;
    const textos = readMessageItems(nodo.data.config, nodo.data.content).map((item) =>
      item.kind === "text" ? item.text : ""
    );
    expect(textos).toEqual(["uno", "dos", "tres"]);
  });

  it("llega intacta al snapshot", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("uno", "dos") }));

    const snapshot = mapCanvasToSnapshot(base, result.current.nodes, edges);
    expect(snapshot.nodes.m1.config).toEqual(secuencia("uno", "dos"));
  });

  it("vuelve del snapshot al lienzo sin perderse", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("uno", "dos") }));

    const ida = mapCanvasToSnapshot(base, result.current.nodes, edges);
    const vuelta = mapSnapshotToCanvas(ida);
    const nodo = vuelta.nodes.find((n) => n.id === "m1")!;

    expect(readMessageItems(nodo.data.config, nodo.data.content)).toHaveLength(2);
  });

  it("sobrevive a abrir y cerrar el nodo", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("Hola") }));
    act(() => result.current.toggleNodeExpanded("m1"));
    act(() => result.current.collapseNodes());

    const nodo = result.current.nodes.find((n) => n.id === "m1")!;
    expect(nodo.data.config).toEqual(secuencia("Hola"));
  });

  it("sobrevive a mover el nodo por el lienzo", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("Hola") }));
    act(() =>
      result.current.handleNodesChange([
        { type: "position", id: "m1", position: { x: 800, y: 500 }, dragging: false }
      ])
    );

    const nodo = result.current.nodes.find((n) => n.id === "m1")!;
    expect(nodo.data.config).toEqual(secuencia("Hola"));
    expect(nodo.position).toEqual({ x: 800, y: 500 });
  });
});

describe("aislamiento entre nodos", () => {
  it("dos Mensajes tienen configuraciones independientes", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("soy m1") }));
    act(() => result.current.updateNode("m2", { config: secuencia("soy m2") }));

    const snapshot = mapCanvasToSnapshot(base, result.current.nodes, edges);
    expect(snapshot.nodes.m1.config).toEqual(secuencia("soy m1"));
    expect(snapshot.nodes.m2.config).toEqual(secuencia("soy m2"));
  });

  it("configurar uno no toca al otro", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("solo m1") }));

    const m2 = result.current.nodes.find((n) => n.id === "m2")!;
    expect(m2.data.config).toEqual({});
  });
});

describe("el resumen de la tarjeta deriva de la configuración", () => {
  it("se actualiza solo, sin que nadie lo escriba a mano", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("Hola") }));

    expect(result.current.nodes.find((n) => n.id === "m1")!.data.preview).toBe("Texto · 1 bloque");
  });

  it("cuenta los bloques cuando hay varios", () => {
    const { result } = renderCanvas();

    act(() => result.current.updateNode("m1", { config: secuencia("Hola", "Adiós") }));

    expect(result.current.nodes.find((n) => n.id === "m1")!.data.preview).toBe("Texto · 2 bloques");
  });
});

describe("el lienzo no se degrada", () => {
  it("expandir y cerrar no altera las conexiones", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));
    const abierto = mapCanvasToSnapshot(base, result.current.nodes, edges);

    act(() => result.current.collapseNodes());
    const cerrado = mapCanvasToSnapshot(base, result.current.nodes, edges);

    expect(abierto.edgesBySource).toEqual(cerrado.edgesBySource);
    expect(cerrado.edgesBySource.m1).toHaveLength(1);
  });

  it("el nodo de entrada sigue protegido con un Mensaje abierto", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));
    act(() => result.current.handleNodesChange([{ type: "remove", id: "inicio" }]));

    expect(result.current.nodes.map((n) => n.id)).toContain("inicio");
  });

  it("expandir no altera la posición que se persiste", () => {
    const { result } = renderCanvas();

    const antes = mapCanvasToSnapshot(base, result.current.nodes, edges);
    act(() => result.current.toggleNodeExpanded("m1"));
    const durante = mapCanvasToSnapshot(base, result.current.nodes, edges);

    expect(durante.nodes.m1.metadata).toEqual(antes.nodes.m1.metadata);
    expect(durante.nodes.m1.metadata.ui).toEqual({ x: 120, y: 240 });
  });

  it("el gesto de cerrar del lienzo cierra el nodo abierto", () => {
    const { result } = renderCanvas();

    act(() => result.current.toggleNodeExpanded("m1"));
    // Es lo que `BuilderCanvas` invoca al hacer clic en el lienzo vacío.
    act(() => result.current.collapseNodes());

    expect(findExpandedNodeId(result.current.nodes)).toBeNull();
  });
});
