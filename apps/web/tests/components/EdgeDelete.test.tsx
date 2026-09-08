import { describe, it, expect, beforeAll, vi } from "vitest";
import { useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Position, ReactFlow, ReactFlowProvider, getBezierPath, type EdgeProps, type OnEdgesChange } from "@xyflow/react";
import { DeletableEdge } from "@features/automations/builder/components/canvas/DeletableEdge";
import { edgeTypes } from "@features/automations/builder/components/canvas/edgeTypes";
import { useCanvasEdges } from "@features/automations/builder/hooks/canvas/useCanvasEdges";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Eliminar una conexión desde el lienzo.
//
// POR QUÉ EL ARNÉS ES ASÍ, que no es capricho: React Flow no dibuja una arista
// hasta haber MEDIDO los dos nodos que une, y en jsdom nada mide —no hay
// layout—, así que un `<ReactFlow>` montado aquí renderiza cero aristas por
// mucho nodo que se le pase. Comprobado antes de escribir esto.
//
// Así que se monta el `<ReactFlow>` de verdad —él es quien crea el portal de
// `EdgeLabelRenderer` y quien guarda las aristas en su store— y se pinta
// `DeletableEdge` con las mismas props que él le pasaría. Lo que se ejercita es
// real: el store, `deleteElements`, `onEdgesChange` y la lista de
// `useCanvasEdges`. Lo único simulado es la geometría, que en un navegador sale
// de una medición y aquí se declara.
//
// Lo que este entorno NO puede probar —seleccionar con el ratón, deseleccionar
// pulsando el lienzo, Supr/Retroceso— se verifica en Chrome real, porque
// depende de esa misma medición que aquí no existe.
// ---------------------------------------------------------------------------

