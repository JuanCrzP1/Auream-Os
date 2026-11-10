import "./sales-list-panel.css";
import type { ProductSummary, SaleSummary } from "@contracts/SalesContracts";
import type { SalesState } from "../hooks/useSales";
import { ReviewEmpty } from "./ReviewEmpty";
import { SalesFilters, type SalesFilterValue } from "./SalesFilters";
import { SalesTable } from "./SalesTable";

/** La lista en su tarjeta: título, búsqueda y producto, las filas, «Ver más» y su vacío. */
export function SalesListPanel({
  view,
  sales,
  filters,
  products,
  onFilters,
  onOpen
}: {
  readonly view: "sales" | "review";
  readonly sales: SalesState;
  readonly filters: SalesFilterValue;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onFilters: (next: SalesFilterValue) => void;
  readonly onOpen: (sale: SaleSummary) => void;
}) {
  const rows = sales.data?.sales ?? [];
  const filtering = Boolean(filters.search.trim() || filters.productId);
  if (view === "review" && sales.status === "ready" && rows.length === 0 && !filtering) return <ReviewEmpty />;

  return (
    <section className="sales-list" aria-labelledby={`sales-list-${view}`}>
      <header className="sales-list__head">
        <h2 id={`sales-list-${view}`} className="sales-list__title">
          {view === "review" ? "Esperan revisión" : "Últimas ventas"}
        </h2>
        <SalesFilters value={filters} products={products} onChange={onFilters} />
      </header>
      {sales.status === "loading" ? <div className="sales-list__loading" aria-busy="true" aria-label="Cargando las ventas" /> : null}
      {sales.status === "ready" && rows.length === 0 ? (
        <p className="sales-list__empty">{filtering ? "Ninguna venta coincide con la búsqueda." : "Todavía no hay ventas en este periodo."}</p>
      ) : null}
      {rows.length > 0 ? <SalesTable sales={rows} onOpen={onOpen} /> : null}
      {sales.data?.nextCursor ? (
        <button type="button" className="ui-btn ui-btn--ghost sales-list__more" disabled={sales.loadingMore} onClick={() => void sales.loadMore()}>
          {sales.loadingMore ? "Cargando…" : "Ver más ventas"}
        </button>
      ) : null}
    </section>
  );
}
