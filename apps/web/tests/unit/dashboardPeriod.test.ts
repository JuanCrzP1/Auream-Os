import { describe, expect, it } from "vitest";
import {
  choosePeriod, periodLabel, periodParams, periodWords, presetRange, previousRange, rangeLabel, rangeProblem, readPeriod
} from "../../src/features/dashboard/period/periodModel";
import { monthGrid } from "../../src/features/dashboard/period/MonthCalendar";
import { chartPoints } from "../../src/features/dashboard/sales/chartBuckets";

// El periodo del Dashboard: atajos que se mueven con los días o fechas a mano,
// en la dirección, con sus textos y el periodo con que se compara.

const NOW = new Date(2026, 10, 12, 15, 0); // jueves 12 nov 2026
const params = (query: string) => new URLSearchParams(query);

describe("periodo del Dashboard", () => {
  it("cada atajo da sus fechas contando desde hoy", () => {
    expect(presetRange("today", NOW)).toEqual({ from: "2026-11-12", to: "2026-11-12" });
    expect(presetRange("yesterday", NOW)).toEqual({ from: "2026-11-11", to: "2026-11-11" });
    expect(presetRange("7d", NOW)).toEqual({ from: "2026-11-06", to: "2026-11-12" });
    expect(presetRange("90d", NOW)).toEqual({ from: "2026-08-15", to: "2026-11-12" });
    expect(presetRange("month", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-12" });
    expect(presetRange("lastMonth", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("lastMonth", new Date(2026, 0, 5))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("year", NOW)).toEqual({ from: "2026-01-01", to: "2026-11-12" });
  });

  it("lee la dirección: atajo, fechas a mano o, si no sirven, los últimos 30 días", () => {
    expect(readPeriod(params("period=lastMonth"), NOW)).toEqual({ preset: "lastMonth", from: "2026-10-01", to: "2026-10-31" });
    expect(readPeriod(params("from=2026-10-03&to=2026-10-18"), NOW)).toEqual({ preset: null, from: "2026-10-03", to: "2026-10-18" });
    const fallback = { preset: "30d", from: "2026-10-14", to: "2026-11-12" };
    expect(readPeriod(params(""), NOW)).toEqual(fallback);
    expect(readPeriod(params("from=2026-10-18&to=2026-10-03"), NOW)).toEqual(fallback);
    expect(readPeriod(params("from=2026-10-03&to=2026-12-01"), NOW)).toEqual(fallback);
    expect(readPeriod(params("from=2026-02-30&to=2026-03-02"), NOW)).toEqual(fallback);
    expect(readPeriod(params("from=2024-01-01&to=2026-01-01"), NOW)).toEqual(fallback);
  });

  it("guarda en la dirección solo lo necesario", () => {
    expect(periodParams({ preset: "30d", from: "x", to: "y" })).toEqual({ period: null, from: null, to: null });
    expect(periodParams({ preset: "year", from: "x", to: "y" })).toEqual({ period: "year", from: null, to: null });
    expect(periodParams({ preset: null, from: "2026-10-03", to: "2026-10-18" })).toEqual({ period: null, from: "2026-10-03", to: "2026-10-18" });
  });

  it("unas fechas que coinciden con un atajo quedan como el atajo", () => {
    expect(choosePeriod("2026-10-01", "2026-10-31", NOW).preset).toBe("lastMonth");
    expect(choosePeriod("2026-10-02", "2026-10-31", NOW).preset).toBeNull();
  });

  it("dice qué falla en unas fechas", () => {
    expect(rangeProblem("2026-10-18", "2026-10-03", NOW)).toMatch(/inicio va antes/);
    expect(rangeProblem("2026-11-10", "2026-11-13", NOW)).toMatch(/ya pasaron/);
    expect(rangeProblem("2025-11-10", "2026-11-12", NOW)).toMatch(/hasta un año/);
    expect(rangeProblem("2025-11-12", "2026-11-12", NOW)).toBeNull();
  });

  it("compara con el periodo anterior del mismo largo", () => {
    expect(previousRange("2026-10-03", "2026-10-18")).toEqual({ from: "2026-09-17", to: "2026-10-02" });
    expect(previousRange("2026-11-12", "2026-11-12")).toEqual({ from: "2026-11-11", to: "2026-11-11" });
  });

  it("nombra el periodo corto y dentro de una frase", () => {
    expect(rangeLabel("2026-10-03", "2026-10-18", NOW)).toBe("3 – 18 oct");
    expect(rangeLabel("2026-09-28", "2026-10-04", NOW)).toBe("28 sep – 4 oct");
    expect(rangeLabel("2025-12-15", "2026-01-10", NOW)).toBe("15 dic 2025 – 10 ene 2026");
    expect(rangeLabel("2025-03-01", "2025-03-31", NOW)).toBe("1 – 31 mar 2025");
    expect(periodLabel({ preset: null, from: "2026-10-07", to: "2026-10-07" }, NOW)).toBe("7 oct");
    expect(periodLabel({ preset: "lastMonth", from: "", to: "" }, NOW)).toBe("Mes pasado");
    expect(periodWords({ preset: null, from: "2026-10-03", to: "2026-10-18" }, NOW)).toBe("del 3 al 18 oct");
    expect(periodWords({ preset: null, from: "2026-10-07", to: "2026-10-07" }, NOW)).toBe("el 7 oct");
    expect(periodWords({ preset: "90d", from: "", to: "" }, NOW)).toBe("últimos 90 días");
  });

  it("el mes en semanas que empiezan el lunes", () => {
    const november = monthGrid("2026-11"); // el 1 de nov de 2026 es domingo
    expect(november.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(november.length % 7).toBe(0);
    expect(november.filter(Boolean)).toHaveLength(30);
  });
});

describe("gráfico de periodos largos", () => {
  const days = (count: number) => Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, 0, 1 + i);
    return { day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, revenue: 10, spend: 1 };
  });

  it("hasta 92 días va día por día; más, por semana sin perder plata", () => {
    expect(chartPoints(days(92)).unit).toBe("day");
    const year = chartPoints(days(120));
    expect(year.unit).toBe("week");
    expect(year.points[0]).toEqual({ day: "2026-01-01", revenue: 40, spend: 4 }); // jue 1 a dom 4
    expect(year.points[1]!.day).toBe("2026-01-05");
    expect(year.points.reduce((sum, p) => sum + p.revenue, 0)).toBe(1200);
  });
});
