import { describe, expect, it } from "vitest";
import { START_NODE_TYPE, ensureStartEntry } from "../../contracts/FlowEntry.js";
import type { BuilderFlowNode, BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";

function node(id: string, type: BuilderFlowNode["type"], extra: Partial<BuilderFlowNode> = {}): BuilderFlowNode {
  return { id, type, name: id, content: {}, config: {}, metadata: { ui: { x: 500, y: 300 } }, ...extra };
}

function snapshot(entryNodeId: string, nodes: BuilderFlowNode[], edgesBySource: BuilderFlowSnapshot["edgesBySource"] = {}): BuilderFlowSnapshot {
  return {
    flow: { id: "f", key: "f", name: "F" },
    version: { id: "v", versionNumber: 1, status: "draft", entryNodeId },
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edgesBySource
  };
}

const always = { operator: "always" as const };

describe("ensureStartEntry — migración al bloque de inicio", () => {
  it("no toca un flujo que ya arranca en `start` (devuelve el mismo objeto)", () => {
    const flow = snapshot("start", [node("start", "start")]);
    expect(ensureStartEntry(flow)).toBe(flow);
  });

  it("convierte el antiguo inicio sembrado en `start`, en su sitio y con sus conexiones", () => {
    const edge = { id: "e1", fromNodeId: "start_message", toNodeId: "tags", priority: 10, isFallback: false, condition: always };
    const flow = snapshot(
      "start_message",
      [node("start_message", "message", { name: "Inicio", content: { text: "Inicio del flujo" } }), node("tags", "tags")],
      { start_message: [edge] }
    );

    const upgraded = ensureStartEntry(flow);
    const entry = upgraded.nodes.start_message;

    expect(upgraded.version.entryNodeId).toBe("start_message");
    expect(entry.type).toBe(START_NODE_TYPE);
    expect(entry.content).toEqual({});
    expect(entry.metadata).toEqual({ ui: { x: 500, y: 300 } });
    expect(upgraded.edgesBySource.start_message).toEqual([edge]);
  });

  it("si la entrada es un bloque real, inserta `start` delante sin perder su contenido", () => {
    const greeting = node("hola", "message", { content: { text: "¡Hola! ¿En qué te ayudo?" } });
    const upgraded = ensureStartEntry(snapshot("hola", [greeting]));
    const startId = upgraded.version.entryNodeId;

    expect(upgraded.nodes[startId].type).toBe(START_NODE_TYPE);
    expect(upgraded.nodes.hola).toEqual(greeting);
    expect(upgraded.edgesBySource[startId]).toEqual([
      expect.objectContaining({ fromNodeId: startId, toNodeId: "hola" })
    ]);
    // A la izquierda del bloque al que apunta.
    expect((upgraded.nodes[startId].metadata.ui as { x: number }).x).toBeLessThan(500);
  });

  it("no pisa un nodo que ya se llame `start`", () => {
    const upgraded = ensureStartEntry(snapshot("hola", [node("start", "message"), node("hola", "message")]));
    expect(upgraded.version.entryNodeId).toBe("start_2");
    expect(upgraded.nodes.start.type).toBe("message");
  });

  it("repara un flujo cuya entrada no existe creando el inicio", () => {
    const upgraded = ensureStartEntry(snapshot("start_message", []));
    const startId = upgraded.version.entryNodeId;

    expect(upgraded.nodes[startId].type).toBe(START_NODE_TYPE);
    expect(Object.keys(upgraded.nodes)).toEqual([startId]);
  });
});
