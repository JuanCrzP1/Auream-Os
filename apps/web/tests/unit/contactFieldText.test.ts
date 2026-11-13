import { describe, expect, it } from "vitest";
import { filledPercent, typeLabel, usesSummary, withOption } from "../../src/features/contact-fields/fieldText";

// Cómo se cuenta un campo en pantalla: lleno, quién lo usa, su tipo y sus opciones.

const use = (flowKey: string, blockName: string) => ({ flowKey, flowName: flowKey === "a" ? "Ventas" : "Envíos", blockId: blockName, blockName, role: "fills" as const });

describe("textos de un campo", () => {
  it("el porcentaje nunca miente: 0 sin datos, al menos 1 si hay alguno, tope 100", () => {
    expect(filledPercent(0, 100)).toBe(0);
    expect(filledPercent(5, 0)).toBe(0);
    expect(filledPercent(1, 1000)).toBe(1);
    expect(filledPercent(64, 100)).toBe(64);
    expect(filledPercent(120, 100)).toBe(100);
  });

  it("quién lo usa: un bloque, los de un flujo o cuántos flujos", () => {
    expect(usesSummary([])).toEqual({ text: "Ningún flujo lo usa", warn: true });
    expect(usesSummary([use("a", "¿Ciudad?")]).text).toBe("«¿Ciudad?» de «Ventas»");
    expect(usesSummary([use("a", "¿Ciudad?"), use("a", "Envío")]).text).toBe("2 bloques de «Ventas»");
    expect(usesSummary([use("a", "¿Ciudad?"), use("b", "Envío"), use("b", "Otro")]).text).toBe("2 flujos · 3 bloques");
  });

  it("el tipo y las opciones de una lista, sin repetidas", () => {
    expect(typeLabel("list", ["A", "B"])).toBe("Lista · 2");
    expect(typeLabel("boolean")).toBe("Sí o no");
    expect(withOption(["Medellín"], "  medellin ")).toBeNull();
    expect(withOption(["Medellín"], "   ")).toBeNull();
    expect(withOption(["Medellín"], " Bogotá  D.C. ")).toEqual(["Medellín", "Bogotá D.C."]);
  });
});
