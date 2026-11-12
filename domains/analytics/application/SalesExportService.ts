import { SALES_EXPORT_MAX_ROWS, type DashboardFilters } from "../../../contracts/DashboardContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { periodOf, type Period } from "./DashboardPeriod";
import type { AdsReader, DashboardScope } from "./DashboardReaders";
import { DashboardScopeResolver } from "./DashboardScopeResolver";
import { MoneyBook, mostUsedCurrency } from "./MoneyBook";
import { exportTable, type SalesExportTable } from "./SalesExportTable";
import { requestedCurrency } from "./SalesDashboardService";

// ---------------------------------------------------------------------------
// Descargar ventas: las ventas aprobadas del periodo con lo que se mira en el
// Dashboard (línea, números, productos), una por fila, con su monto original
// y convertido a la moneda de reporte con la tasa de su día. Devuelve una
// TABLA (columnas y valores): el formato del archivo (CSV) lo decide la API.
// Solo lee. Tope de filas para que la descarga nunca se caiga.
// ---------------------------------------------------------------------------

export const MAX_EXPORT_ROWS = SALES_EXPORT_MAX_ROWS;

/** Una venta tal como sale en la descarga (días y horas en la zona de la empresa). */
export interface SaleExportRow {
  readonly id: string;
  readonly day: string;
  readonly time: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly country: string | null;
  readonly productName: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly connectionName: string | null;
  /** Llegó por un anuncio de las cuentas conectadas (y de las campañas elegidas). */
  readonly fromAd: boolean;
  /** Llegó por un anuncio, aunque no sea de las cuentas conectadas (o de las campañas elegidas). */
  readonly hasAdSource: boolean;
  readonly campaignName: string | null;
  readonly adName: string | null;
  readonly source: string;
  readonly receiptReference: string | null;
  readonly note: string;
}

export interface SalesExportReader {
  /** Las ventas aprobadas del periodo, de la más nueva a la más vieja, hasta `limit`. */
  rows(tenantId: string, period: Period, scope: DashboardScope, timezone: string, limit: number): Promise<ReadonlyArray<SaleExportRow>>;
}

export interface SalesExport extends SalesExportTable {
  /** «ventas_2026-10-01_a_2026-10-31.csv» sin la extensión. */
  readonly name: string;
  /** Había más ventas que el tope: se cortó. */
  readonly truncated: boolean;
}

export class SalesExportService {
  public constructor(
    private readonly reader: SalesExportReader,
    private readonly ads: AdsReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly scopes: DashboardScopeResolver = new DashboardScopeResolver(),
    private readonly now: () => Date = () => new Date(),
    private readonly limit = MAX_EXPORT_ROWS
  ) {}

  public async export(tenantId: string, filters: DashboardFilters): Promise<SalesExport> {
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const scope = await this.scopes.resolve(tenantId, filters);
    await this.fx.refresh();
    const [rows, rates, status] = await Promise.all([
      this.reader.rows(tenantId, period, scope, timezone, this.limit + 1),
      this.fx.table(period.fromDay, period.toDay),
      this.ads.status(tenantId, scope)
    ]);
    const kept = rows.slice(0, this.limit);
    const converter = new CurrencyConverter(rates);
    // La misma moneda que el Dashboard: la pedida, la de la cuenta de anuncios con más gasto o la más vendida.
    const counted = kept.map((row) => ({ currency: row.currency, count: 1 }));
    const book = new MoneyBook(
      converter,
      requestedCurrency(filters.currency, converter) ?? status.mainCurrency ?? mostUsedCurrency(counted.filter((row) => converter.has(row.currency))) ?? mostUsedCurrency(counted) ?? "USD"
    );
    return {
      ...exportTable(kept, book),
      name: `ventas_${period.fromDay}_a_${period.toDay}`,
      truncated: rows.length > this.limit
    };
  }
}
