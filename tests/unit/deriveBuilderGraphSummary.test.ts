import { describe, expect, it } from "vitest";
import { deriveBuilderGraphSummary } from "../../domains/automations/builder/application/deriveBuilderGraphSummary.js";
import type { BuilderFlowSnapshot, NodeType } from "../../contracts/FlowSnapshot.js";

const tenantId = "tenant-test";

function snapshot(
  nodes: Array<[string, NodeType]>,
  edges: Array<[string, string]> = [],
  entryNodeId = "inicio"
): BuilderFlowSnapshot {
  return {
    flow: { id: "flow", key: "flow", name: "Flow" },
    version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId },
    nodes: Object.fromEntries(nodes.map(([id, type]) => [id, {
      id, type, name: id, content: {}, config: {}, metadata: {}
    }])),
    edgesBySource: edges.reduce<BuilderFlowSnapshot["edgesBySource"]>((bySource, [fromNodeId, toNodeId], index) => ({
      ...bySource,
      [fromNodeId]: [
        ...(bySource[fromNodeId] ?? []),
        { id: `e${index}`, fromNodeId, toNodeId, priority: index, isFallback: false, condition: { operator: "always" } }
      ]
    }), {})
  };
}

// ---------------------------------------------------------------------------
// Qué significa el punto del Hub.
//
// «Conectado» describe la TOPOLOGÍA que el usuario ve dibujada: hay un Inicio,
// todo cuelga de él y ninguna flecha está rota. NO describe si el flujo puede
// publicarse — eso lo decide `GraphValidator`, que además exige cerrar cada
// rama con `Finalizar`, un nodo que la paleta ni siquiera ofrece.
//
// Ningún caso de abajo necesita `Finalizar` para salir verde. Ese es el punto.
// ---------------------------------------------------------------------------

describe("deriveBuilderGraphSummary", () => {
  it("Inicio → Etiquetas está conectado, sin necesidad de Finalizar", () => {
    // El caso que se veía rojo con dos nodos unidos por una flecha real.
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"], ["etiquetas", "tags"]], [["inicio", "etiquetas"]]), tenantId))
      .toEqual({ nodeCount: 2, connectionStatus: "connected" });
  });

  it("Inicio → Etiquetas → otro nodo está conectado", () => {
    expect(deriveBuilderGraphSummary(snapshot(
      [["inicio", "message"], ["etiquetas", "tags"], ["aviso", "notification"]],
      [["inicio", "etiquetas"], ["etiquetas", "aviso"]]
    ), tenantId)).toEqual({ nodeCount: 3, connectionStatus: "connected" });
  });

  it("Inicio con un nodo suelto al lado está desconectado", () => {
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"], ["suelto", "tags"]]), tenantId))
      .toEqual({ nodeCount: 2, connectionStatus: "disconnected" });
  });

  it("Inicio solo, sin salida, está conectado: no hay nada suelto que conectar", () => {
    // Decisión documentada. La pregunta es «¿hay algo desconectado?» y la
    // respuesta es no: un único nodo es alcanzable desde sí mismo. Que ese
    // flujo no sirva todavía para publicar es cierto y lo dice otro sitio.
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"]]), tenantId))
      .toEqual({ nodeCount: 1, connectionStatus: "connected" });
  });

  it("un flujo que sí termina en Finalizar sigue estando conectado", () => {
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"], ["fin", "end"]], [["inicio", "fin"]]), tenantId))
      .toEqual({ nodeCount: 2, connectionStatus: "connected" });
  });

  it("una flecha que apunta a un nodo inexistente desconecta", () => {
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"]], [["inicio", "ausente"]]), tenantId).connectionStatus)
      .toBe("disconnected");
  });

  it("una rama entera inalcanzable desde Inicio desconecta", () => {
    expect(deriveBuilderGraphSummary(snapshot(
      [["inicio", "message"], ["a", "tags"], ["b", "notification"]],
      [["a", "b"]]
    ), tenantId).connectionStatus).toBe("disconnected");
  });

  it("cuenta cero nodos y marca el grafo vacío como desconectado", () => {
    expect(deriveBuilderGraphSummary(snapshot([]), tenantId))
      .toEqual({ nodeCount: 0, connectionStatus: "disconnected" });
  });

  it("un Inicio que no existe en el mapa de nodos desconecta", () => {
    expect(deriveBuilderGraphSummary(snapshot([["inicio", "message"], ["etiquetas", "tags"]], [["inicio", "etiquetas"]], "ausente"), tenantId).connectionStatus)
      .toBe("disconnected");
  });

  it("lo que sólo impide publicar NO desconecta", () => {
    // Pregunta sin salida por defecto, ciclo sin condición y nodo sin cerrar:
    // los tres son errores de publicación en `GraphValidator` y ninguno rompe
    // la topología. Si alguno volviera a pintar rojo, la mezcla habría vuelto.
    const preguntaSinFallback = snapshot([["inicio", "question"], ["destino", "tags"]], [["inicio", "destino"]]);
    const ciclo = snapshot([["inicio", "message"], ["b", "message"]], [["inicio", "b"], ["b", "inicio"]]);
    const sinCerrar = snapshot([["inicio", "message"], ["etiquetas", "tags"]], [["inicio", "etiquetas"]]);

    for (const caso of [preguntaSinFallback, ciclo, sinCerrar]) {
      expect(deriveBuilderGraphSummary(caso, tenantId).connectionStatus).toBe("connected");
    }
  });
});
