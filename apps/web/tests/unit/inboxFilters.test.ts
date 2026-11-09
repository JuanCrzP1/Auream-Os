import { describe, expect, it } from "vitest";
import {
  dateBounds,
  dateLabel,
  EMPTY_FILTERS,
  invalidCustomRange,
  isFiltered,
  panelFilterCount,
  toListQuery
} from "../../src/features/conversations/model/inboxFilters";

// Fechas de la bandeja en la zona horaria de quien mira: «hoy» empieza a su medianoche.

const NOW = new Date(2026, 10, 9, 15, 30); // 9 nov 2026, 3:30 p. m. local
const day = (y: number, m: number, d: number) => new Date(y, m, d).toISOString();

describe("inboxFilters", () => {
  it("hoy, ayer, 7 y 30 días y fechas elegidas (ambos días incluidos)", () => {
    expect(dateBounds({ preset: "any" }, NOW)).toEqual({});
    expect(dateBounds({ preset: "today" }, NOW)).toEqual({ from: day(2026, 10, 9) });
    expect(dateBounds({ preset: "yesterday" }, NOW)).toEqual({ from: day(2026, 10, 8), to: day(2026, 10, 9) });
    expect(dateBounds({ preset: "last7" }, NOW)).toEqual({ from: day(2026, 10, 3) });
    expect(dateBounds({ preset: "last30" }, NOW)).toEqual({ from: day(2026, 9, 11) });
    expect(dateBounds({ preset: "custom", from: "2026-11-01", to: "2026-11-05" }, NOW)).toEqual({ from: day(2026, 10, 1), to: day(2026, 10, 6) });
    expect(dateBounds({ preset: "custom", from: "2026-11-01" }, NOW)).toEqual({ from: day(2026, 10, 1) });
  });

  it("un rango al revés no se envía y se avisa", () => {
    const backwards = { preset: "custom" as const, from: "2026-11-10", to: "2026-11-01" };
    expect(invalidCustomRange(backwards)).toBe(true);
    expect(toListQuery({ ...EMPTY_FILTERS, date: backwards }, NOW)).toEqual({ filter: "all" });
  });

  it("arma la consulta y cuenta los filtros del panel", () => {
    const filters = { status: "unread" as const, search: "  laura ", connectionId: "w1", labelIds: ["a", "b"], date: { preset: "today" as const } };
    expect(toListQuery(filters, NOW)).toEqual({ filter: "unread", search: "laura", connectionId: "w1", labelIds: ["a", "b"], from: day(2026, 10, 9) });
    expect(panelFilterCount(filters)).toBe(4);
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, status: "bot_active" })).toBe(true);
    expect(dateLabel({ preset: "last7" })).toBe("Últimos 7 días");
  });
});
