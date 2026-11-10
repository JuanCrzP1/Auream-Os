import "./dashboard-filters.css";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { PERIODS, type PeriodId } from "../dashboardFormat";

/** El periodo (Hoy · 7 días · 30 días · Este mes) y, para Ventas y Atención, número y producto. */
export function DashboardFilters({ period, connectionId, productId, connections, products, showProduct, onPeriod, onConnection, onProduct }: {
  readonly period: PeriodId;
  readonly connectionId: string;
  readonly productId: string;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly showProduct: boolean;
  readonly onPeriod: (period: PeriodId) => void;
  readonly onConnection: (id: string) => void;
  readonly onProduct: (id: string) => void;
}) {
  return (
    <div className="dashboard-filters">
      <div className="dashboard-filters__periods" role="group" aria-label="Periodo">
        {PERIODS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={period === id} onClick={() => onPeriod(id)}>{label}</button>
        ))}
      </div>
      {connections.length > 1 ? (
        <label className="dashboard-filters__select">
          <span>Número</span>
          <select value={connectionId} onChange={(event) => onConnection(event.target.value)}>
            <option value="">Todos</option>
            {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
          </select>
        </label>
      ) : null}
      {showProduct && products.length > 1 ? (
        <label className="dashboard-filters__select">
          <span>Producto</span>
          <select value={productId} onChange={(event) => onProduct(event.target.value)}>
            <option value="">Todos</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}
