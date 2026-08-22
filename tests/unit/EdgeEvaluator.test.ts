import { describe, it, expect } from "vitest";
import { EdgeEvaluator } from "../../flow-engine/edges/EdgeEvaluator.js";
import type { FlowEdge } from "../../contracts/FlowSnapshot.js";
import type { NodeExecutionResult } from "../../contracts/RuntimeContracts.js";
import type { Session } from "../../contracts/RuntimeContracts.js";

// Sesión mínima para los tests del EdgeEvaluator
function makeSession(context: Record<string, unknown> = {}): Session {
  return {
    id: "session-test",
    tenantId: "tenant-test",
    flowId: "flow-test",
    flowVersionId: "v1",
    channel: "web",
    conversationKey: "conv-test",
    userKey: "user-test",
    currentNodeId: "node-a",
    status: "active",
    context,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as unknown as Session;
}

// Resultado de ejecución mínimo
function makeExecution(nodeResult: Record<string, unknown> = {}): NodeExecutionResult {
  return {
    executionStatus: "success",
    outputMessages: [],
    contextPatch: {},
    nodeResult,
    domainEvents: []
  };
}

function makeEdge(overrides: Partial<FlowEdge> = {}): FlowEdge {
  return {
    id: "edge-test",
    tenantId: "tenant-test",
    flowVersionId: "v1",
    fromNodeId: "node-a",
    toNodeId: "node-b",
    priority: 0,
    isFallback: false,
    condition: { operator: "always" },
    ...overrides
  };
}

const evaluator = new EdgeEvaluator();

describe("EdgeEvaluator — condición 'always'", () => {
  it("selecciona el único edge con operator 'always'", () => {
    const edge = makeEdge({ condition: { operator: "always" } });
    const result = evaluator.select([edge], makeSession(), makeExecution());
    expect(result?.id).toBe("edge-test");
  });

  it("selecciona el edge de menor priority cuando hay varios 'always'", () => {
    const high = makeEdge({ id: "high-priority", priority: 10 });
    const low = makeEdge({ id: "low-priority", priority: 0 });
    const result = evaluator.select([high, low], makeSession(), makeExecution());
    expect(result?.id).toBe("low-priority");
  });

  it("devuelve null si no hay edges", () => {
    const result = evaluator.select([], makeSession(), makeExecution());
    expect(result).toBeNull();
  });
});

describe("EdgeEvaluator — condición 'eq'", () => {
  it("selecciona edge cuando context.key === value", () => {
    const edge = makeEdge({
      condition: { operator: "eq", fact: "context.score", value: "high" }
    });
    const session = makeSession({ score: "high" });
    const result = evaluator.select([edge], session, makeExecution());
    expect(result?.id).toBe("edge-test");
  });

  it("no selecciona edge cuando context.key !== value", () => {
    const edge = makeEdge({
      id: "edge-eq",
      condition: { operator: "eq", fact: "context.score", value: "high" }
    });
    const fallback = makeEdge({
      id: "edge-fallback",
      priority: 99,
      isFallback: true,
      condition: { operator: "always" }
    });
    const session = makeSession({ score: "low" });
    const result = evaluator.select([edge, fallback], session, makeExecution());
    // El 'eq' no matchea, debe seleccionar el fallback
    expect(result?.id).toBe("edge-fallback");
  });
});

describe("EdgeEvaluator — condición 'neq'", () => {
  it("selecciona edge cuando context.key !== value", () => {
    const edge = makeEdge({
      condition: { operator: "neq", fact: "context.status", value: "vip" }
    });
    const session = makeSession({ status: "standard" });
    const result = evaluator.select([edge], session, makeExecution());
    expect(result?.id).toBe("edge-test");
  });

  it("no selecciona edge cuando context.key === value (neq falla)", () => {
    const edge = makeEdge({
      id: "edge-neq",
      condition: { operator: "neq", fact: "context.status", value: "vip" }
    });
    const fallback = makeEdge({
      id: "fallback",
      priority: 99,
      isFallback: true,
      condition: { operator: "always" }
    });
    const session = makeSession({ status: "vip" });
    const result = evaluator.select([edge, fallback], session, makeExecution());
    expect(result?.id).toBe("fallback");
  });
});

describe("EdgeEvaluator — condición 'exists'", () => {
  it("selecciona edge cuando la clave existe en context", () => {
    const edge = makeEdge({
      condition: { operator: "exists", fact: "context.email" }
    });
    const session = makeSession({ email: "test@example.com" });
    const result = evaluator.select([edge], session, makeExecution());
    expect(result?.id).toBe("edge-test");
  });

  it("no selecciona edge cuando la clave no existe en context", () => {
    const edge = makeEdge({
      id: "edge-exists",
      condition: { operator: "exists", fact: "context.email" }
    });
    const fallback = makeEdge({
      id: "fallback",
      priority: 99,
      isFallback: true,
      condition: { operator: "always" }
    });
    const session = makeSession({});  // sin email
    const result = evaluator.select([edge, fallback], session, makeExecution());
    expect(result?.id).toBe("fallback");
  });
});

describe("EdgeEvaluator — evaluación sobre node_result", () => {
  it("evalúa fact 'node_result.key' contra el resultado del nodo", () => {
    const edge = makeEdge({
      condition: { operator: "eq", fact: "node_result.capturedInput", value: "sí" }
    });
    const execution = makeExecution({ capturedInput: "sí" });
    const result = evaluator.select([edge], makeSession(), execution);
    expect(result?.id).toBe("edge-test");
  });
});

describe("EdgeEvaluator — fallback como último recurso", () => {
  it("selecciona el fallback si ninguna condición matchea", () => {
    const conditional = makeEdge({
      id: "edge-conditional",
      priority: 0,
      condition: { operator: "eq", fact: "context.score", value: "impossible" }
    });
    const fallback = makeEdge({
      id: "edge-fallback",
      priority: 99,
      isFallback: true,
      condition: { operator: "always" }
    });
    const result = evaluator.select([conditional, fallback], makeSession(), makeExecution());
    expect(result?.id).toBe("edge-fallback");
  });
});
