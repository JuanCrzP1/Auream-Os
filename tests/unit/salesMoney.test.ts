import { describe, expect, it } from "vitest";
import { countryOfPhone } from "../../contracts/Countries.js";
import { parseCurrency, parseMoney } from "../../domains/sales/domain/Money.js";
import { missingForApproval } from "../../domains/sales/domain/Sale.js";
import { salePeriod, startOfDay } from "../../domains/sales/domain/SalePeriod.js";

// ---------------------------------------------------------------------------
// Ventas: leer montos como llegan de un comprobante o una variable, el país
// por el teléfono, el periodo en la hora de la empresa y qué falta para que
// una venta cuente. Lo que no se entiende es `null`: nunca se adivina.
// ---------------------------------------------------------------------------

describe("parseMoney", () => {
  it.each([
    ["150000", 150000],
    ["$ 150.000", 150000],
    ["1.000.000", 1000000],
    ["150,000.50", 150000.5],
    ["1.250,75", 1250.75],
    ["99,9", 99.9],
    ["COP 45.500", 45500],
    [5300, 5300]
  ])("%s → %s", (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected);
  });

  it.each(["", "abc", "0", "-5", "$", null, undefined, Number.NaN, 1e15])("%s → null", (raw) => {
    expect(parseMoney(raw)).toBeNull();
  });
});

describe("parseCurrency", () => {
  it("acepta las monedas de la lista sin importar mayúsculas", () => {
    expect(parseCurrency(" cop ")).toBe("COP");
    expect(parseCurrency("VES")).toBe("VES");
  });

  it("rechaza lo que no es una moneda de la lista", () => {
    expect(parseCurrency("PESOS")).toBeNull();
    expect(parseCurrency("XYZ")).toBeNull();
    expect(parseCurrency("")).toBeNull();
  });
});

describe("countryOfPhone", () => {
  it.each([
    ["573001234567", "CO"],
    ["+58 412 0750409", "VE"],
    ["5215512345678", "MX"],
    ["593991234567", "EC"],
    ["18095551234", "DO"],
    ["13055551234", "US"],
    ["34612345678", "ES"]
  ])("%s → %s", (phone, country) => {
    expect(countryOfPhone(phone)).toBe(country);
  });

  it("sin teléfono o de un país fuera de la lista: null", () => {
    expect(countryOfPhone(null)).toBeNull();
    expect(countryOfPhone("123")).toBeNull();
    expect(countryOfPhone("447911123456")).toBeNull();
  });
});

describe("salePeriod", () => {
  it("el día empieza a la medianoche de la empresa, no de UTC", () => {
    expect(startOfDay("2026-11-10", "America/Bogota").toISOString()).toBe("2026-11-10T05:00:00.000Z");
    expect(startOfDay("2026-11-10", "Europe/Madrid").toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });

  it("«hasta» incluye todo ese día", () => {
    const period = salePeriod("2026-11-01", "2026-11-30", "America/Bogota");
    expect(period.from?.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(period.until?.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("rechaza fechas mal escritas o un periodo al revés", () => {
    expect(() => salePeriod("10/11/2026", undefined, "America/Bogota")).toThrow("AAAA-MM-DD");
    expect(() => salePeriod("2026-11-30", "2026-11-01", "America/Bogota")).toThrow("anterior");
  });
});

describe("missingForApproval", () => {
  it("completa: nada falta", () => {
    expect(missingForApproval({ productId: "p", amount: 10, currency: "COP" })).toBeNull();
  });

  it("dice exactamente qué falta", () => {
    expect(missingForApproval({ productId: null, amount: 10, currency: "COP" })).toBe("Falta el producto.");
    expect(missingForApproval({ productId: null, amount: null, currency: null })).toBe("Falta el producto, el monto y la moneda.");
  });
});
