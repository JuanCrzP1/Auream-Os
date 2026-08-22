import { describe, it, expect } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";
import { emptyFlow } from "../fixtures/flows/emptyFlow.js";
import { unreachableNodesFlow } from "../fixtures/flows/unreachableNodesFlow.js";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";

const validator = new GraphValidator();

// ---------------------------------------------------------------------------
// Flujo válido — no debe producir errors
// ---------------------------------------------------------------------------

describe("GraphValidator — flujo válido", () => {
  it("no reporta errores en un flujo estructuralmente correcto", () => {
    const report = validator.validate(validLeadCaptureFlow);
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("reporta warnings si hay nodos inalcanzables (no errores)", () => {
    const report = validator.validate(unreachableNodesFlow);
    const warningCodes = report.warnings.map((w) => w.code);
    expect(warningCodes).toContain("UNREACHABLE_NODE");
  });
});

// ---------------------------------------------------------------------------
// Flujo vacío
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Flujo vacío
// ---------------------------------------------------------------------------

describe("GraphValidator — flujo vacío", () => {
  it("emite EMPTY_FLOW y rechaza la validación", () => {
    const report = validator.validate(emptyFlow);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("EMPTY_FLOW");
  });

  it("corta la validación después de EMPTY_FLOW (no genera errores secundarios)", () => {
    const report = validator.validate(emptyFlow);
    // Si hay EMPTY_FLOW no tiene sentido reportar INVALID_ENTRY_NODE también
    // porque el snapshot tiene 0 nodos por definición.
    const codes = report.errors.map((e) => e.code);
    expect(codes).not.toContain("INVALID_ENTRY_NODE");
  });
});

// ---------------------------------------------------------------------------
// Corrupción de datos: edge apuntando a nodo borrado
// Replica la corrupción real en data/builder-workspaces/test-tenant/lead-capture.json
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Entry node inválido
// ---------------------------------------------------------------------------

describe("GraphValidator — entry node inválido", () => {
  it("emite INVALID_ENTRY_NODE cuando entryNodeId no está en el mapa de nodos", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      version: {
        ...validLeadCaptureFlow.version,
        entryNodeId: "node-inexistente"
      }
    };
    const report = validator.validate(snapshot);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("INVALID_ENTRY_NODE");
  });

  it("emite ENTRY_NODE_IS_TERMINAL cuando el entry es un nodo 'end'", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      version: {
        ...validLeadCaptureFlow.version,
        entryNodeId: "node-end"
      }
    };
    const report = validator.validate(snapshot);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("ENTRY_NODE_IS_TERMINAL");
  });

  it("emite MISSING_ENTRY_NODE cuando entryNodeId es string vacío", () => {
    const snapshot: FlowSnapshot = {
      ...validLeadCaptureFlow,
      version: {
        ...validLeadCaptureFlow.version,
        entryNodeId: ""
      }
    };
    const report = validator.validate(snapshot);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("MISSING_ENTRY_NODE");
  });
});

// ---------------------------------------------------------------------------
// Nodo sin edges salientes (no terminal)
// ---------------------------------------------------------------------------
