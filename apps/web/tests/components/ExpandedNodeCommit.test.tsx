import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { ExpandedNodeOverlay } from "@features/automations/builder/components/canvas/ExpandedNodeOverlay";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// De «Guardar» al grafo.
//
// Aquí se fija la frontera que separa los dos conceptos:
//
//   Guardar (editor) → `updateNode`, y ahí termina su recorrido
//   autosave (lienzo) → persiste el snapshot, y no se entera de quién lo cambió
//
// Que este archivo no importe NADA de persistencia no es un descuido: es la
// prueba. Si algún día «Guardar» necesitara conocer el transporte, estos tests
// tendrían que empezar a montarlo, y eso sería la señal de que la separación
// se rompió.
// ---------------------------------------------------------------------------

function nodoAbierto(): CanvasNode {
  return {
    id: "n1",
    type: "flowNode",
    position: { x: 120, y: 80 },
    data: {
      nodeType: "message",
      title: "Saludo",
      preview: "",
      configSummary: "",
      isEntry: false,
      isTerminal: false,
      isExpanded: true,
      content: {},
      config: { items: [] },
      metadata: { ui: { x: 120, y: 80 } }
    }
  };
}

const nodos = [nodoAbierto()];

vi.mock("@xyflow/react", async () => {
  const real = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return { ...real, useNodes: () => nodos };
});

function montar() {
  const updateNode = vi.fn();
  const toggleExpand = vi.fn();

  const utils = render(
    <ReactFlowProvider>
      <BuilderEditingProvider
        requestEdit={vi.fn()}
        toggleExpand={toggleExpand}
        updateNode={updateNode}
        duplicateNode={vi.fn()}
        removeNode={vi.fn()}
      >
        <ExpandedNodeOverlay />
      </BuilderEditingProvider>
    </ReactFlowProvider>
  );

  return { ...utils, updateNode, toggleExpand };
}

describe("confirmar los cambios de una herramienta", () => {
  it("escribir en el editor no toca el grafo", () => {
    const { updateNode } = montar();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(updateNode).not.toHaveBeenCalled();
  });

  it("Guardar baja al nodo por el mutador que ya existe, y solo eso", () => {
    const { updateNode } = montar();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateNode).toHaveBeenCalledTimes(1);

    const [nodeId, patch] = updateNode.mock.calls[0];
    expect(nodeId).toBe("n1");
    // NO hay un segundo camino de persistencia: lo único que sale de aquí es un
    // parche de configuración para el mismo `updateNode` que usa el resto del
    // builder. Quien lo persiste después es el autoguardado del lienzo, que ni
    // se menciona en este archivo.
    expect(Object.keys(patch).sort()).toEqual(["config", "content", "name"]);
    expect((patch.config.items as unknown[]).length).toBe(1);
  });

  it("no toca la posición ni las conexiones del nodo", () => {
    const { updateNode } = montar();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const [, patch] = updateNode.mock.calls[0];
    // El nodo de React Flow sigue siendo suyo: handles, aristas y posición no
    // pasan por el editor ni pueden hacerlo — el parche no tiene dónde meterlos.
    expect(patch).not.toHaveProperty("position");
    expect(patch).not.toHaveProperty("id");
    expect(nodos[0].position).toEqual({ x: 120, y: 80 });
  });

  it("Cancelar cierra el editor sin escribir en el grafo", () => {
    const { updateNode, toggleExpand } = montar();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(updateNode).not.toHaveBeenCalled();
    expect(toggleExpand).toHaveBeenCalledWith("n1");
  });
});
