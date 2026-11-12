import type { CurrencyConverter } from "./CurrencyConverter";

// ---------------------------------------------------------------------------
// MoneyBook — suma montos de varias monedas en UNA moneda de reporte, con la
// tasa del día de cada monto. Lo que no se pudo convertir no se suma: queda
// anotado en `missing` para decirlo en pantalla (nunca un número inventado).
// ---------------------------------------------------------------------------

export class MoneyBook {
  private readonly missingCurrencies = new Set<string>();

  public constructor(private readonly converter: CurrencyConverter, public readonly currency: string) {}

  public convert(amount: number, currency: string, day: string): number {
    return this.tryConvert(amount, currency, day) ?? 0;
  }

  /** Como `convert`, pero `null` si no hay tasa (también queda anotada en `missing`). */
  public tryConvert(amount: number, currency: string, day: string): number | null {
    if (amount === 0) return 0;
    const value = this.converter.convert(amount, currency, this.currency, day);
    if (value === null) this.missingCurrencies.add(currency);
    return value;
  }

  public sum<T>(rows: ReadonlyArray<T>, pick: (row: T) => { amount: number; currency: string; day: string }): number {
    return round(rows.reduce((total, row) => {
      const { amount, currency, day } = pick(row);
      return total + this.convert(amount, currency, day);
    }, 0));
  }

  public get missing(): string[] {
    return [...this.missingCurrencies].sort();
  }
}

export const round = (value: number) => Math.round(value * 100) / 100;
export const ratio = (top: number, bottom: number) => (bottom > 0 ? Math.round((top / bottom) * 100) / 100 : null);

/** La moneda en que más se vende (por número de ventas). */
export function mostUsedCurrency(rows: ReadonlyArray<{ currency: string; count: number }>): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.currency, (counts.get(row.currency) ?? 0) + row.count);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
