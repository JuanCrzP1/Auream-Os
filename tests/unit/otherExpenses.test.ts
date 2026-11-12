import { describe, expect, it } from "vitest";
import { CurrencyConverter } from "../../domains/analytics/application/CurrencyConverter.js";
import { MoneyBook } from "../../domains/analytics/application/MoneyBook.js";
import { chargeDays, chargesOf, rulesFor, type ExpenseRule } from "../../domains/analytics/application/OtherExpenseLedger.js";
import { otherExpenseDraft } from "../../domains/expenses/domain/OtherExpense.js";
import { OtherExpenseServices } from "../../domains/expenses/application/OtherExpenseServices.js";
import { InMemoryOtherExpenseRepository } from "../../infrastructure/persistence/memory/InMemoryOtherExpenseRepository.js";

// ---------------------------------------------------------------------------
// Otros gastos: sus reglas (fijo con moneda y frecuencia, o % de 0 a 100),
// crear y editar sin perder lo que no se tocó, y cuánto cuesta cada uno en un
// periodo (los cobros fijos con la tasa de su día; los % sobre lo vendido).
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const L = "22222222-2222-4222-8222-222222222222";
const fixed = { name: "Nómina", kind: "fixed", amount: "1.200.000", currency: "cop", frequency: "monthly", startsOn: "2026-10-31" } as const;

describe("un gasto", () => {
  it("fijo: lee el monto como siempre y pide moneda y frecuencia; %: sin moneda y de 0 a 100", () => {
    expect(otherExpenseDraft({ ...fixed, name: "  Nómina   equipo " })).toEqual({
      name: "Nómina equipo", kind: "fixed", amount: 1_200_000, currency: "COP", frequency: "monthly", startsOn: "2026-10-31", endsOn: null, lineId: null
    });
    expect(otherExpenseDraft({ name: "Pasarela", kind: "percent", amount: "3,5", currency: "USD", frequency: "daily", startsOn: "2026-11-01" })).toMatchObject({
      amount: 3.5, currency: null, frequency: null
    });
    expect(() => otherExpenseDraft({ ...fixed, currency: undefined })).toThrow(/moneda/);
    expect(() => otherExpenseDraft({ ...fixed, frequency: undefined })).toThrow(/cada cuánto/);
    expect(() => otherExpenseDraft({ ...fixed, kind: "percent", amount: "120" })).toThrow(/0 a 100/);
    expect(() => otherExpenseDraft({ ...fixed, amount: "mucho" })).toThrow(/monto/);
  });

  it("pide nombre, fechas reales (la final después de la inicial) y una línea válida", () => {
    expect(() => otherExpenseDraft({ ...fixed, name: " " })).toThrow(/nombre/);
    expect(() => otherExpenseDraft({ ...fixed, startsOn: "2026-02-30" })).toThrow(/desde cuándo/);
    expect(() => otherExpenseDraft({ ...fixed, endsOn: "2026-10-01" })).toThrow(/después/);
    expect(() => otherExpenseDraft({ ...fixed, lineId: "x" })).toThrow(/línea/);
  });
});

describe("OtherExpenseServices", () => {
  it("crea, edita solo lo que llega, revisa que la línea sea de la cuenta y borra", async () => {
    const repository = new InMemoryOtherExpenseRepository(new Map([[T, [L]]]));
    const services = new OtherExpenseServices(repository, () => "33333333-3333-4333-8333-333333333333");
    const created = await services.create(T, { ...fixed, lineId: L });
    expect(created).toMatchObject({ id: "33333333-3333-4333-8333-333333333333", amount: 1_200_000, lineId: L });
    expect(created).not.toHaveProperty("tenantId");

    const edited = await services.update(T, created.id, { name: "Nómina 2" });
    expect(edited).toMatchObject({ name: "Nómina 2", amount: 1_200_000, frequency: "monthly", lineId: L });
    // Pasar a %: la moneda y la frecuencia sobran y se quitan.
    expect(await services.update(T, created.id, { kind: "percent", amount: 3 })).toMatchObject({ kind: "percent", currency: null, frequency: null });

    await expect(services.create(T, { ...fixed, lineId: "44444444-4444-4444-8444-444444444444" })).rejects.toThrow(/línea/);
    await expect(services.update("55555555-5555-4555-8555-555555555555", created.id, { name: "x" })).rejects.toThrow(/no existe/);
    expect((await services.list(T, false)).canManage).toBe(false);
    await services.remove(T, created.id);
    expect((await services.list(T, true)).expenses).toEqual([]);
  });
});

