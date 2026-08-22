import { describe, it, expect } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";
import { corruptedOrphanEdgeFlow } from "../fixtures/flows/corruptedOrphanEdgeFlow.js";
import { infiniteCycleFlow } from "../fixtures/flows/infiniteCycleFlow.js";
import { questionWithoutFallbackFlow } from "../fixtures/flows/questionWithoutFallbackFlow.js";
import { duplicatePriorityFlow } from "../fixtures/flows/duplicatePriorityFlow.js";
import { unreachableNodesFlow } from "../fixtures/flows/unreachableNodesFlow.js";
import { emptyFlow } from "../fixtures/flows/emptyFlow.js";

const validator = new GraphValidator();

describe("Contrato FlowSnapshot — casos de corrupción real", () => {
  it("flujo válido pasa validación sin errors", () => {
    const report = validator.validate(validLeadCaptureFlow);
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("flujo vacío es rechazado", () => {
    const report = validator.validate(emptyFlow);
    expect(report.isValid).toBe(false);
  });

  it("corrupción real lead-capture.json (edge a nodo borrado) es rechazada", () => {
    // Este test documenta el bug que existía en producción antes de FASE 1.
    // data/builder-workspaces/test-tenant/lead-capture.json tenía exactamente este patrón.
    const report = validator.validate(corruptedOrphanEdgeFlow);
    expect(report.isValid).toBe(false);
    const targetError = report.errors.find((e) => e.code === "EDGE_INVALID_TARGET");
    expect(targetError).toBeDefined();
    expect(targetError?.nodeId).toBe("node-deleted");
  });

  it("ciclo infinito es rechazado", () => {
    const report = validator.validate(infiniteCycleFlow);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === "INFINITE_CYCLE")).toBe(true);
  });

  it("question sin fallback es rechazado", () => {
    const report = validator.validate(questionWithoutFallbackFlow);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === "QUESTION_NO_FALLBACK")).toBe(true);
  });

  it("prioridades duplicadas son error (no warning)", () => {
    const report = validator.validate(duplicatePriorityFlow);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === "DUPLICATE_EDGE_PRIORITY")).toBe(true);
    expect(report.warnings.some((w) => w.code === "DUPLICATE_EDGE_PRIORITY")).toBe(false);
  });

  it("nodos inalcanzables generan warning pero no bloquean si el resto es válido", () => {
    // unreachableNodesFlow tiene un nodo huérfano pero el path entry→end es válido
    // y no tiene otros errores. El validador debe marcar el nodo como warning.
    const report = validator.validate(unreachableNodesFlow);
    // El nodo orphan tiene edges salientes válidos, no tiene errores propios.
    // El flujo puede ser válido con warnings.
    expect(report.warnings.some((w) => w.code === "UNREACHABLE_NODE")).toBe(true);
  });
});

describe("Contrato FlowSnapshot — integridad de tipos", () => {
  it("FlowSnapshot tiene todas las propiedades requeridas en validLeadCaptureFlow", () => {
    const snapshot = validLeadCaptureFlow;
    expect(snapshot.flow.id).toBeTruthy();
    expect(snapshot.flow.tenantId).toBeTruthy();
    expect(snapshot.flow.key).toBeTruthy();
    expect(snapshot.version.entryNodeId).toBeTruthy();
    expect(typeof snapshot.nodes).toBe("object");
    expect(typeof snapshot.edgesBySource).toBe("object");
  });

  it("todos los nodos tienen el mismo tenantId que el flow", () => {
    for (const node of Object.values(validLeadCaptureFlow.nodes)) {
      expect(node.tenantId).toBe(validLeadCaptureFlow.flow.tenantId);
    }
  });

  it("todos los edges tienen el mismo flowVersionId que la versión", () => {
    for (const edges of Object.values(validLeadCaptureFlow.edgesBySource)) {
      for (const edge of edges) {
        expect(edge.flowVersionId).toBe(validLeadCaptureFlow.version.id);
      }
    }
  });

  it("cada edge en edgesBySource[X] tiene fromNodeId === X", () => {
    for (const [sourceId, edges] of Object.entries(validLeadCaptureFlow.edgesBySource)) {
      for (const edge of edges) {
        expect(edge.fromNodeId).toBe(sourceId);
      }
    }
  });
});
