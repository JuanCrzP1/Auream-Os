import { describe, expect, it } from "vitest";
import { fieldValueText, foldAnswer, parseFieldDate, parseFieldNumber, parseYesNo, sameTypedValue } from "../../contracts/FieldValues.js";

// ---------------------------------------------------------------------------
// Valores con tipo: una sola forma de leerlos (al guardar en la ficha y al
// comparar en el Condicional) y de mostrarlos a una persona (mensajes y ficha).
// ---------------------------------------------------------------------------

describe("leer lo que escribe la gente", () => {
  it("sí o no: con tildes, signos o mayúsculas; «no sé» no es un no", () => {
    expect(["Sí", "si.", "SI!", "yes", "1", true].map(parseYesNo)).toEqual([true, true, true, true, true, true]);
    expect(["No", "no.", "falso", false].map(parseYesNo)).toEqual([false, false, false, false]);
    expect(["no sé", "tal vez", "", null].map(parseYesNo)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("números como en Latinoamérica y como en Estados Unidos", () => {
    expect(["1.200.000", "1,200.50", "1.200,50", "$ 49.900", "12,5", "1.5"].map(parseFieldNumber)).toEqual([1200000, 1200.5, 1200.5, 49900, 12.5, 1.5]);
    expect(parseFieldNumber("sin número")).toBeUndefined();
  });

  it("fechas que existen, en cualquiera de los formatos de siempre", () => {
    expect(["13/11/1990", "1990-11-13", "13-11-90", "13.11.1990", "01/12/26"].map(parseFieldDate)).toEqual(["1990-11-13", "1990-11-13", "1990-11-13", "1990-11-13", "2026-12-01"]);
    expect(parseFieldDate("31/02/2026")).toBeUndefined();
  });

  it("una respuesta sin tildes, mayúsculas ni signos", () => {
    expect(foldAnswer("¡Medellín!")).toBe(foldAnswer("medellin."));
  });
});

describe("mostrar y comparar", () => {
  it("a una persona: «Sí», «No», «13/11/1990»; lo demás tal cual", () => {
    expect([true, false, "1990-11-13", 1200000, "Cali", "2026-11-13T10:00:00Z"].map(fieldValueText)).toEqual(["Sí", "No", "13/11/1990", "1200000", "Cali", "2026-11-13T10:00:00Z"]);
  });

  it("compara con tipo cuando se puede; si no, deja que se compare como texto", () => {
    expect(sameTypedValue(true, "Sí")).toBe(true);
    expect(sameTypedValue(false, "sí")).toBe(false);
    expect(sameTypedValue(1200000, "1.200.000")).toBe(true);
    expect(sameTypedValue("1990-11-13", "13/11/1990")).toBe(true);
    expect(sameTypedValue(true, "quizá")).toBeUndefined();
    expect(sameTypedValue("Cali", "cali")).toBeUndefined();
  });
});
