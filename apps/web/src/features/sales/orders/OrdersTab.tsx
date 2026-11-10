import "./orders-tab.css";
import { useEffect, useMemo, useState } from "react";
import type { ProductSummary, SaleSummary } from "@contracts/SalesContracts";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { useSales } from "../hooks/useSales";
import { SaleDialog } from "./SaleDialog";
import { SalesFilters, periodRange, type SalesFilterValue } from "./SalesFilters";
import { SalesSummary } from "./SalesSummary";
import { SalesTable } from "./SalesTable";

/**
 * Ventas (todas, cada una con su estado, y los totales del periodo, que solo
 * suman las aprobadas) o «Por revisar» (las incompletas, con el motivo).
 * Tocar una venta la abre para revisarla.
 */
export function OrdersTab({
  view,
  products,
  refreshKey,
  onCounts
}: {
  readonly view: "sales" | "review";
  readonly products: ReadonlyArray<ProductSummary>;
  /** Cambia cuando se anota una venta desde la página: la lista se vuelve a pedir. */
  readonly refreshKey: number;
  readonly onCounts: (counts: { readonly review: number; readonly canRecord: boolean; readonly canManage: boolean }) => void;
}) {
  const [filters, setFilters] = useState<SalesFilterValue>({ period: view === "review" ? "all" : "30d", productId: "", search: "" });
  const [search, setSearch] = useState(filters.search);
  const [open, setOpen] = useState<SaleSummary | null>(null);

  // La búsqueda espera a que la persona deje de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const query = useMemo(
    () => ({
      ...periodRange(filters.period),
      ...(view === "review" ? { status: "review" as const } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(search.length >= 2 ? { search } : {})
    }),
    [filters.period, filters.productId, search, view]
  );
  const sales = useSales(query);
  const { refresh } = sales;
  const visible = sales.data?.sales ?? [];

  useEffect(() => {
    if (refreshKey > 0) void refresh();
  }, [refreshKey, refresh]);
  useEffect(() => {
    if (sales.data) onCounts({ review: sales.data.reviewCount, canRecord: sales.data.canRecord, canManage: sales.data.canManage });
  }, [sales.data, onCounts]);

  if (sales.status === "forbidden") return <StateCard icon={StateIcons.lock} title="Sin acceso a Ventas" description="Tu rol no permite ver las ventas de esta cuenta." />;
  if (sales.status === "error" || sales.status === "unavailable") {
    return (
      <StateCard
        role="alert"
        tone="warning"
        icon={StateIcons.offline}
        title="No pudimos cargar las ventas"
        description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
        actions={<RetryButton busy={false} onRetry={() => void refresh()} />}
      />
    );
  }

  return (
    <div className="orders-tab">
      {view === "sales" && sales.data ? <SalesSummary totals={sales.data.totals} /> : null}
      <SalesFilters value={filters} products={products} onChange={setFilters} />
      {sales.status === "loading" ? <div className="orders-tab__loading" aria-busy="true" aria-label="Cargando las ventas" /> : null}
      {sales.status === "ready" && visible.length === 0 ? (
        <p className="orders-tab__empty">
          {view === "review" ? "No hay ventas por revisar. Las que lleguen sin producto o sin monto aparecen aquí." : "No hay ventas con estos filtros."}
        </p>
      ) : null}
      {visible.length > 0 ? <SalesTable sales={visible} onOpen={setOpen} /> : null}
      {sales.data?.nextCursor ? (
        <button type="button" className="ui-btn ui-btn--ghost orders-tab__more" disabled={sales.loadingMore} onClick={() => void sales.loadMore()}>
          {sales.loadingMore ? "Cargando…" : "Ver más ventas"}
        </button>
      ) : null}
      {open ? <SaleDialog sale={open} products={products} canManage={sales.data?.canManage ?? false} onUpdate={sales.update} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
