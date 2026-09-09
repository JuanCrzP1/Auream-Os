import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasEdges } from "@features/automations/builder/hooks/canvas/useCanvasEdges";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import { mapSnapshotToCanvas } from "@features/automations/builder/adapters/mapSnapshotToCanvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Conectar DESDE una salida concreta de un nodo.
//
// React Flow entrega `sourceHandle` en la conexión; el hook lo descartaba. Con
// un nodo de una sola salida no se notaba, pero un nodo con dos —Esperar
// respuesta: respondió / se agotó el tiempo— necesita que ese dato sobreviva,
// primero al crear la arista y luego al guardarla.
//
// Se recorre el camino completo —conectar → serializar → recuperar— porque es
// justo la composición donde el dato se perdía.
// ---------------------------------------------------------------------------

function snapshotBase(): BuilderFlowSnapshot {
  return {
    flow: { id: "f", tenantId: "t", key: "k", name: "n", currentPublishedVersionId: null },
    version: {
      id: "v",
      tenantId: "t",
      flowId: "f",
      versionNumber: 1,
      status: "draft",
      entryNodeId: "espera"
    },
    nodes: {
      espera: {
        id: "espera",
        tenantId: "t",
        flowVersionId: "v",
        type: "question",
        name: "Esperar respuesta",
        content: {},
        config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } },
        metadata: { ui: { x: 0, y: 0 } }
      },
      contesto: {
        id: "contesto",
        tenantId: "t",
        flowVersionId: "v",
        type: "message",
        name: "Contestó",
        content: { text: "gracias" },
        config: {},
        metadata: { ui: { x: 300, y: 0 } }
      },
      caduco: {
        id: "caduco",
        tenantId: "t",
        flowVersionId: "v",
        type: "message",
        name: "Se agotó",
        content: { text: "¿sigues ahí?" },
        config: {},
        metadata: { ui: { x: 300, y: 200 } }
      }
    },
    edgesBySource: {}
  } as unknown as BuilderFlowSnapshot;
}

describe("conectar desde cada salida de un nodo", () => {
  it("cada camino nace con la salida de la que se tiró", () => {
    const { result } = renderHook(() => useCanvasEdges([], null));

    act(() => {
      result.current.handleConnect({
        source: "espera",
        target: "contesto",
        sourceHandle: "respuesta",
        targetHandle: null
      });
    });
    act(() => {
      result.current.handleConnect({
        source: "espera",
        target: "caduco",
        sourceHandle: "tiempo-agotado",
        targetHandle: null
      });
    });

    expect(result.current.edges).toHaveLength(2);
    expect(result.current.edges[0].sourceHandle).toBe("respuesta");
    expect(result.current.edges[1].sourceHandle).toBe("tiempo-agotado");
    // Dos aristas distintas hacia dos nodos distintos: son dos caminos, no una
    // conexión duplicada.
    expect(result.current.edges[0].target).toBe("contesto");
    expect(result.current.edges[1].target).toBe("caduco");
  });

  it("una conexión de un nodo de salida única sigue naciendo sin handle", () => {
    // No regresión para las otras doce herramientas: React Flow entrega `null`
    // y la arista no gana un campo vacío.
    const { result } = renderHook(() => useCanvasEdges([], null));

    act(() => {
      result.current.handleConnect({
        source: "contesto",
        target: "caduco",
        sourceHandle: null,
        targetHandle: null
      });
    });

    expect(result.current.edges[0]).not.toHaveProperty("sourceHandle");
  });

  it("las dos salidas sobreviven a guardar y recargar el flujo", () => {
    const base = snapshotBase();
    const { result } = renderHook(() => useCanvasEdges([], null));

    act(() => {
      result.current.handleConnect({
        source: "espera",
        target: "contesto",
        sourceHandle: "respuesta",
        targetHandle: null
      });
    });
    act(() => {
      result.current.handleConnect({
        source: "espera",
        target: "caduco",
        sourceHandle: "tiempo-agotado",
        targetHandle: null
      });
    });

    const nodos = mapSnapshotToCanvas(base).nodes as CanvasNode[];
    const guardado = mapCanvasToSnapshot(base, nodos, result.current.edges);
    const recuperado = mapSnapshotToCanvas(guardado);

    const haciaContesto = recuperado.edges.find((edge) => edge.target === "contesto");
    const haciaCaduco = recuperado.edges.find((edge) => edge.target === "caduco");

    expect(haciaContesto?.sourceHandle).toBe("respuesta");
    expect(haciaCaduco?.sourceHandle).toBe("tiempo-agotado");
  });
});
