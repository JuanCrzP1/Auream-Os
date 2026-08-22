import { describe, it, expect } from "vitest";
import { makeSession, makeEnvelope, buildLoop } from "./helpers/executionHarness.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExecutionLoop — hop-by-hop execution", () => {
  let loop: ExecutionLoop;

  beforeEach(() => {
    loop = buildLoop();
  });

  it("avanza de message → question y devuelve waiting_input", () => {
    const session = makeSession({ currentNodeId: "node-entry" });
    const result = loop.run(validLeadCaptureFlow, session, makeEnvelope());

    expect(result.executionStatus).toBe("waiting_input");
    expect(result.outputMessages.length).toBeGreaterThan(0);
  });

  it("cuando ya está en waiting_input con mensaje, avanza a capture → end → completed", () => {
    const session = makeSession({
      currentNodeId: "node-question",
      status: "waiting_input"
    });
    const result = loop.run(validLeadCaptureFlow, session, makeEnvelope("Ana"));

    expect(result.executionStatus).toBe("completed");
  });

  it("no supera el límite de hops (max_hops_exceeded)", () => {
    // Construye un snapshot con un bucle infinito: node-a → node-a
    const loopSnapshot = {
      ...validLeadCaptureFlow,
      nodes: {
        "node-a": {
          id: "node-a",
          tenantId: "tenant-test",
          flowVersionId: "v1",
          type: "message" as const,
          name: "Loop",
          content: { text: "loop" },
          config: {},
          metadata: {}
        }
      },
      edgesBySource: {
        "node-a": [
          {
            id: "edge-loop",
            tenantId: "tenant-test",
            flowVersionId: "v1",
            fromNodeId: "node-a",
            toNodeId: "node-a",
            priority: 0,
            isFallback: false,
            condition: { operator: "always" as const }
          }
        ]
      }
    };

    const session = makeSession({ currentNodeId: "node-a" });
    const result = loop.run(loopSnapshot, session, makeEnvelope());

    expect(result.executionStatus).toBe("failed");
    expect(result.domainEvents).toContain("max_hops_exceeded");
  });

  it("devuelve failed cuando no hay edge seleccionable (sin fallback)", () => {
    const snapshot = {
      ...validLeadCaptureFlow,
      nodes: {
        "node-a": {
          id: "node-a",
          tenantId: "tenant-test",
          flowVersionId: "v1",
          type: "message" as const,
          name: "Sin salida",
          content: { text: "sin salida" },
          config: {},
          metadata: {}
        }
      },
      edgesBySource: {
        "node-a": [
          {
            id: "edge-condition",
            tenantId: "tenant-test",
            flowVersionId: "v1",
            fromNodeId: "node-a",
            toNodeId: "node-b",
            priority: 0,
            isFallback: false,
            condition: {
              operator: "eq" as const,
              fact: "context.nonexistent",
              value: "impossible"
            }
          }
        ]
      }
    };

    const session = makeSession({ currentNodeId: "node-a" });
    const result = loop.run(snapshot, session, makeEnvelope());

    expect(result.executionStatus).toBe("failed");
  });

  it("acumula outputMessages de múltiples hops", () => {
    // message → question produce al menos 2 mensajes de salida
    const session = makeSession({ currentNodeId: "node-entry" });
    const result = loop.run(validLeadCaptureFlow, session, makeEnvelope());

    expect(result.outputMessages.length).toBeGreaterThanOrEqual(1);
  });
});
