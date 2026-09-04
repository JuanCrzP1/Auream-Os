import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasNodes } from "@features/automations/builder/hooks/canvas/useCanvasNodes";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// El nodo de entrada, en el dueño del estado.
//
// El módulo puro ya cubre el filtro. Aquí se prueba lo que de verdad importa:
// que ese filtro esté CONECTADO al único camino por el que el lienzo borra, y
// que la protección no se lleve por delante el arrastre.
// ---------------------------------------------------------------------------

function makeNode(id: string, isEntry: boolean): CanvasNode {
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
      content: {},
      config: {},
      metadata: {}
    }
  };
}

function renderCanvasNodes() {
  const initial = [makeNode("inicio", true), makeNode("saludo", false)];
  return renderHook(() => useCanvasNodes(initial, null));
}

describe("useCanvasNodes — nodo de entrada", () => {
  it("no lo borra por el cambio que emite la tecla Suprimir", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.handleNodesChange([{ type: "remove", id: "inicio" }]);
    });

    expect(result.current.nodes.map((node) => node.id)).toEqual(["inicio", "saludo"]);
  });

  it("sí borra cualquier otro nodo por esa misma vía", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.handleNodesChange([{ type: "remove", id: "saludo" }]);
    });

    expect(result.current.nodes.map((node) => node.id)).toEqual(["inicio"]);
  });

  it("no lo borra por `removeNode`, la vía del botón de la tarjeta", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.removeNode("inicio");
    });

    expect(result.current.nodes.map((node) => node.id)).toEqual(["inicio", "saludo"]);
  });

  it("lo deja mover: la posición se aplica", () => {
    const { result } = renderCanvasNodes();

    act(() => {
      result.current.handleNodesChange([
        { type: "position", id: "inicio", position: { x: 480, y: 300 }, dragging: false }
      ]);
    });

    const entrada = result.current.nodes.find((node) => node.id === "inicio");
    expect(entrada?.position).toEqual({ x: 480, y: 300 });
  });

  it("responde que no se puede borrar, para que el coordinador aborte las dos mitades", () => {
    const { result } = renderCanvasNodes();

    expect(result.current.canRemoveNode("inicio")).toBe(false);
    expect(result.current.canRemoveNode("saludo")).toBe(true);
  });
});
