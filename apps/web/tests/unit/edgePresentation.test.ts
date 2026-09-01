import { describe, expect, it } from "vitest";
import {
  buildEdgePresentation,
  EDGE_GRADIENT_ID,
  EDGE_GRADIENT_END
} from "@features/automations/builder/services/buildEdgePresentation";
import { ensureEdgeData } from "@features/automations/builder/services/ensureEdgeData";
import { mapSnapshotToCanvas } from "@features/automations/builder/adapters/mapSnapshotToCanvas";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Frontera entre el modelo del edge y su representación en el lienzo.
//
// `priority` ordena las salidas de un nodo y la usa el `EdgeEvaluator` del
// motor. Es un detalle de ejecución, no información que quien construye el
// flujo deba leer rotulada sobre cada línea.
//
// Estos tests fijan las dos mitades del acuerdo: la prioridad NO se pinta, y
// sigue viva en el modelo y en el snapshot que viaja al backend.
// ---------------------------------------------------------------------------

const snapshot: BuilderFlowSnapshot = {
  flow: { id: "flow-1", key: "flow-1", name: "Flow" },
  version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "a" },
  nodes: {
    a: { id: "a", type: "message", name: "Inicio", content: { text: "hola" }, config: {}, metadata: {} },
    b: { id: "b", type: "end", name: "Fin", content: { text: "adiós" }, config: {}, metadata: {} }
  },
  edgesBySource: {
    a: [
      { id: "e1", fromNodeId: "a", toNodeId: "b", priority: 7, isFallback: false, condition: { operator: "always" } },
      { id: "e2", fromNodeId: "a", toNodeId: "b", priority: 9, isFallback: true, condition: { operator: "always" } }
    ]
  }
};

describe("presentación del edge", () => {
  it("no rotula la prioridad en el lienzo", () => {
    const presentation = buildEdgePresentation({
      priority: 10,
      isFallback: false,
      label: "Priority 10",
      condition: { operator: "always" }
    });

    expect(presentation.label).toBeUndefined();
  });

  it("sí rotula el fallback, que es la única etiqueta con significado", () => {
    const presentation = buildEdgePresentation({
      priority: 99,
      isFallback: true,
      label: "Fallback",
      condition: { operator: "always" }
    });

    expect(presentation.label).toBe("Fallback");
  });

  it("conserva el resto de la presentación: trazo, marcador y animación", () => {
    const normal = buildEdgePresentation(ensureEdgeData({ priority: 3 }));

    expect(normal.style.stroke).toBeTruthy();
    expect(normal.style.strokeWidth).toBeGreaterThan(0);
    expect(normal.markerEnd.type).toBeTruthy();
    expect(normal.animated).toBe(false);
  });

  it("pinta la conexión normal con el degradado azul → violeta", () => {
    const normal = buildEdgePresentation(ensureEdgeData({ priority: 1 }));

    expect(normal.style.stroke).toBe(`url(#${EDGE_GRADIENT_ID})`);
    expect(normal.markerEnd.color).toBe(EDGE_GRADIENT_END);
  });

  it("el fallback conserva su ámbar sólido: es semántica, no decoración", () => {
    const fallback = buildEdgePresentation(ensureEdgeData({ isFallback: true }));

    expect(fallback.style.stroke).toBe("#f59e0b");
    expect(fallback.markerEnd.color).toBe("#f59e0b");
    expect(fallback.animated).toBe(true);
  });

  it("mantiene el trazo fino: la conexión no se convierte en una banda", () => {
    const normal = buildEdgePresentation(ensureEdgeData({}));

    expect(normal.style.strokeWidth).toBeLessThanOrEqual(2.5);
  });

  it("ningún valor visible del edge menciona la prioridad", () => {
    const visible = Object.values(buildEdgePresentation(ensureEdgeData({ priority: 42 })))
      .filter((value) => typeof value === "string")
      .join(" ");

    expect(visible.toLowerCase()).not.toContain("priority");
  });
});

describe("integridad del modelo del edge", () => {
  it("la prioridad sobrevive al viaje snapshot → lienzo", () => {
    const canvas = mapSnapshotToCanvas(snapshot);

    expect(canvas.edges.map((edge) => edge.data?.priority)).toEqual([7, 9]);
  });

  it("la prioridad sobrevive al viaje de vuelta lienzo → snapshot", () => {
    const canvas = mapSnapshotToCanvas(snapshot);
    const roundTrip = mapCanvasToSnapshot(snapshot, canvas.nodes, canvas.edges);

    const edges = roundTrip.edgesBySource["a"] ?? [];
    expect(edges.map((edge) => edge.priority)).toEqual([7, 9]);
    expect(edges.map((edge) => edge.isFallback)).toEqual([false, true]);
  });

  it("el orden por prioridad se mantiene al serializar", () => {
    const canvas = mapSnapshotToCanvas(snapshot);
    // Se invierte el orden en el lienzo: la serialización debe reordenarlo.
    const reversed = [...canvas.edges].reverse();
    const roundTrip = mapCanvasToSnapshot(snapshot, canvas.nodes, reversed);

    const priorities = (roundTrip.edgesBySource["a"] ?? []).map((edge) => edge.priority);
    expect(priorities).toEqual([...priorities].sort((left, right) => left - right));
  });
});
