import { describe, expect, it } from "vitest";
import type { OtherExpenseSummary } from "@contracts/OtherExpenseContracts";
import { draftSentence, expenseLine, totalLabel } from "../../src/features/dashboard/sales/expenses/expenseWords";

// ---------------------------------------------------------------------------
// Otros gastos en palabras: la línea corta de la lista y la frase que confirma
// el formulario (cuánto, cada cuánto, qué día y de qué parte del negocio).
// ---------------------------------------------------------------------------

const expense = (over: Partial<OtherExpenseSummary>): OtherExpenseSummary => ({
  id: "e", name: "Gasto", kind: "fixed", amount: 600000, currency: "COP", frequency: "monthly", startsOn: "2026-11-01", endsOn: null, lineId: null,
  createdAt: "", updatedAt: "", ...over
});

describe("la lista", () => {
  it("monto y frecuencia, o el %, de qué parte del negocio y desde cuándo", () => {
    expect(expenseLine(expense({}), "Venezuela")).toBe("$ 600.000 COP cada mes · Venezuela · desde 1 nov");
    expect(expenseLine(expense({ kind: "percent", amount: 3.5, currency: null, frequency: null, endsOn: "2026-12-31" }), null)).toBe("3,5 % de las ventas · todo el negocio · desde 1 nov · hasta 31 dic");
    expect(expenseLine(expense({ frequency: "once", startsOn: "2026-11-05" }), null)).toBe("$ 600.000 COP el 5 nov · todo el negocio");
  });

  it("el total dice de qué periodo", () => {
    expect(totalLabel("últimos 30 días")).toBe("Total en los últimos 30 días");
    expect(totalLabel("hoy")).toBe("Total de hoy");
    expect(totalLabel("este mes")).toBe("Total de este mes");
  });
});

describe("la frase del formulario", () => {
  const base = { kind: "fixed", amount: "1.200.000", currency: "COP", frequency: "monthly", startsOn: "2026-11-01", endsOn: "", lineName: null } as const;

  it("dice cuánto, cuándo se cobra y a quién se resta", () => {
    expect(draftSentence(base)).toBe("Se restan $ 1.200.000 COP cada mes (el día 1) de la ganancia de todo el negocio, desde el 1 de noviembre.");
    expect(draftSentence({ ...base, frequency: "weekly", startsOn: "2026-11-02", lineName: "Venezuela" })).toBe("Se restan $ 1.200.000 COP cada semana (cada lunes) de la ganancia de la línea Venezuela, desde el 2 de noviembre.");
    expect(draftSentence({ ...base, frequency: "once" })).toBe("Se restan $ 1.200.000 COP una sola vez, el 1 de noviembre, de la ganancia de todo el negocio.");
    expect(draftSentence({ ...base, kind: "percent", amount: "3,5", endsOn: "2026-12-31" })).toBe("Se resta el 3,5 % de lo vendido de la ganancia de todo el negocio, desde el 1 de noviembre hasta el 31 de diciembre. El ROAS no cambia.");
  });

  it("sin valor o sin fecha no hay frase", () => {
    expect(draftSentence({ ...base, amount: " " })).toBeNull();
    expect(draftSentence({ ...base, startsOn: "" })).toBeNull();
  });
});
