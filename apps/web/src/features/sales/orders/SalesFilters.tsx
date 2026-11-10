import "./sales-filters.css";
import type { ProductSummary } from "@contracts/SalesContracts";
import { SalesIcons } from "../salesIcons";
import { isoDay } from "../salesFormat";

export type SalesPeriod = "today" | "7d" | "30d" | "month" | "all";

const PERIODS: ReadonlyArray<{ readonly id: SalesPeriod; readonly label: string }> = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todo" }
];

/** Las fechas del periodo (`YYYY-MM-DD`); el servidor las lee en la hora de la empresa. */
export function periodRange(period: SalesPeriod, now = new Date()): { from?: string; to?: string } {
  const today = isoDay(now);
  const daysAgo = (days: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
  if (period === "today") return { from: today, to: today };
  if (period === "7d") return { from: daysAgo(6), to: today };
  if (period === "30d") return { from: daysAgo(29), to: today };
  if (period === "month") return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return {};
}

export interface SalesFilterValue {
  readonly period: SalesPeriod;
  readonly productId: string;
  readonly search: string;
}

/** Periodo, producto y búsqueda (cliente, teléfono, referencia o anuncio). */
export function SalesFilters({
  value,
  products,
  onChange
}: {
  readonly value: SalesFilterValue;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onChange: (next: SalesFilterValue) => void;
}) {
  return (
    <div className="sales-filters">
      <label className="sales-filters__search">
        <span className="sales-filters__icon">{SalesIcons.search}</span>
        <input
          type="search"
          aria-label="Buscar venta"
          placeholder="Cliente, teléfono, referencia o anuncio…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </label>
      <select className="sales-filters__select" aria-label="Periodo" value={value.period} onChange={(event) => onChange({ ...value, period: event.target.value as SalesPeriod })}>
        {PERIODS.map((period) => (
          <option key={period.id} value={period.id}>
            {period.label}
          </option>
        ))}
      </select>
      <select className="sales-filters__select" aria-label="Producto" value={value.productId} onChange={(event) => onChange({ ...value, productId: event.target.value })}>
        <option value="">Todos los productos</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
    </div>
  );
}