beforeAll(() => {
  // React Flow observa el tamaño del contenedor al montar.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

const GEOMETRIA = {
  sourceX: 100,
  sourceY: 100,
  targetX: 460,
  targetY: 260,
  sourcePosition: Position.Right,
  targetPosition: Position.Left
};

const NODOS: CanvasNode[] = [
  { id: "inicio", type: "flowNode", position: { x: 0, y: 0 }, data: { title: "Inicio", nodeType: "message" } as never },
  { id: "etiquetas", type: "flowNode", position: { x: 360, y: 160 }, data: { title: "Etiquetas", nodeType: "tags" } as never }
];

function edge(id: string, source: string, target: string, selected = false): CanvasEdge {
  return {
    id,
    source,
    target,
    type: "deletable",
    selected,
    data: { priority: 10, isFallback: false, label: "Priority 10", condition: { operator: "always" } }
  };
}

/**
 * El lienzo con su estado real de aristas. `useCanvasEdges` es la única lista;
 * no hay copia paralela para el test.
 */
function Lienzo({ inicial, alCambiar, alMontar }: {
  inicial: CanvasEdge[];
  alCambiar?: (edges: CanvasEdge[]) => void;
  alMontar?: (cambiar: OnEdgesChange<CanvasEdge>) => void;
}) {
  const { edges, handleEdgesChange } = useCanvasEdges(inicial, null);
  alCambiar?.(edges);
  alMontar?.(handleEdgesChange);

  return (
    <ReactFlowProvider>
      <ReactFlow nodes={NODOS} edges={edges} edgeTypes={edgeTypes} onEdgesChange={handleEdgesChange} />
      {edges.map((e) => (
        <DeletableEdge key={e.id} {...({ ...GEOMETRIA, id: e.id, source: e.source, target: e.target, selected: e.selected, data: e.data } as unknown as EdgeProps<CanvasEdge>)} />
      ))}
    </ReactFlowProvider>
  );
}

function papeleras() {
  return screen.queryAllByRole("button", { name: "Eliminar conexión" });
}

describe("eliminar una conexión desde el lienzo", () => {
  it("A. una conexión no seleccionada no ofrece ninguna acción", () => {
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas")]} />);
    expect(papeleras()).toHaveLength(0);
  });

  it("B. al seleccionarla aparece el botón de eliminar", () => {
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas", true)]} />);
    expect(papeleras()).toHaveLength(1);
  });

  it("C. el botón se anuncia como «Eliminar conexión»", () => {
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas", true)]} />);
    const boton = screen.getByRole("button", { name: "Eliminar conexión" });

    expect(boton).toHaveAttribute("aria-label", "Eliminar conexión");
    expect(boton).toHaveAttribute("title", "Eliminar conexión");
    expect(boton.tagName).toBe("BUTTON");
    // El icono es un SVG del proyecto, no un emoji ni un carácter Unicode
    // disfrazado de icono: el botón no tiene texto propio.
    expect(boton.querySelector("svg")).not.toBeNull();
    expect(boton.textContent).toBe("");
  });

  it("D. al pulsarlo la conexión desaparece de la lista del lienzo", async () => {
    let ultimas: CanvasEdge[] = [];
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas", true)]} alCambiar={(e) => { ultimas = e; }} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar conexión" }));

    expect(ultimas).toHaveLength(0);
    expect(papeleras()).toHaveLength(0);
  });

  it("E. eliminar la conexión no toca los nodos que unía", async () => {
    let ultimas: CanvasEdge[] = [];
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas", true)]} alCambiar={(e) => { ultimas = e; }} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar conexión" }));

    const snapshot = mapCanvasToSnapshot(BASE, NODOS, ultimas);
    expect(Object.keys(snapshot.nodes).sort()).toEqual(["etiquetas", "inicio"]);
  });

  it("F. el botón pertenece únicamente a la conexión seleccionada", async () => {
    let ultimas: CanvasEdge[] = [];
    render(
      <Lienzo
        inicial={[edge("e1", "inicio", "etiquetas"), edge("e2", "etiquetas", "inicio", true)]}
        alCambiar={(e) => { ultimas = e; }}
      />
    );

    expect(papeleras()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar conexión" }));

    // Se fue la seleccionada; la otra sigue entera.
    expect(ultimas.map((e) => e.id)).toEqual(["e1"]);
  });

  it("G. deseleccionar retira la acción sin tocar la conexión", () => {
    let ultimas: CanvasEdge[] = [];
    let cambiar: OnEdgesChange<CanvasEdge> = () => {};
    render(
      <Lienzo
        inicial={[edge("e1", "inicio", "etiquetas", true)]}
        alCambiar={(e) => { ultimas = e; }}
        alMontar={(c) => { cambiar = c; }}
      />
    );
    expect(papeleras()).toHaveLength(1);

    // Exactamente lo que React Flow emite al pulsar el lienzo vacío.
    act(() => cambiar([{ id: "e1", type: "select", selected: false }]));

    expect(papeleras()).toHaveLength(0);
    // Deseleccionar no borra: la conexión sigue ahí.
    expect(ultimas.map((e) => e.id)).toEqual(["e1"]);
  });

  it("H. el snapshot que consume el autoguardado pierde la conexión y conserva la otra", async () => {
    let ultimas: CanvasEdge[] = [];
    render(
      <Lienzo
        inicial={[edge("e1", "inicio", "etiquetas", true), edge("e2", "etiquetas", "inicio")]}
        alCambiar={(e) => { ultimas = e; }}
      />
    );

    const antes = mapCanvasToSnapshot(BASE, NODOS, ultimas);
    expect(antes.edgesBySource.inicio).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar conexión" }));

    const despues = mapCanvasToSnapshot(BASE, NODOS, ultimas);
    // El autoguardado compara la firma del borrador: si el snapshot no cambiara,
    // no habría nada que guardar y el borrado no llegaría al servidor.
    expect(despues.edgesBySource.inicio).toBeUndefined();
    expect(despues.edgesBySource.etiquetas).toHaveLength(1);
    expect(JSON.stringify(despues)).not.toBe(JSON.stringify(antes));
  });

  it("I. un cambio `remove` —el que emiten Supr y Retroceso— elimina la conexión", () => {
    // Supr/Retroceso no crean un camino propio: React Flow emite el mismo
    // cambio `remove` que `deleteElements`, y `useCanvasEdges` ya lo aplicaba
    // antes de esta tarea. Esto fija que se siga aplicando.
    let ultimas: CanvasEdge[] = [];
    function Sonda() {
      const { edges, handleEdgesChange } = useCanvasEdges([edge("e1", "inicio", "etiquetas", true)], null);
      ultimas = edges;
      return <button onClick={() => handleEdgesChange([{ id: "e1", type: "remove" }])}>tecla</button>;
    }
    render(<Sonda />);

    fireEvent.click(screen.getByText("tecla"));

    expect(ultimas).toHaveLength(0);
  });

  it("J. el botón se coloca en el punto medio real de la curva bézier", () => {
    render(<Lienzo inicial={[edge("e1", "inicio", "etiquetas", true)]} />);

    const [, x, y] = getBezierPath(GEOMETRIA);
    expect(screen.getByRole("button", { name: "Eliminar conexión" })).toHaveStyle({
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`
    });
  });
});

const BASE: BuilderFlowSnapshot = {
  flow: { id: "f", key: "f", name: "F" },
  version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" },
  nodes: {},
  edgesBySource: {}
};

// Silencia el aviso de React Flow por el contenedor de tamaño cero en jsdom.
vi.spyOn(console, "warn").mockImplementation(() => {});
