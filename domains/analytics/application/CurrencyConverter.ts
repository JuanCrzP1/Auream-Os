import type { FxRatesResponse } from "../../../contracts/DashboardContracts";

// ---------------------------------------------------------------------------
// CurrencyConverter — pasa montos de una moneda a otra con la tasa de ESE día
// (unidades por 1 USD). Si ese día no hay tasa, usa la más cercana anterior y,
// si no hay ninguna anterior, la más cercana posterior. Sin ninguna tasa para
// una moneda, no inventa: devuelve `null` y quien llama lo dice.
// ---------------------------------------------------------------------------

/** Por día (`YYYY-MM-DD`), unidades de cada moneda por 1 USD. */
export type RateTable = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** Las tasas guardadas y cómo traer las de hoy. */
export interface FxRates {
  /** Las tasas entre esas fechas (y, para cubrir huecos, la última anterior). */
  table(from: string, to: string): Promise<RateTable>;
  /** Trae las de hoy si aún no están completas. Nunca lanza. */
  refresh(): Promise<void>;
  /** Las más recientes, con su fuente y cuándo llegaron (para mostrarlas). */
  latest(): Promise<FxRatesResponse>;
}

export class CurrencyConverter {
  private readonly days: string[];

  public constructor(private readonly rates: RateTable) {
    this.days = [...rates.keys()].sort();
  }

  /** El monto en `target`, o `null` si falta la tasa de alguna de las dos monedas. */
  public convert(amount: number, from: string, target: string, day: string): number | null {
    if (from === target) return amount;
    const fromRate = this.rate(from, day);
    const toRate = this.rate(target, day);
    if (fromRate === null || toRate === null) return null;
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }

  public has(currency: string): boolean {
    return currency === "USD" || this.days.some((day) => this.rates.get(day)!.has(currency));
  }

  private rate(currency: string, day: string): number | null {
    if (currency === "USD") return 1;
    let before: number | null = null;
    let after: number | null = null;
    for (const candidate of this.days) {
      const value = this.rates.get(candidate)!.get(currency);
      if (value === undefined) continue;
      if (candidate <= day) before = value;
      else if (after === null) after = value;
    }
    return before ?? after;
  }
}
