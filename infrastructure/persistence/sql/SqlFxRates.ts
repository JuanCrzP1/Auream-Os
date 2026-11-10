import { CURRENCY_CODES } from "../../../contracts/Countries";
import type { FxRates, RateTable } from "../../../domains/analytics/application/CurrencyConverter";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlFxRates — `fx_rates` (033): unidades de cada moneda por 1 USD, por día.
// Una vez al día trae las tasas de una fuente pública sin clave
// (open.er-api.com, que incluye COP, VES y MXN) y las guarda: el Dashboard
// convierte con la tasa del día de cada venta y nunca depende de la red al leer.
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SOURCE = "https://open.er-api.com/v6/latest/USD";

export class SqlFxRates implements FxRates {
  private lastAttempt = 0;

  public constructor(
    private readonly sql: SqlExecutor,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly now: () => Date = () => new Date()
  ) {}

  public async table(from: string, to: string): Promise<RateTable> {
    const { rows } = await this.sql.query<{ day: string; currency: string; per_usd: string }>(
      `select to_char(day, 'YYYY-MM-DD') as day, currency, per_usd from fx_rates
        where day between coalesce((select max(day) from fx_rates where day < $1::date), $1::date) and $2::date
           or day = (select min(day) from fx_rates where day > $2::date)`,
      [from, to]
    );
    const table = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const day = table.get(row.day) ?? new Map<string, number>();
      day.set(row.currency.trim(), Number(row.per_usd));
      table.set(row.day, day);
    }
    return table;
  }

  public async refresh(): Promise<void> {
    const today = this.now().toISOString().slice(0, 10);
    // Un intento por hora y por instancia como mucho, aunque la fuente falle.
    if (this.now().getTime() - this.lastAttempt < 3_600_000) return;
    this.lastAttempt = this.now().getTime();
    try {
      const { rows } = await this.sql.query<{ n: string }>(`select count(*) as n from fx_rates where day = $1::date`, [today]);
      if (Number(rows[0]?.n ?? 0) > 0) return;
      const response = await this.fetchImpl(SOURCE, { signal: AbortSignal.timeout(8_000) });
      const body = (await response.json()) as { result?: string; rates?: Record<string, number> };
      if (body.result !== "success" || !body.rates) return;
      const codes = CURRENCY_CODES.filter((code) => typeof body.rates![code] === "number" && body.rates![code]! > 0);
      await this.sql.query(
        `insert into fx_rates (day, currency, per_usd) select $1::date, r.c, r.v from unnest($2::text[], $3::numeric[]) as r(c, v)
         on conflict (day, currency) do nothing`,
        [today, codes, codes.map((code) => body.rates![code])]
      );
    } catch {
      // Sin red o sin fuente: se convierte con la última tasa guardada.
    }
  }
}
