import { describe, it, expect } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { questionWithoutFallbackFlow } from "../fixtures/flows/questionWithoutFallbackFlow.js";

const validator = new GraphValidator();

// ---------------------------------------------------------------------------
// Question sin fallback
// ---------------------------------------------------------------------------

describe("GraphValidator — question sin fallback", () => {
  it("emite QUESTION_NO_FALLBACK para nodo question sin edge de fallback", () => {
    const report = validator.validate(questionWithoutFallbackFlow);
    expect(report.isValid).toBe(false);
    const codes = report.errors.map((e) => e.code);
    expect(codes).toContain("QUESTION_NO_FALLBACK");
  });

  it("incluye el nodeId del nodo question afectado", () => {
    const report = validator.validate(questionWithoutFallbackFlow);
    const issue = report.errors.find((e) => e.code === "QUESTION_NO_FALLBACK");
    expect(issue?.nodeId).toBe("node-question");
  });
});

// ---------------------------------------------------------------------------
// Prioridades duplicadas — ahora es ERROR no WARNING
// ---------------------------------------------------------------------------
