import { describe, expect, it } from "vitest";
import type { SalesLineSummary } from "@contracts/SalesLineContracts";
import { activeFilters, chooseLine, effectiveIds, readSelection, selectionFilters, selectionParams, toggleId } from "../../src/features/dashboard/scope/dashboardScope";
import { lineSentence } from "../../src/features/dashboard/scope/lineSentence";
import { currencyOption, searchCurrencies } from "../../src/features/dashboard/scope/currencyOptions";
import { rateHint, ratesNote } from "../../src/features/dashboard/scope/fxRates";

// ---------------------------------------------------------------------------
// La parte del negocio que mira el Dashboard: la línea, lo elegido a mano
// (que gana sobre la línea), «todos a propósito» (*), la frase de una línea
// y las monedas con su bandera.
// ---------------------------------------------------------------------------

const LINE: SalesLineSummary = { id: "l1", name: "Venezuela", color: "#e0a400", productIds: ["p1", "p2"], connectionIds: [], campaignIds: ["111"], createdAt: "", updatedAt: "" };

describe("la selección en la dirección", () => {
  it("ida y vuelta: línea, listas, «todos a propósito» y moneda", () => {
    const selection = readSelection(new URLSearchParams("line=l1&products=p1&campaigns=*&currency=USD"));
    expect(selection).toEqual({ lineId: "l1", connectionIds: null, productIds: ["p1"], campaignIds: [], currency: "USD" });
    expect(selectionParams(selection)).toEqual({ line: "l1", numbers: null, products: "p1", campaigns: "*", currency: "USD" });
    // A la API: «todos a propósito» viaja como `*` para ganarle a la línea.
    expect(selectionFilters(selection)).toEqual({ lineId: "l1", productIds: ["p1"], campaignIds: ["*"], currency: "USD" });
  });

  it("lo elegido a mano gana sobre la línea; el número de Filtros cuenta lo recortado", () => {
    const fromLine = chooseLine(readSelection(new URLSearchParams("currency=VES&products=p9")), "l1");
    expect(fromLine).toEqual({ lineId: "l1", connectionIds: null, productIds: null, campaignIds: null, currency: "VES" });
    expect([effectiveIds(fromLine, LINE, "productIds"), activeFilters(fromLine, LINE)]).toEqual([["p1", "p2"], 2]);
    const manual = { ...fromLine, campaignIds: [] };
    expect([effectiveIds(manual, LINE, "campaignIds"), activeFilters(manual, LINE)]).toEqual([[], 1]);
  });

  it("marcar y desmarcar: desde «todos», y si vuelve a quedar todo marcado, es «todos»", () => {
    expect(toggleId([], "b", ["a", "b", "c"])).toEqual(["a", "c"]);
    expect(toggleId(["a", "c"], "b", ["a", "b", "c"])).toEqual([]);
  });
});

describe("la frase de una línea", () => {
  it("dice qué mide y de dónde sale su ROAS", () => {
    expect(lineSentence({ name: "Venezuela", products: ["Mega Pack"], numbers: [], campaigns: ["Venezuela · USD"] })).toBe(
      "Venezuela mide las ventas de Mega Pack en todos tus números, con el gasto de 1 campaña (Venezuela · USD). Su ROAS y su ganancia salen solo de eso."
    );
    expect(lineSentence({ name: "Combo", products: ["A", "B", "C", "D"], numbers: ["Ventas 1"], campaigns: [] })).toBe(
      "Combo mide las ventas de A, B y 2 más por Ventas 1, sin campañas: verás sus ventas, pero no su gasto ni su ROAS."
    );
  });
});

describe("las monedas", () => {
  it("con su bandera y nombre; se buscan por código, nombre o país", () => {
    expect(currencyOption("COP")).toEqual({ code: "COP", name: "Peso colombiano", flag: "🇨🇴" });
    expect(currencyOption("VES")).toEqual({ code: "VES", name: "Bolívar venezolano", flag: "🇻🇪" });
    expect(currencyOption("USD").flag).toBe("🇺🇸");
    expect(searchCurrencies("venezuela").map((option) => option.code)).toEqual(["VES"]);
  });

  it("la tasa oficial de cada una y de cuándo son (el bolívar, del BCV)", () => {
    const fx = { day: "2026-11-12", updatedAt: "2026-11-12T20:02:00.000Z", rates: [{ currency: "VES", perUsd: 904.4485, source: "bcv" }, { currency: "EUR", perUsd: 0.8612, source: "open-er-api" }] };
    expect([rateHint(fx, "VES"), rateHint(fx, "EUR"), rateHint(fx, "USD"), rateHint(fx, "COP")]).toEqual(["1 USD = 904,45", "1 USD = 0,8612", null, null]);
    expect(ratesNote(fx)).toMatch(/^Tasas oficiales del 12 de nov\.? \(actualizadas [^)]+\)\. Cada venta se convierte con la tasa de su día\. El bolívar es la tasa oficial del BCV\.$/);
    expect(ratesNote(null)).toBe("Lo vendido en otras monedas se convierte con la tasa oficial de cada día.");
  });
});
