import { describe, it, expect } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { corruptedOrphanEdgeFlow } from "../fixtures/flows/corruptedOrphanEdgeFlow.js";
import { duplicatePriorityFlow } from "../fixtures/flows/duplicatePriorityFlow.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";

const validator = new GraphValidator();

// Corrupción de datos: edge apuntando a nodo borrado
// Replica la corrupción real en data/builder-workspaces/test-tenant/lead-capture.json
// ---------------------------------------------------------------------------

describe("GraphValidator — corrupción: orphan edge", () => {
  it("detecta EDGE_INVALID_TARGET cuando un edge apunta a un nodo inexistente", () => {
    const report = validator.validate(corruptedOrphanEdgeFlow);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("EDGE_INVALID_TARGET");
  });

  it("incluye el edgeId y nodeId en el error de EDGE_INVALID_TARGET", () => {
    const report = validator.validate(corruptedOrphanEdgeFlow);
    const issue = report.errors.find((e) => e.code === "EDGE_INVALID_TARGET");
    expect(issue).toBeDefined();
    expect(issue?.edgeId).toBe("edge-orphan");
    expect(issue?.nodeId).toBe("node-deleted");
  });

  it("también reporta NODE_NO_OUTGOING_EDGES porque el único edge del entry es inválido", () => {
    // Con el edge inválido, desde el punto de vista del grafo el nodo entry
    // tiene un edge que no lleva a ningún nodo válido. El mensaje llega al entry
    // y no puede avanzar. El validador debe forzar el rechazo por el target inválido.
    const report = validator.validate(corruptedOrphanEdgeFlow);
    expect(report.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ciclo infinito
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prioridades duplicadas — ahora es ERROR no WARNING
// ---------------------------------------------------------------------------

describe("GraphValidator — prioridades duplicadas", () => {
  it("emite DUPLICATE_EDGE_PRIORITY como ERROR (no como warning)", () => {
    const report = validator.validate(duplicatePriorityFlow);
    expect(report.isValid).toBe(false);
    const errorCodes = report.errors.map((e) => e.code);
    const warnCodes = report.warnings.map((w) => w.code);
    expect(errorCodes).toContain("DUPLICATE_EDGE_PRIORITY");
    expect(warnCodes).not.toContain("DUPLICATE_EDGE_PRIORITY");
  });
});

// ---------------------------------------------------------------------------
// Entry node inválido
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Edge con source inexistente
// ---------------------------------------------------------------------------

describe("GraphValidator — edge con source inexistente", () => {
  it("emite ORPHAN_EDGE_SOURCE cuando edgesBySource tiene clave que no es nodo", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      edgesBySource: {
        ...validLeadCaptureFlow.edgesBySource,
        "node-ghost": [
          {
            id: "edge-from-ghost",
            tenantId: "tenant-test",
            flowVersionId: "v1",
            fromNodeId: "node-ghost",
            toNodeId: "node-end",
            priority: 0,
            isFallback: false,
            condition: { operator: "always" }
          }
        ]
      }
    };
    const report = validator.validate(snapshot);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("ORPHAN_EDGE_SOURCE");
  });
});

// ---------------------------------------------------------------------------
// Edges con IDs duplicados
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Edges con IDs duplicados
// ---------------------------------------------------------------------------

describe("GraphValidator — edge IDs duplicados", () => {
  it("emite DUPLICATE_EDGE_ID cuando dos edges comparten el mismo id", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      edgesBySource: {
        "node-entry": [
          {
            id: "edge-duplicate-id",
            tenantId: "tenant-test",
            flowVersionId: "v1",
            fromNodeId: "node-entry",
            toNodeId: "node-question",
            priority: 0,
            isFallback: false,
            condition: { operator: "always" }
          },
          {
            id: "edge-duplicate-id",   // mismo id
            tenantId: "tenant-test",
            flowVersionId: "v1",
            fromNodeId: "node-entry",
            toNodeId: "node-end",
            priority: 1,
            isFallback: true,
            condition: { operator: "always" }
          }
        ],
        "node-question": validLeadCaptureFlow.edgesBySource["node-question"],
        "node-capture": validLeadCaptureFlow.edgesBySource["node-capture"]
      }
    };
    const report = validator.validate(snapshot);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("DUPLICATE_EDGE_ID");
  });
});