const rule = (over: Partial<ExpenseRule>): ExpenseRule => ({
  id: "e", name: "Gasto", kind: "fixed", amount: 100, currency: "COP", frequency: "once", startsOn: "2026-11-01", endsOn: null, lineId: null, ...over
});

describe("cuándo se cobra un gasto fijo", () => {
  it("una vez: el día que empieza, si cae en el periodo", () => {
    expect(chargeDays(rule({}), "2026-11-01", "2026-11-30")).toEqual(["2026-11-01"]);
    expect(chargeDays(rule({}), "2026-11-02", "2026-11-30")).toEqual([]);
  });

  it("cada día y cada semana: solo los días vigentes", () => {
    expect(chargeDays(rule({ frequency: "daily", startsOn: "2026-11-03", endsOn: "2026-11-05" }), "2026-11-01", "2026-11-30")).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    // Empezó el 1: se cobra el 1, el 8, el 15… y en el periodo desde el 10 solo el 15 y el 22.
    expect(chargeDays(rule({ frequency: "weekly" }), "2026-11-10", "2026-11-25")).toEqual(["2026-11-15", "2026-11-22"]);
  });

  it("cada mes: el mismo día, y el 31 cae el último día de los meses cortos", () => {
    expect(chargeDays(rule({ frequency: "monthly", startsOn: "2026-01-31" }), "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(chargeDays(rule({ frequency: "monthly", startsOn: "2026-11-15", endsOn: "2027-01-10" }), "2026-10-01", "2027-03-01")).toEqual(["2026-11-15", "2026-12-15"]);
  });
});

describe("cuánto cuesta en un periodo", () => {
  const book = () => new MoneyBook(new CurrencyConverter(new Map([["2026-11-01", new Map([["COP", 4000]])]])), "COP");
  const sold = [
    { day: "2026-11-02", currency: "COP", amount: 400_000 },
    { day: "2026-11-20", currency: "USD", amount: 100 }
  ];

  it("convierte cada cobro con la tasa de su día y el % va sobre lo vendido en sus días", () => {
    const rules = [
      rule({ id: "a", currency: "USD", amount: 10, frequency: "weekly" }),
      rule({ id: "b", kind: "percent", amount: 5, currency: null, frequency: null, startsOn: "2026-11-10" })
    ];
    // 10 USD × 3 semanas (1, 8, 15) hasta hoy (el 16) = 120.000; el 5 % solo cuenta lo vendido desde el 10 y hasta hoy: nada.
    expect(chargesOf(rules, "2026-11-01", "2026-11-30", "2026-11-16", book(), sold)).toEqual([
      { id: "a", name: "Gasto", amount: 120_000 },
      { id: "b", name: "Gasto", amount: 0 }
    ]);
    // Al final del mes, el 5 % de los 100 USD del día 20 (400.000) = 20.000.
    expect(chargesOf(rules, "2026-11-01", "2026-11-30", "2026-11-30", book(), sold)[1]!.amount).toBe(20_000);
  });

  it("una moneda sin tasa no se suma y queda anotada", () => {
    const money = book();
    expect(chargesOf([rule({ currency: "VES" })], "2026-11-01", "2026-11-30", "2026-11-30", money, [])[0]!.amount).toBe(0);
    expect(money.missing).toEqual(["VES"]);
  });

  it("con una línea, solo sus gastos; sin línea, todos", () => {
    const rules = [rule({ id: "todo" }), rule({ id: "linea", lineId: L })];
    expect(rulesFor(rules, L.toUpperCase()).map((r) => r.id)).toEqual(["linea"]);
    expect(rulesFor(rules, undefined).map((r) => r.id)).toEqual(["todo", "linea"]);
  });
});
