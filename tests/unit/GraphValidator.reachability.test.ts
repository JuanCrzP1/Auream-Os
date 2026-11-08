import { describe, it, expect } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { infiniteCycleFlow } from "../fixtures/flows/infiniteCycleFlow.js";
import { unreachableNodesFlow } from "../fixtures/flows/unreachableNodesFlow.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";

const validator = new GraphValidator();

// ---------------------------------------------------------------------------
// Ciclo infinito
// ---------------------------------------------------------------------------

describe("GraphValidator — ciclo infinito", () => {
  it("detecta INFINITE_CYCLE cuando todos los edges del ciclo son 'always'", () => {
    const report = validator.validate(infiniteCycleFlow);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("INFINITE_CYCLE");
  });

  it("el mensaje del ciclo incluye los nodos que participan", () => {
    const report = validator.validate(infiniteCycleFlow);
    const cycleError = report.errors.find((e) => e.code === "INFINITE_CYCLE");
    expect(cycleError?.message).toMatch(/node-a/);
    expect(cycleError?.message).toMatch(/node-b/);
  });
});

// ---------------------------------------------------------------------------
// Question sin fallback
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Nodo sin edges salientes: cualquier bloque puede ser el último; el inicio no
// ---------------------------------------------------------------------------

describe("GraphValidator — nodo sin edges salientes", () => {
  it("un Mensaje puede ser el último bloque: NO emite NODE_NO_OUTGOING_EDGES", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      nodes: {
        ...validLeadCaptureFlow.nodes,
        "node-stranded": {
          id: "node-stranded",
          tenantId: "tenant-test",
          flowVersionId: "v1",
          type: "message",
          name: "Nodo sin salida",
          content: {},
          config: {},
          metadata: {}
        }
      }
      // No hay edge desde node-stranded en edgesBySource
    };
    const report = validator.validate(snapshot);
    expect(report.errors.filter((e) => e.code === "NODE_NO_OUTGOING_EDGES" && e.nodeId === "node-stranded")).toHaveLength(0);
  });

  it("un inicio sin nada detrás sí emite NODE_NO_OUTGOING_EDGES", () => {
    const entryId = "node-start";
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      nodes: { [entryId]: validLeadCaptureFlow.nodes[entryId]! },
      edgesBySource: {}
    };
    const report = validator.validate(snapshot);
    expect(report.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "NODE_NO_OUTGOING_EDGES", nodeId: entryId })]));
  });

  it("NO emite NODE_NO_OUTGOING_EDGES para nodos tipo 'end'", () => {
    const report = validator.validate(validLeadCaptureFlow);
    const stranded = report.errors.filter(
      (e) => e.code === "NODE_NO_OUTGOING_EDGES" && e.nodeId === "node-end"
    );
    expect(stranded).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge con source inexistente
// ---------------------------------------------------------------------------
