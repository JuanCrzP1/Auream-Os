import { describe, expect, it } from "vitest";
import { GraphValidator } from "../../domains/automations/validation/application/GraphValidator.js";
import { validateCanvasGraph } from "../../apps/web/src/features/automations/builder/services/validateCanvasGraph.js";
import { GRAPH_SCENARIOS } from "../fixtures/validation/scenarios.js";
import { toCanvasGraph, toFlowSnapshot } from "../fixtures/validation/graphScenarios.js";

// ---------------------------------------------------------------------------
// Contrato de comportamiento entre los dos validadores de grafo.
//
// Existen dos implementaciones con responsabilidades distintas:
//
//   backend  (GraphValidator)      → AUTORIDAD: acepta o rechaza la publicación
//   frontend (validateCanvasGraph) → feedback inmediato en el builder
//
// Este test NO las fusiona: comprueba que coinciden en el veredicto sobre los
// mismos escenarios. Si una de las dos cambia una regla por su cuenta, falla.
//
// Los desajustes aceptados se declaran en el escenario con `backendOnly`, para
// que sean una decisión visible y no una divergencia accidental.
// ---------------------------------------------------------------------------

const validator = new GraphValidator();

describe("paridad de validación de grafo backend ↔ frontend", () => {
  for (const scenario of GRAPH_SCENARIOS) {
    describe(scenario.name, () => {
      const report = validator.validate(toFlowSnapshot(scenario));
      const canvas = toCanvasGraph(scenario);
      const builderReport = validateCanvasGraph(canvas.nodes as never, canvas.edges as never);

      it("el backend emite el veredicto acordado", () => {
        expect(report.errors.length > 0).toBe(scenario.backendRejects);
      });

      it("el builder avisa al usuario cuando corresponde", () => {
        const warns = builderReport.errors.length > 0 || builderReport.warnings.length > 0;
        expect(warns).toBe(scenario.frontendWarns);
      });

      it("el builder nunca acepta en silencio algo que el backend rechaza", () => {
        if (!scenario.backendRejects || scenario.backendOnly) {
          return;
        }

        const warns = builderReport.errors.length > 0 || builderReport.warnings.length > 0;
        expect(warns).toBe(true);
      });
    });
  }

  it("cubre los nueve escenarios acordados", () => {
    expect(GRAPH_SCENARIOS).toHaveLength(9);
  });

  it("documenta explícitamente cada regla que sólo cubre el backend", () => {
    const soloBackend = GRAPH_SCENARIOS.filter(
      (s) => s.backendRejects && !s.frontendWarns
    );

    for (const scenario of soloBackend) {
      expect(scenario.backendOnly, `'${scenario.name}' diverge sin justificar`).toBeDefined();
    }
  });
});
