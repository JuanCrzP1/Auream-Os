import { describe, expect, it } from "vitest";
import {
  collapseAllNodes,
  findExpandedNodeId,
  toggleNodeExpansion
} from "@features/automations/builder/services/nodeExpansion";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Apertura de un nodo dentro del lienzo.
//
// Lo que se fija aquí no es «se pone a true», sino las tres propiedades de las
// que depende que abrir un nodo no degrade el lienzo:
//
//   1. como mucho uno abierto;
//   2. los nodos que NO cambian conservan su referencia, para que abrir uno no
//      repinte el lienzo entero;
//   3. la apertura no llega al snapshot: es estado de viewport, no intención.
// ---------------------------------------------------------------------------

function makeNode(id: string, isEntry = false): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 0, y: 0 },
    deletable: !isEntry,
    data: {
      nodeType: "message",
      title: id,
      preview: "",
      configSummary: "",
      isEntry,
      isTerminal: false,
      content: { text: "hola" },
      config: {},
      metadata: { ui: { x: 0, y: 0 } }
    }
  };
}

const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];

describe("toggleNodeExpansion", () => {
  it("abre el nodo pedido", () => {
    expect(findExpandedNodeId(toggleNodeExpansion(nodes, "b"))).toBe("b");
  });

  it("cierra el que estuviera abierto: solo uno a la vez", () => {
    const conA = toggleNodeExpansion(nodes, "a");
    const conB = toggleNodeExpansion(conA, "b");

    expect(conB.filter((node) => node.data.isExpanded).map((node) => node.id)).toEqual(["b"]);
  });

  it("conmuta: pedirlo dos veces lo cierra", () => {
    const abierto = toggleNodeExpansion(nodes, "a");

    expect(findExpandedNodeId(toggleNodeExpansion(abierto, "a"))).toBeNull();
  });

  // El editor ya no vive dentro del nodo de React Flow —flota aparte, anclado
  // a él—, así que el nodo compacto se arrastra igual esté o no abierto su
  // editor. Fijar aquí un `dragHandle` sería el bug exacto que existió: un
  // selector que no está dentro del nodo deja el nodo entero sin arrastrarse.
  it("nunca acota el arrastre del nodo compacto, esté o no abierto su editor", () => {
    const abierto = toggleNodeExpansion(nodes, "a");

    expect(abierto.find((n) => n.id === "a")!.dragHandle).toBeUndefined();
    expect(toggleNodeExpansion(abierto, "a").find((n) => n.id === "a")!.dragHandle).toBeUndefined();
  });

  it("eleva el nodo abierto por encima de sus vecinos", () => {
    const nodo = toggleNodeExpansion(nodes, "a").find((n) => n.id === "a")!;

    expect(nodo.zIndex).toBeGreaterThan(0);
  });

  it("conserva la referencia de los nodos que no cambian", () => {
    const abierto = toggleNodeExpansion(nodes, "a");

    expect(abierto[1]).toBe(nodes[1]);
    expect(abierto[2]).toBe(nodes[2]);
  });

  it("no toca posición, identidad ni configuración", () => {
    const nodo = toggleNodeExpansion(nodes, "a").find((n) => n.id === "a")!;

    expect(nodo.id).toBe("a");
    expect(nodo.position).toEqual({ x: 0, y: 0 });
    expect(nodo.data.content).toEqual({ text: "hola" });
  });

  it("no desprotege el nodo de entrada al abrirlo", () => {
    const conEntrada = [makeNode("inicio", true), makeNode("b")];
    const nodo = toggleNodeExpansion(conEntrada, "inicio").find((n) => n.id === "inicio")!;

    expect(nodo.deletable).toBe(false);
    expect(nodo.data.isEntry).toBe(true);
  });

  it("ignora un id que no está en el lienzo", () => {
    expect(findExpandedNodeId(toggleNodeExpansion(nodes, "fantasma"))).toBeNull();
  });
});

describe("collapseAllNodes", () => {
  it("cierra el que hubiera", () => {
    expect(findExpandedNodeId(collapseAllNodes(toggleNodeExpansion(nodes, "a")))).toBeNull();
  });

  it("no crea objetos nuevos si no había ninguno abierto", () => {
    const cerrados = collapseAllNodes(nodes);

    expect(cerrados[0]).toBe(nodes[0]);
  });
});

describe("la apertura no se guarda", () => {
  const base: BuilderFlowSnapshot = {
    flow: { id: "f", key: "f", name: "Flow" },
    version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "a" },
    nodes: {},
    edgesBySource: {}
  };

  it("no aparece en el snapshot: es viewport, no intención del usuario", () => {
    const abierto = toggleNodeExpansion(nodes, "a");
    const snapshot = mapCanvasToSnapshot(base, abierto, []);
    const nodo = snapshot.nodes.a;

    expect(nodo.content).not.toHaveProperty("isExpanded");
    expect(nodo.config).not.toHaveProperty("isExpanded");
    expect(nodo.metadata).not.toHaveProperty("isExpanded");
  });

  it("un flujo guardado con un nodo abierto es idéntico a uno con todos cerrados", () => {
    const abierto = mapCanvasToSnapshot(base, toggleNodeExpansion(nodes, "a"), []);
    const cerrado = mapCanvasToSnapshot(base, nodes, []);

    expect(abierto).toEqual(cerrado);
  });
});
