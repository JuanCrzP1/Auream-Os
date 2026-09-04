import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import {
  isEntryNode,
  rejectEntryNodeRemoval
} from "@features/automations/builder/services/entryNodeProtection";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Protección del nodo de entrada.
//
// El defecto que estos tests existen para impedir: borrar el nodo de entrada
// deja `version.entryNodeId` apuntando a un id inexistente, el autoguardado
// persiste ese grafo y el fallo no aparece hasta publicar.
//
// Se prueba el filtro, no la tecla: quién emite el cambio `remove` —el teclado
// de React Flow, un botón, una acción futura— es indiferente. Lo que se fija es
// que ese cambio no sobreviva, y que mover sí sobreviva.
// ---------------------------------------------------------------------------

function makeNode(id: string, isEntry: boolean): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 0, y: 0 },
    data: {
      nodeType: "message",
      title: id,
      preview: "",
      configSummary: "",
      isEntry,
      isTerminal: false,
      content: {},
      config: {},
      metadata: {}
    }
  };
}

const nodes: CanvasNode[] = [makeNode("inicio", true), makeNode("saludo", false)];

describe("isEntryNode", () => {
  it("reconoce el nodo de entrada", () => {
    expect(isEntryNode(nodes, "inicio")).toBe(true);
  });

  it("no confunde a los demás nodos con la entrada", () => {
    expect(isEntryNode(nodes, "saludo")).toBe(false);
  });

  it("devuelve false para un id que no está en el lienzo", () => {
    expect(isEntryNode(nodes, "fantasma")).toBe(false);
  });
});

describe("rejectEntryNodeRemoval", () => {
  it("descarta el borrado del nodo de entrada", () => {
    const changes: NodeChange<CanvasNode>[] = [{ type: "remove", id: "inicio" }];

    expect(rejectEntryNodeRemoval(changes, nodes)).toEqual([]);
  });

  it("deja pasar el borrado de cualquier otro nodo", () => {
    const changes: NodeChange<CanvasNode>[] = [{ type: "remove", id: "saludo" }];

    expect(rejectEntryNodeRemoval(changes, nodes)).toEqual(changes);
  });

  it("descarta solo la entrada cuando el borrado es múltiple", () => {
    const changes: NodeChange<CanvasNode>[] = [
      { type: "remove", id: "inicio" },
      { type: "remove", id: "saludo" }
    ];

    expect(rejectEntryNodeRemoval(changes, nodes)).toEqual([{ type: "remove", id: "saludo" }]);
  });

  it("deja mover el nodo de entrada: mover no es borrar", () => {
    const changes: NodeChange<CanvasNode>[] = [
      { type: "position", id: "inicio", position: { x: 400, y: 220 }, dragging: true }
    ];

    expect(rejectEntryNodeRemoval(changes, nodes)).toEqual(changes);
  });

  it("deja seleccionar y redimensionar el nodo de entrada", () => {
    const changes: NodeChange<CanvasNode>[] = [
      { type: "select", id: "inicio", selected: true },
      { type: "dimensions", id: "inicio", dimensions: { width: 240, height: 120 } }
    ];

    expect(rejectEntryNodeRemoval(changes, nodes)).toEqual(changes);
  });
});
