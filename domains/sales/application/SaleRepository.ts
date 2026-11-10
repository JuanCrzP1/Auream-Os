import type { SaleSource, SaleStatus, SalesTotal } from "../../../contracts/SalesContracts";
import type { NewSale, Sale } from "../domain/Sale";

// ---------------------------------------------------------------------------
// SaleRepository — puerto de las ventas. SQL: `SqlSaleRepository` (`sales`);
// pruebas: `InMemorySaleRepository`. Todo va por cuenta (`tenantId`).
// ---------------------------------------------------------------------------

/** Una venta para mostrar: con los nombres de la conexión, el flujo y quien la anotó. */
export interface SaleRecord extends Sale {
  readonly connectionName: string | null;
  readonly flowName: string | null;
  readonly recordedByName: string | null;
}

export interface SaleQuery {
  readonly status?: SaleStatus;
  readonly productId?: string;
  readonly currency?: string;
  readonly source?: SaleSource;
  readonly from?: Date | null;
  readonly until?: Date | null;
  readonly search?: string;
}

/** Posición en la lista (la más reciente primero): para pedir la página siguiente. */
export interface SaleCursor {
  readonly soldAt: string;
  readonly id: string;
}

export interface SaleChanges {
  readonly status: SaleStatus;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly customerName: string | null;
  readonly note: string;
  readonly reviewReason: string | null;
  readonly recordedBy: string;
}

export interface SaleRepository {
  /** Guarda la venta; si ya existe una con el mismo `originKey` en la cuenta, devuelve esa (`created: false`). */
  insert(tenantId: string, sale: NewSale, status: SaleStatus, reviewReason: string | null): Promise<{ readonly sale: SaleRecord; readonly created: boolean }>;
  find(tenantId: string, saleId: string): Promise<SaleRecord | null>;
  update(tenantId: string, saleId: string, changes: SaleChanges): Promise<SaleRecord | null>;
  list(tenantId: string, query: SaleQuery, cursor: SaleCursor | null, limit: number): Promise<ReadonlyArray<SaleRecord>>;
  /** Lo vendido por moneda, SOLO con ventas aprobadas, con los mismos filtros. */
  totals(tenantId: string, query: SaleQuery): Promise<ReadonlyArray<SalesTotal>>;
  countByStatus(tenantId: string, status: SaleStatus): Promise<number>;
}
