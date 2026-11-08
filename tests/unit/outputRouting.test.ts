import { describe, expect, it } from "vitest";
import { EdgeEvaluator } from "../../flow-engine/edges/EdgeEvaluator.js";
import { convertBuilderSnapshotToRuntime } from "../../domains/automations/builder/application/convertBuilderSnapshotToRuntime.js";
import { buildLoop, makeEnvelope, makeSession } from "./helpers/executionHarness.js";
import type { FlowEdge, FlowNode, FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { NodeExecutionResult, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Enrutar por salida (FASE C14): cada bloque declara por qué salida sale y el
// motor sigue la conexión de esa salida. Una salida sin conectar termina la
// rama limpiamente.
// ---------------------------------------------------------------------------

const T = "tenant-test";
const V = "v1";
const session = { context: {} } as unknown as Session;
const result = (output?: string): NodeExecutionResult => ({
  executionStatus: "success",
  ...(output !== undefined ? { output } : {}),
  outputMessages: [],
  contextPatch: {},
  nodeResult: {},
  domainEvents: []
});
const edge = (id: string, to: string, priority: number, fromOutput?: string): FlowEdge => ({
  id, tenantId: T, flowVersionId: V, fromNodeId: "n", toNodeId: to, priority, isFallback: false,
  condition: { operator: "always" }, ...(fromOutput !== undefined ? { fromOutput } : {})
});

describe("EdgeEvaluator — por salida", () => {
  const evaluator = new EdgeEvaluator();

  it("sigue la conexión de la salida declarada aunque otra tenga más prioridad", () => {
    const edges = [edge("a", "x", 1, "false"), edge("b", "y", 50, "true")];
    expect(evaluator.select(edges, session, result("true"))).toEqual({ kind: "edge", edge: edges[1] });
  });

  it("una salida sin conectar termina la rama (no es un fallo)", () => {
    expect(evaluator.select([edge("a", "x", 1, "true")], session, result("false"))).toEqual({
      kind: "unconnected-output",
      output: "false"
    });
  });

  it("un flujo antiguo sin salidas con nombre sigue por condiciones", () => {
    const edges = [edge("a", "x", 1)];
    expect(evaluator.select(edges, session, result("true"))).toEqual({ kind: "edge", edge: edges[0] });
  });

  it("un bloque de salida única sigue por condiciones aunque haya salidas con nombre", () => {
    const edges = [edge("a", "x", 1)];
    expect(evaluator.select(edges, session, result())).toEqual({ kind: "edge", edge: edges[0] });
  });
});

describe("convertBuilderSnapshotToRuntime", () => {
  it("lleva la salida de cada conexión al snapshot de ejecución", () => {
    const runtime = convertBuilderSnapshotToRuntime(
      {
        flow: { id: "f", key: "f", name: "F" },
        version: { id: V, versionNumber: 1, status: "draft", entryNodeId: "s" },
        nodes: {},
        edgesBySource: {
          q: [{ id: "e", fromNodeId: "q", toNodeId: "z", fromOutput: "respuesta", priority: 1, isFallback: false, condition: { operator: "always" } }]
        }
      },
      T
    );
    expect(runtime.edgesBySource.q?.[0]?.fromOutput).toBe("respuesta");
  });
});

describe("ExecutionLoop — de punta a punta por salida", () => {
  const node = (id: string, type: FlowNode["type"], content: Record<string, unknown> = {}, config: Record<string, unknown> = {}): FlowNode =>
    ({ id, tenantId: T, flowVersionId: V, type, name: id, content, config, metadata: {} });
  const link = (from: string, to: string, priority: number, fromOutput?: string): FlowEdge =>
    ({ ...edge(`${from}-${to}`, to, priority, fromOutput), fromNodeId: from });

  function flow(edgesFromQuestion: FlowEdge[]): FlowSnapshot {
    return {
      flow: { id: "f", tenantId: T, key: "f", name: "F", currentPublishedVersionId: V },
      version: { id: V, tenantId: T, flowId: "f", versionNumber: 1, status: "published", entryNodeId: "start" },
      nodes: {
        start: node("start", "start"),
        ask: node("ask", "question", {}, { waitIndefinitely: false, timeout: { amount: 5, unit: "minutes" } }),
        gracias: node("gracias", "end", { text: "¡Gracias!" }),
        vencio: node("vencio", "end", { text: "Se acabó el tiempo" })
      },
      edgesBySource: { start: [link("start", "ask", 1)], ask: edgesFromQuestion }
    };
  }

  it("al responder sale por «respuesta», aunque «tiempo agotado» tenga más prioridad", async () => {
    const snapshot = flow([link("ask", "vencio", 1, "tiempo-agotado"), link("ask", "gracias", 2, "respuesta")]);
    const waiting = makeSession({ flowId: "f", flowVersionId: V, currentNodeId: "ask", status: "waiting_input" });

    const outcome = await buildLoop().run(snapshot, waiting, makeEnvelope("Ana"));

    expect(outcome.executionStatus).toBe("completed");
    expect(outcome.outputMessages.map((m) => m.content)).toEqual(["¡Gracias!"]);
  });

  it("si la salida «respuesta» no está conectada, la rama termina sin error", async () => {
    const snapshot = flow([link("ask", "vencio", 1, "tiempo-agotado")]);
    const waiting = makeSession({ flowId: "f", flowVersionId: V, currentNodeId: "ask", status: "waiting_input" });

    const outcome = await buildLoop().run(snapshot, waiting, makeEnvelope("Ana"));

    expect(outcome.executionStatus).toBe("completed");
    expect(outcome.domainEvents).toContain("output_not_connected:ask:respuesta");
    expect(outcome.outputMessages).toEqual([]);
  });
});
