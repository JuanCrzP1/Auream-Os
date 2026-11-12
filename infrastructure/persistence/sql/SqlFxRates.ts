import { CURRENCY_CODES } from "../../../contracts/Countries";
import type { FxRatesResponse } from "../../../contracts/DashboardContracts";
import type { FxRates, RateTable } from "../../../domains/analytics/application/CurrencyConverter";
import { officialSources, type FetchLike, type FxQuote, type FxSource } from "../../fx/FxSources";
import type { SqlExecutor } from "./SqlClient";

export type { FetchLike } from "../../fx/FxSources";

// ---------------------------------------------------------------------------
// SqlFxRates — `fx_rates` (033, 044): unidades de cada moneda por 1 USD, por
// día, con la fuente oficial de cada una y cuándo llegó.
//
// Se actualizan solas: la revisión de cada 15 min (Vercel Schedules) y el
// Dashboard llaman `refresh`, que trae las de hoy si faltan (un intento por
// hora y por instancia). Para cada moneda gana la primera fuente que la traiga
// (el bolívar, del BCV). El Dashboard convierte con la tasa del día de cada
// venta y nunca depende de la red al leer.
// ---------------------------------------------------------------------------

export interface FxRefreshOptions {
  /** Pasó más de un día sin tasas nuevas (las fuentes no responden): para el registro. */
  readonly onStale?: (info: { readonly lastDay: string | null; readonly errors: ReadonlyArray<string> }) => void;
}

const DAY_MS = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export class SqlFxRates implements FxRates {
  private lastAttempt = 0;
  private readonly sources: ReadonlyArray<FxSource>;

  public constructor(
    private readonly sql: SqlExecutor,
    fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly now: () => Date = () => new Date(),
    private readonly options: FxRefreshOptions & { readonly sources?: ReadonlyArray<FxSource> } = {}
  ) {
    this.sources = options.sources ?? officialSources(fetchImpl, CURRENCY_CODES.filter((code) => code !== "USD"), now);
  }

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
    const now = this.now();
    // Un intento por hora y por instancia como mucho, aunque las fuentes fallen.
    if (now.getTime() - this.lastAttempt < 3_600_000) return;
    this.lastAttempt = now.getTime();
    const today = isoDay(now);
    try {
      if (await this.completeFor(today)) return;
      const results = await Promise.allSettled(this.sources.map((source) => source.fetch()));
      const errors = results.flatMap((result, index) => (result.status === "rejected" ? [`${this.sources[index]!.name}: ${String((result.reason as Error)?.message ?? result.reason)}`] : []));
      const chosen = new Map<string, { quote: FxQuote; source: string }>();
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        for (const [code, quote] of Object.entries(result.value)) if (!chosen.has(code)) chosen.set(code, { quote, source: this.sources[index]!.name });
      });
      if (chosen.size > 0) {
        const codes = [...chosen.keys()];
        await this.sql.query(
          `insert into fx_rates (day, currency, per_usd, source, fetched_at)
           select $1::date, r.c, r.v, r.s, now() from unnest($2::text[], $3::numeric[], $4::text[]) as r(c, v, s)
           on conflict (day, currency) do nothing`,
          [today, codes, codes.map((code) => chosen.get(code)!.quote.perUsd), codes.map((code) => chosen.get(code)!.source)]
        );
      }
      await this.warnIfStale(now, errors);
    } catch {
      // Sin base o sin red: se convierte con la última tasa guardada.
    }
  }

  public async latest(): Promise<FxRatesResponse> {
    const { rows } = await this.sql.query<{ day: string; currency: string; per_usd: string; source: string | null; fetched_at: Date | string }>(
      `select to_char(day, 'YYYY-MM-DD') as day, currency, per_usd, source, fetched_at from fx_rates
        where day = (select max(day) from fx_rates) order by currency`
    );
    if (rows.length === 0) return { day: null, updatedAt: null, rates: [] };
    const updated = rows.map((row) => new Date(row.fetched_at).getTime()).reduce((a, b) => Math.max(a, b), 0);
    return {
      day: rows[0]!.day,
      updatedAt: new Date(updated).toISOString(),
      rates: rows.map((row) => ({ currency: row.currency.trim(), perUsd: Number(row.per_usd), source: row.source }))
    };
  }

  /** ¿Hoy ya tiene todas las monedas que tuvo el último día guardado? */
  private async completeFor(today: string): Promise<boolean> {
    const { rows } = await this.sql.query<{ today: string; before: string }>(
      `select count(*) filter (where day = $1::date) as today,
              count(*) filter (where day = (select max(day) from fx_rates where day < $1::date)) as before
         from fx_rates where day >= (select coalesce(max(day), $1::date) from fx_rates where day < $1::date)`,
      [today]
    );
    const done = Number(rows[0]?.today ?? 0);
    return done > 0 && done >= Number(rows[0]?.before ?? 0);
  }

  private async warnIfStale(now: Date, errors: ReadonlyArray<string>): Promise<void> {
    if (!this.options.onStale) return;
    const { rows } = await this.sql.query<{ last: string | null }>("select to_char(max(day), 'YYYY-MM-DD') as last from fx_rates");
    const last = rows[0]?.last ?? null;
    if (last === null || now.getTime() - Date.parse(`${last}T00:00:00Z`) > DAY_MS * 1.5) this.options.onStale({ lastDay: last, errors });
  }
}
