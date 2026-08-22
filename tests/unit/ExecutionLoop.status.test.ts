import { describe, it, expect } from "vitest";
import { makeSession, makeEnvelope, buildLoop } from "./helpers/executionHarness.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";

describe("ExecutionLoop — status transitions", () => {
  let loop: ExecutionLoop;

  beforeEach(() => {
    loop = buildLoop();
  });

  it("detecta nodo inexistente y lanza error", () => {
    const session = makeSession({ currentNodeId: "node-does-not-exist" });

    expect(() => loop.run(validLeadCaptureFlow, session, makeEnvelope())).toThrow(
      /nodo actual inexistente/i
    );
  });

  it("devuelve completed cuando el flow termina en end sin edges de salida", () => {
    const snapshot = {
      ...validLeadCaptureFlow,
      nodes: {
        "node-end": {
          id: "node-end",
          tenantId: "tenant-test",
          flowVersionId: "v1",
          type: "end" as const,
          name: "Fin",
          content: { text: "Adiós." },
          config: {},
          metadata: {}
        }
      },
      edgesBySource: {}
    };

    const session = makeSession({ currentNodeId: "node-end" });
    const result = loop.run(snapshot, session, makeEnvelope());

    expect(result.executionStatus).toBe("completed");
  });
});
