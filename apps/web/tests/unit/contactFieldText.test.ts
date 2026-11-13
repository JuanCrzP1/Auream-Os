import { describe, expect, it } from "vitest";
import { filledPercent, usesSummary } from "../../src/features/contact-fields/fieldText";
import { typeLabel, withOption } from "../../src/shared/contact-fields/fieldTypes";
import { originText, whenText } from "../../src/features/crm/contacts/components/fields/fieldOrigin";

// Cómo se cuenta un campo en pantalla: lleno, quién lo usa, su tipo y sus opciones.

const use = (flowKey: string, blockName: string) => ({ flowKey, flowName: flowKey === "a" ? "Ventas" : "Envíos", blockId: blockName, blockName, blockType: "question", role: "fills" as const });

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

describe("de dónde salió un dato de la ficha", () => {
  const now = new Date("2026-11-13T15:00:00");
  it("cuándo: hoy, ayer, el día; con año si es de otro", () => {
    expect(whenText("2026-11-13T09:00:00", now)).toBe("hoy");
    expect(whenText("2026-11-12T23:00:00", now)).toBe("ayer");
    expect(whenText("2026-11-02T10:00:00", now)).toBe("2 de nov");
    expect(whenText("2025-11-02T10:00:00", now)).toBe("2 de nov de 2025");
  });

  it("quién o qué bloque, con el verbo de su tipo", () => {
    const flow = (blockType: string | null, blockName: string | null, flowName: string | null = "Ventas") => ({ source: "flow" as const, at: "2026-11-13T09:00:00", flowName, blockName, blockType });
    expect(originText(flow("question", "¿Ciudad?"), now)).toBe("Lo respondió en «¿Ciudad?» del flujo «Ventas» · hoy");
    expect(originText(flow("menu", "Bienvenida"), now)).toBe("Lo eligió en «Bienvenida» del flujo «Ventas» · hoy");
    expect(originText(flow(null, null), now)).toBe("Lo guardó el flujo «Ventas» · hoy");
    expect(originText(flow(null, null, null), now)).toBe("Lo guardó un flujo · hoy");
    expect(originText({ source: "team", at: "2026-11-12T09:00:00", actorName: "Ana" }, now)).toBe("Lo cambió Ana · ayer");
  });
});
